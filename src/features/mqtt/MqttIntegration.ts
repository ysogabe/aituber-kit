import { MqttSubscriber } from './subscribers/MqttSubscriber'
import { SpeechHandler } from './handlers/SpeechHandler'
import {
  MqttIntegrationConfig,
  MqttConnectionStatus,
  SpeechPayload,
  MqttMessageHandleResult,
  MqttSubscription,
} from './types'

/**
 * MQTT統合の中心となるコントローラクラス
 * MCP Server からの MQTT メッセージを受信し、AITuber の発話システムに統合する
 */
export class MqttIntegration {
  private subscriber: MqttSubscriber | null = null
  private speechHandler: SpeechHandler
  private config: MqttIntegrationConfig | null = null
  private isInitialized = false

  constructor() {
    this.speechHandler = new SpeechHandler()
  }

  /**
   * MQTT統合を初期化
   */
  async initialize(config: MqttIntegrationConfig): Promise<void> {
    try {
      console.log('Initializing MQTT integration with config:', config)

      this.config = config

      if (!config.enabled) {
        console.log('MQTT integration is disabled')
        return
      }

      // MQTTサブスクライバーを初期化
      this.subscriber = new MqttSubscriber(
        config.connection,
        config.subscriptions,
        config.reconnect.maxAttempts,
        config.reconnect.initialDelay,
        config.reconnect.maxDelay
      )

      // イベントハンドラーを設定
      this.setupEventHandlers()

      // 接続を開始
      if (config.reconnect.enabled) {
        await this.subscriber.connect()
      }

      this.isInitialized = true
      console.log('MQTT integration initialized successfully')
    } catch (error) {
      console.error('Failed to initialize MQTT integration:', error)
      throw error
    }
  }

  /**
   * イベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    if (!this.subscriber) return

    // 接続状態変更の処理
    this.subscriber.on(
      'connectionStatusChanged',
      (status: MqttConnectionStatus) => {
        console.log(`MQTT connection status changed: ${status}`)
        this.handleConnectionStatusChange(status)
      }
    )

    // メッセージ受信の処理
    this.subscriber.on(
      'messageReceived',
      async (topic: string, payload: SpeechPayload) => {
        console.log(`MQTT message received on topic ${topic}:`, payload)
        await this.handleReceivedMessage(topic, payload)
      }
    )

    // メッセージ処理完了の処理
    this.subscriber.on(
      'messageProcessed',
      (result: MqttMessageHandleResult) => {
        console.log('MQTT message processed:', result)
        this.handleMessageProcessed(result)
      }
    )

    // エラーの処理
    this.subscriber.on('error', (error: Error, context?: string) => {
      console.error(`MQTT error${context ? ` (${context})` : ''}:`, error)
      this.handleError(error, context)
    })
  }

  /**
   * 接続状態変更を処理
   */
  private handleConnectionStatusChange(status: MqttConnectionStatus): void {
    switch (status) {
      case 'connected':
        console.log('MQTT connection established')
        break
      case 'connecting':
        console.log('Connecting to MQTT broker...')
        break
      case 'disconnected':
        console.log('MQTT connection lost')
        break
      case 'error':
        console.error('MQTT connection error')
        break
    }
  }

  /**
   * 受信メッセージを処理
   */
  private async handleReceivedMessage(
    topic: string,
    payload: SpeechPayload
  ): Promise<void> {
    try {
      // 発話ハンドラーでメッセージを処理
      const result = await this.speechHandler.handleSpeechPayload(payload)

      // 処理結果をログ出力
      if (result.success) {
        console.log(
          `Successfully processed speech message: ${result.messageId}`
        )
      } else {
        console.error(`Failed to process speech message: ${result.error}`)
      }

      // 処理完了をログ出力（イベントはsubscriberが自動で発火）
    } catch (error) {
      console.error('Error handling received MQTT message:', error)

      // エラー処理
      await this.speechHandler.handleError(error as Error, payload)
    }
  }

  /**
   * メッセージ処理完了を処理
   */
  private handleMessageProcessed(result: MqttMessageHandleResult): void {
    // 処理結果に基づく追加の処理があれば実装
    if (!result.success && result.error) {
      console.warn(`Message processing failed: ${result.error}`)
    }
  }

  /**
   * エラーを処理
   */
  private async handleError(error: Error, context?: string): Promise<void> {
    console.error(
      `MQTT Integration Error${context ? ` (${context})` : ''}:`,
      error
    )

    // 重要なエラーの場合は発話で通知
    if (context && ['connection', 'client'].includes(context)) {
      try {
        await this.speechHandler.handleError(error)
      } catch (speechError) {
        console.error('Failed to speak error notification:', speechError)
      }
    }
  }

  /**
   * 統合を開始
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MQTT integration is not initialized')
    }

    if (!this.config?.enabled) {
      console.log('MQTT integration is disabled')
      return
    }

    if (!this.subscriber) {
      throw new Error('MQTT subscriber is not available')
    }

    try {
      await this.subscriber.connect()
      console.log('MQTT integration started')
    } catch (error) {
      console.error('Failed to start MQTT integration:', error)
      throw error
    }
  }

  /**
   * 統合を停止
   */
  async stop(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.disconnect()
      console.log('MQTT integration stopped')
    }
  }

  /**
   * 現在の接続状態を取得
   */
  getConnectionStatus(): MqttConnectionStatus {
    return this.subscriber?.getConnectionStatus() || 'disconnected'
  }

  /**
   * 設定を更新
   */
  async updateConfig(newConfig: MqttIntegrationConfig): Promise<void> {
    console.log('Updating MQTT integration config:', newConfig)

    // 既存の接続を停止
    if (this.isInitialized) {
      await this.stop()
    }

    // 新しい設定で再初期化
    await this.initialize(newConfig)

    // 有効な場合は再開
    if (newConfig.enabled) {
      await this.start()
    }
  }

  /**
   * 購読設定を更新
   */
  updateSubscriptions(subscriptions: MqttSubscription[]): void {
    if (this.subscriber) {
      this.subscriber.updateSubscriptions(subscriptions)
    }

    if (this.config) {
      this.config.subscriptions = subscriptions
    }
  }

  /**
   * 統合状態の情報を取得
   */
  getStatus(): {
    initialized: boolean
    enabled: boolean
    connectionStatus: MqttConnectionStatus
    subscriptions: MqttSubscription[]
  } {
    return {
      initialized: this.isInitialized,
      enabled: this.config?.enabled || false,
      connectionStatus: this.getConnectionStatus(),
      subscriptions: this.config?.subscriptions || [],
    }
  }

  /**
   * リソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up MQTT integration')

    await this.stop()
    this.speechHandler.cleanup()
    this.subscriber = null
    this.config = null
    this.isInitialized = false

    console.log('MQTT integration cleanup completed')
  }
}
