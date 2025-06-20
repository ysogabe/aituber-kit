import { MqttIntegrationConfig, MqttConfig, MqttSubscription } from '../types'
import settingsStore from '@/features/stores/settings'

/**
 * settingsStoreからMQTT設定を読み込むユーティリティ
 */
export class MqttConfigLoader {
  /**
   * settingsStoreからMQTT統合設定を読み込み
   */
  static loadConfig(): MqttIntegrationConfig {
    const settings = settingsStore.getState()

    // MQTT統合機能の有効/無効
    const enabled = settings.mqttEnabled

    if (!enabled) {
      return {
        enabled: false,
        connection: MqttConfigLoader.getDefaultConnection(),
        subscriptions: [],
        reconnect: MqttConfigLoader.getDefaultReconnectConfig(),
      }
    }

    // MQTT接続設定
    const connection = MqttConfigLoader.loadConnectionConfig()

    // 購読設定
    const subscriptions = MqttConfigLoader.loadSubscriptionConfig()

    // 再接続設定
    const reconnect = MqttConfigLoader.loadReconnectConfig()

    return {
      enabled,
      connection,
      subscriptions,
      reconnect,
    }
  }

  /**
   * MQTT接続設定を読み込み
   */
  private static loadConnectionConfig(): MqttConfig {
    const settings = settingsStore.getState()

    return {
      host: settings.mqttHost,
      port: settings.mqttPort,
      clientId: settings.mqttClientId,
      protocol: settings.mqttProtocol,
      websocketPath:
        settings.mqttProtocol === 'websocket'
          ? settings.mqttWebsocketPath
          : undefined,
      username: settings.mqttUsername,
      password: settings.mqttPassword,
      secure: settings.mqttSecure,
    }
  }

  /**
   * 購読設定を読み込み
   */
  private static loadSubscriptionConfig(): MqttSubscription[] {
    // デフォルトの購読トピック（発話用）
    const defaultTopics = [
      'aituber/speech', // 通常の発話
      'aituber/speech/alert', // アラート発話
      'aituber/speech/notification', // 通知発話
    ]

    // 環境変数から追加トピックを読み込み（カンマ区切り）
    const additionalTopics =
      process.env.NEXT_PUBLIC_MQTT_SPEECH_TOPICS?.split(',')
        .map((topic) => topic.trim())
        .filter((topic) => topic.length > 0) || []

    // 全トピックを統合
    const allTopics = [...defaultTopics, ...additionalTopics]

    return allTopics.map((topic) => ({
      topic,
      qos: 2 as const, // QoS 2 (Exactly once delivery)
      active: true,
    }))
  }

  /**
   * 再接続設定を読み込み
   */
  private static loadReconnectConfig() {
    const settings = settingsStore.getState()

    return {
      enabled: settings.mqttReconnectEnabled,
      initialDelay: settings.mqttReconnectInitialDelay,
      maxDelay: settings.mqttReconnectMaxDelay,
      maxAttempts: settings.mqttReconnectMaxAttempts,
    }
  }

  /**
   * デフォルトの接続設定を取得
   */
  private static getDefaultConnection(): MqttConfig {
    return {
      host: 'localhost',
      port: 1883,
      clientId: `aituber-default-${Date.now()}`,
      protocol: 'mqtt',
    }
  }

  /**
   * デフォルトの再接続設定を取得
   */
  private static getDefaultReconnectConfig() {
    return {
      enabled: true,
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 5,
    }
  }

  /**
   * 設定の妥当性を検証
   */
  static validateConfig(config: MqttIntegrationConfig): string[] {
    const errors: string[] = []

    if (!config.enabled) {
      return errors // 無効化されている場合は検証をスキップ
    }

    // 接続設定の検証
    if (!config.connection.host) {
      errors.push('MQTT host is required')
    }

    if (config.connection.port <= 0 || config.connection.port > 65535) {
      errors.push('MQTT port must be between 1 and 65535')
    }

    if (!config.connection.clientId) {
      errors.push('MQTT client ID is required')
    }

    if (!['mqtt', 'websocket'].includes(config.connection.protocol)) {
      errors.push('MQTT protocol must be "mqtt" or "websocket"')
    }

    // WebSocket設定の検証
    if (
      config.connection.protocol === 'websocket' &&
      !config.connection.websocketPath
    ) {
      errors.push('WebSocket path is required when using websocket protocol')
    }

    // 購読設定の検証
    if (config.subscriptions.length === 0) {
      errors.push('At least one subscription topic is required')
    }

    for (const subscription of config.subscriptions) {
      if (!subscription.topic) {
        errors.push('Subscription topic cannot be empty')
      }
      if (![0, 1, 2].includes(subscription.qos)) {
        errors.push(`Invalid QoS level: ${subscription.qos}`)
      }
    }

    // 再接続設定の検証
    if (config.reconnect.enabled) {
      if (config.reconnect.initialDelay < 0) {
        errors.push('Reconnect initial delay must be non-negative')
      }
      if (config.reconnect.maxDelay < config.reconnect.initialDelay) {
        errors.push(
          'Reconnect max delay must be greater than or equal to initial delay'
        )
      }
      if (config.reconnect.maxAttempts < 0) {
        errors.push(
          'Reconnect max attempts must be non-negative (0 for unlimited)'
        )
      }
    } else {
      // 再接続が無効でも基本的なバリデーションは行う
      if (config.reconnect.initialDelay < 0) {
        errors.push('Reconnect initial delay must be non-negative')
      }
      if (config.reconnect.maxDelay < config.reconnect.initialDelay) {
        errors.push(
          'Reconnect max delay must be greater than or equal to initial delay'
        )
      }
      if (config.reconnect.maxAttempts < 0) {
        errors.push(
          'Reconnect max attempts must be non-negative (0 for unlimited)'
        )
      }
    }

    return errors
  }

  /**
   * 設定を環境変数形式の文字列として出力（デバッグ用）
   */
  static configToEnvString(config: MqttIntegrationConfig): string {
    const lines = [
      `NEXT_PUBLIC_MQTT_ENABLED=${config.enabled}`,
      `NEXT_PUBLIC_MQTT_HOST=${config.connection.host}`,
      `NEXT_PUBLIC_MQTT_PORT=${config.connection.port}`,
      `NEXT_PUBLIC_MQTT_CLIENT_ID=${config.connection.clientId}`,
      `NEXT_PUBLIC_MQTT_PROTOCOL=${config.connection.protocol}`,
    ]

    if (config.connection.websocketPath) {
      lines.push(
        `NEXT_PUBLIC_MQTT_WEBSOCKET_PATH=${config.connection.websocketPath}`
      )
    }

    if (config.connection.username) {
      lines.push(`NEXT_PUBLIC_MQTT_USERNAME=${config.connection.username}`)
    }

    if (config.connection.password) {
      lines.push(`NEXT_PUBLIC_MQTT_PASSWORD=***`)
    }

    if (config.connection.secure) {
      lines.push(`NEXT_PUBLIC_MQTT_SECURE=${config.connection.secure}`)
    }

    lines.push(
      `NEXT_PUBLIC_MQTT_RECONNECT_ENABLED=${config.reconnect.enabled}`,
      `NEXT_PUBLIC_MQTT_RECONNECT_INITIAL_DELAY=${config.reconnect.initialDelay}`,
      `NEXT_PUBLIC_MQTT_RECONNECT_MAX_DELAY=${config.reconnect.maxDelay}`,
      `NEXT_PUBLIC_MQTT_RECONNECT_MAX_ATTEMPTS=${config.reconnect.maxAttempts}`
    )

    return lines.join('\n')
  }
}
