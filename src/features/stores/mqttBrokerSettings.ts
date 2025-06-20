import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { type EmotionType } from '@/features/messages/messages'
import settingsStore from './settings'
import { generateAituberClientId } from '@/features/mqtt/utils/mqttClientIdGenerator'

/**
 * MQTT接続状態の型定義
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

/**
 * MQTT送信モードの型定義
 */
export type SendMode = 'direct_send' | 'ai_generated' | 'user_input'

/**
 * MQTTメッセージタイプの型定義
 */
export type MessageType = 'speech' | 'alert' | 'notification'

/**
 * MQTT優先度の型定義
 */
export type Priority = 'high' | 'medium' | 'low'

/**
 * MQTTブローカー拡張設定の型定義
 * settings.tsの基本設定に加えて、ブローカー固有の設定を提供
 */
interface MqttBrokerExtendedSettings {
  sendMode: SendMode
  // ペイロードオプション設定
  defaultMessageType: MessageType
  defaultPriority: Priority
  defaultEmotion: EmotionType | null
  includeTimestamp: boolean
  includeMetadata: boolean
}

/**
 * MQTTブローカー設定アクション
 */
interface MqttBrokerActions {
  updateMqttBrokerConfig: (config: Partial<MqttBrokerExtendedSettings>) => void
  generateNewClientId: () => void
  updateConnectionStatus: (status: ConnectionStatus) => void
  // 基本設定への便利アクセサ
  getBasicSettings: () => {
    enabled: boolean
    clientId: string
    host: string
    port: number
    protocol: 'mqtt' | 'websocket'
    websocketPath: string
    username?: string
    password?: string
    secure: boolean
    reconnectEnabled: boolean
    reconnectInitialDelay: number
    reconnectMaxDelay: number
    reconnectMaxAttempts: number
  }
  getBrokerUrl: () => string
  getConnectionStatus: () => ConnectionStatus
}

/**
 * MQTTブローカー設定ストア
 */
export type MqttBrokerStore = MqttBrokerExtendedSettings & MqttBrokerActions

/**
 * MQTTブローカー拡張設定のデフォルト値
 */
const defaultMqttBrokerSettings: MqttBrokerExtendedSettings = {
  sendMode: 'direct_send',
  // ペイロードオプションのデフォルト値（後方互換性を保つ）
  defaultMessageType: 'speech',
  defaultPriority: 'medium',
  defaultEmotion: null,
  includeTimestamp: false,
  includeMetadata: false,
}

/**
 * MQTTブローカー設定ストア
 *
 * AITuberでのMQTTブローカー統合拡張設定を管理するZustandストア
 * 基本設定はsettings.tsで管理し、ブローカー固有の設定のみを扱います。
 * localStorageに永続化されます。
 */
export const useMqttBrokerStore = create<MqttBrokerStore>()(
  persist(
    (set, get) => ({
      ...defaultMqttBrokerSettings,

      /**
       * MQTT拡張設定を更新
       */
      updateMqttBrokerConfig: (config: Partial<MqttBrokerExtendedSettings>) => {
        set((state) => ({
          ...state,
          ...config,
        }))
      },

      /**
       * 新しいAITuber形式のクライアントIDを生成（settings.tsに反映）
       */
      generateNewClientId: () => {
        const newClientId = generateAituberClientId()
        // settings.tsのmqttClientIdを更新
        settingsStore.setState({ mqttClientId: newClientId })
        return newClientId
      },

      /**
       * 接続状態を更新（settings.tsに反映）
       */
      updateConnectionStatus: (status: ConnectionStatus) => {
        // settings.tsのmqttConnectionStatusを更新
        settingsStore.setState({ mqttConnectionStatus: status })
      },

      /**
       * 基本設定を取得（settings.tsから）
       */
      getBasicSettings: () => {
        const settings = settingsStore.getState()
        return {
          enabled: settings.mqttEnabled,
          clientId: settings.mqttClientId,
          host: settings.mqttHost,
          port: settings.mqttPort,
          protocol: settings.mqttProtocol,
          websocketPath: settings.mqttWebsocketPath,
          username: settings.mqttUsername,
          password: settings.mqttPassword,
          secure: settings.mqttSecure,
          reconnectEnabled: settings.mqttReconnectEnabled,
          reconnectInitialDelay: settings.mqttReconnectInitialDelay,
          reconnectMaxDelay: settings.mqttReconnectMaxDelay,
          reconnectMaxAttempts: settings.mqttReconnectMaxAttempts,
        }
      },

      /**
       * ブローカーURLを生成
       */
      getBrokerUrl: () => {
        const settings = settingsStore.getState()
        const protocol =
          settings.mqttProtocol === 'websocket'
            ? settings.mqttSecure
              ? 'wss'
              : 'ws'
            : settings.mqttSecure
              ? 'mqtts'
              : 'mqtt'
        const baseUrl = `${protocol}://${settings.mqttHost}:${settings.mqttPort}`

        // WebSocketプロトコルの場合はパスを含める
        if (
          settings.mqttProtocol === 'websocket' &&
          settings.mqttWebsocketPath
        ) {
          return `${baseUrl}${settings.mqttWebsocketPath}`
        }

        return baseUrl
      },

      /**
       * 現在の接続状態を取得
       */
      getConnectionStatus: () => {
        const settings = settingsStore.getState()
        return settings.mqttConnectionStatus
      },
    }),
    {
      name: 'mqtt-broker-extended-settings',
      partialize: (state) => ({
        sendMode: state.sendMode,
        // ペイロードオプション設定を永続化
        defaultMessageType: state.defaultMessageType,
        defaultPriority: state.defaultPriority,
        defaultEmotion: state.defaultEmotion,
        includeTimestamp: state.includeTimestamp,
        includeMetadata: state.includeMetadata,
      }),
    }
  )
)

/**
 * 設定の妥当性をチェック
 */
export const validateMqttBrokerConfig = (): boolean => {
  const store = useMqttBrokerStore.getState()
  const basicSettings = store.getBasicSettings()
  const brokerUrl = store.getBrokerUrl()

  // URLフォーマットの基本チェック
  if (!brokerUrl.match(/^(mqtt|mqtts|ws|wss):\/\/.+/)) {
    return false
  }

  // ポート番号の範囲チェック
  if (basicSettings.port < 1 || basicSettings.port > 65535) {
    return false
  }

  // クライアントIDの存在チェック
  if (!basicSettings.clientId || basicSettings.clientId.trim().length === 0) {
    return false
  }

  // WebSocket設定の検証
  if (
    basicSettings.protocol === 'websocket' &&
    (!basicSettings.websocketPath ||
      basicSettings.websocketPath.trim().length === 0)
  ) {
    return false
  }

  return true
}

/**
 * MQTTブローカー設定をデフォルト値にリセット
 */
export const resetMqttBrokerSettings = () => {
  const store = useMqttBrokerStore.getState()

  // 拡張設定をリセット
  store.updateMqttBrokerConfig(defaultMqttBrokerSettings)

  // 基本設定もリセット（settings.ts）
  const newClientId = uuidv4()
  settingsStore.setState({
    mqttEnabled: false,
    mqttHost: 'localhost',
    mqttPort: 1883,
    mqttClientId: newClientId,
    mqttProtocol: 'websocket',
    mqttWebsocketPath: '/mqtt',
    mqttUsername: undefined,
    mqttPassword: undefined,
    mqttSecure: false,
    mqttConnectionStatus: 'disconnected',
    mqttReconnectEnabled: true,
    mqttReconnectInitialDelay: 1000,
    mqttReconnectMaxDelay: 30000,
    mqttReconnectMaxAttempts: 5,
  })
}

/**
 * 統合された設定情報を取得（デバッグ・表示用）
 */
export const getMqttIntegratedSettings = () => {
  const store = useMqttBrokerStore.getState()
  const basicSettings = store.getBasicSettings()

  return {
    // 基本設定
    ...basicSettings,
    brokerUrl: store.getBrokerUrl(),
    connectionStatus: store.getConnectionStatus(),
    // 拡張設定
    sendMode: store.sendMode,
    defaultMessageType: store.defaultMessageType,
    defaultPriority: store.defaultPriority,
    defaultEmotion: store.defaultEmotion,
    includeTimestamp: store.includeTimestamp,
    includeMetadata: store.includeMetadata,
  }
}
