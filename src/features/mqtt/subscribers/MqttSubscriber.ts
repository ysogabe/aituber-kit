import mqtt, { MqttClient, IClientOptions } from 'mqtt'
import {
  MqttConfig,
  MqttConnectionStatus,
  SpeechPayload,
  MqttIntegrationEvents,
  MqttSubscription,
} from '../types'

/**
 * MQTT購読者クラス
 * MCP Serverからの発話指示を受信し、AITuberKitの発話システムに連携する
 */
export class MqttSubscriber {
  private client: MqttClient | null = null
  private config: MqttConfig
  private subscriptions: MqttSubscription[]
  private connectionStatus: MqttConnectionStatus = 'disconnected'
  private eventHandlers: Partial<MqttIntegrationEvents> = {}
  private reconnectAttempts = 0
  private maxReconnectAttempts: number
  private reconnectDelay: number
  private maxReconnectDelay: number

  constructor(
    config: MqttConfig,
    subscriptions: MqttSubscription[] = [],
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000
  ) {
    this.config = config
    this.subscriptions = subscriptions
    this.maxReconnectAttempts = maxReconnectAttempts
    this.reconnectDelay = reconnectDelay
    this.maxReconnectDelay = maxReconnectDelay
  }

  /**
   * イベントハンドラーを登録
   */
  on<K extends keyof MqttIntegrationEvents>(
    event: K,
    handler: MqttIntegrationEvents[K]
  ): void {
    this.eventHandlers[event] = handler
  }

  /**
   * イベントを発火
   */
  private emit<K extends keyof MqttIntegrationEvents>(
    event: K,
    ...args: Parameters<MqttIntegrationEvents[K]>
  ): void {
    const handler = this.eventHandlers[event]
    if (handler) {
      // @ts-ignore - TypeScriptの型推論の制限による
      handler(...args)
    }
  }

  /**
   * MQTT接続を開始
   */
  async connect(): Promise<void> {
    if (this.client) {
      console.warn('MQTT client is already connected or connecting')
      return
    }

    try {
      this.setConnectionStatus('connecting')

      const clientOptions: IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 0, // 自動再接続は無効化（独自実装）
      }

      // 認証情報がある場合は追加
      if (this.config.username) {
        clientOptions.username = this.config.username
      }
      if (this.config.password) {
        clientOptions.password = this.config.password
      }

      // SSL/TLS設定
      if (this.config.secure) {
        clientOptions.rejectUnauthorized = false // 開発用。本番では適切な証明書を使用
      }

      // 接続URLを構築
      const protocol =
        this.config.protocol === 'websocket'
          ? this.config.secure
            ? 'wss'
            : 'ws'
          : this.config.secure
            ? 'mqtts'
            : 'mqtt'

      let connectUrl = `${protocol}://${this.config.host}:${this.config.port}`

      // WebSocketの場合はパスを追加
      if (this.config.protocol === 'websocket' && this.config.websocketPath) {
        connectUrl += this.config.websocketPath
      }

      console.log(`Connecting to MQTT broker: ${connectUrl}`, {
        clientId: this.config.clientId,
        authenticated: !!this.config.username,
        secure: this.config.secure,
        protocol: this.config.protocol,
      })

      this.client = mqtt.connect(connectUrl, clientOptions)

      this.setupEventHandlers()

      // 接続完了を待機
      await new Promise<void>((resolve, reject) => {
        const connectTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 15000)

        this.client!.once('connect', () => {
          clearTimeout(connectTimeout)
          resolve()
        })

        this.client!.once('error', (error) => {
          clearTimeout(connectTimeout)
          reject(error)
        })
      })

      // 購読を開始
      await this.subscribeToTopics()

      this.reconnectAttempts = 0 // 接続成功時はリセット
    } catch (error) {
      console.error('Failed to connect to MQTT broker:', error)
      this.setConnectionStatus('error')
      this.emit('error', error as Error, 'connection')

      // 再接続を試行
      if (this.shouldRetryConnection()) {
        await this.scheduleReconnect()
      }

      throw error
    }
  }

  /**
   * MQTT接続を切断
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      // 購読を解除
      for (const subscription of this.subscriptions) {
        if (subscription.active) {
          await this.unsubscribeFromTopic(subscription.topic)
        }
      }

      // クライアントを切断
      await new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => {
          resolve()
        })
      })

      this.client = null
      this.setConnectionStatus('disconnected')
    } catch (error) {
      console.error('Error during MQTT disconnect:', error)
      this.emit('error', error as Error, 'disconnection')
    }
  }

  /**
   * 接続状態を取得
   */
  getConnectionStatus(): MqttConnectionStatus {
    return this.connectionStatus
  }

  /**
   * 接続状態を設定
   */
  private setConnectionStatus(status: MqttConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      this.emit('connectionStatusChanged', status)
    }
  }

  /**
   * MQTTクライアントのイベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    if (!this.client) return

    this.client.on('connect', () => {
      const protocol =
        this.config.protocol === 'websocket'
          ? this.config.secure
            ? 'wss'
            : 'ws'
          : this.config.secure
            ? 'mqtts'
            : 'mqtt'

      console.log('✅ MQTT Subscriber: Connected to MQTT broker', {
        host: this.config.host,
        port: this.config.port,
        protocol: protocol,
        clientId: this.config.clientId,
        secure: this.config.secure,
        subscriptions: this.subscriptions.filter((sub) => sub.active).length,
      })
      this.setConnectionStatus('connected')
    })

    this.client.on('message', (topic: string, message: Buffer) => {
      this.handleMessage(topic, message)
    })

    this.client.on('error', (error: Error) => {
      console.error('MQTT client error:', error)
      this.setConnectionStatus('error')
      this.emit('error', error, 'client')
    })

    this.client.on('close', () => {
      console.log('MQTT connection closed')
      this.setConnectionStatus('disconnected')

      // 意図しない切断の場合は再接続を試行
      if (this.shouldRetryConnection()) {
        this.scheduleReconnect()
      }
    })

    this.client.on('offline', () => {
      console.log('MQTT client offline')
      this.setConnectionStatus('disconnected')
    })
  }

  /**
   * トピックに購読
   */
  private async subscribeToTopics(): Promise<void> {
    if (!this.client) return

    console.log('🔗 MQTT: Starting topic subscriptions...')
    console.log(
      `MQTT: Total subscriptions configured: ${this.subscriptions.length}`
    )

    const activeSubscriptions = this.subscriptions.filter((sub) => sub.active)
    console.log(`MQTT: Active subscriptions: ${activeSubscriptions.length}`)

    if (activeSubscriptions.length === 0) {
      console.warn('⚠️ MQTT: No active subscriptions found')
      return
    }

    for (const subscription of activeSubscriptions) {
      try {
        console.log(
          `📡 MQTT: Subscribing to topic '${subscription.topic}' with QoS ${subscription.qos}...`
        )

        await new Promise<void>((resolve, reject) => {
          this.client!.subscribe(
            subscription.topic,
            { qos: subscription.qos },
            (error) => {
              if (error) {
                console.error(
                  `❌ MQTT: Failed to subscribe to topic '${subscription.topic}':`,
                  error.message
                )
                reject(error)
              } else {
                console.log(
                  `✅ MQTT: Successfully subscribed to topic '${subscription.topic}' (QoS: ${subscription.qos})`
                )
                resolve()
              }
            }
          )
        })
      } catch (error) {
        console.error(
          `❌ MQTT: Subscription error for topic '${subscription.topic}':`,
          error
        )
        this.emit('error', error as Error, `subscription:${subscription.topic}`)
      }
    }

    console.log('🎯 MQTT: Topic subscription process completed')
  }

  /**
   * トピックから購読解除
   */
  private async unsubscribeFromTopic(topic: string): Promise<void> {
    if (!this.client) return

    try {
      console.log(`🔌 MQTT: Unsubscribing from topic '${topic}'...`)

      await new Promise<void>((resolve, reject) => {
        this.client!.unsubscribe(topic, (error) => {
          if (error) {
            console.error(
              `❌ MQTT: Failed to unsubscribe from topic '${topic}':`,
              error.message
            )
            reject(error)
          } else {
            console.log(
              `✅ MQTT: Successfully unsubscribed from topic '${topic}'`
            )
            resolve()
          }
        })
      })
    } catch (error) {
      console.error(
        `❌ MQTT: Unsubscription error for topic '${topic}':`,
        error
      )
      this.emit('error', error as Error, `unsubscription:${topic}`)
    }
  }

  /**
   * 受信メッセージを処理
   */
  private handleMessage(topic: string, message: Buffer): void {
    try {
      const messageStr = message.toString()
      console.log(`Received message on topic ${topic}:`, messageStr)

      // JSONパースを試行
      let payload: SpeechPayload
      try {
        payload = JSON.parse(messageStr)
      } catch (parseError) {
        console.error('Failed to parse message JSON:', parseError)
        this.emit(
          'error',
          new Error(`Invalid JSON in message: ${parseError}`),
          `message-parse:${topic}`
        )
        return
      }

      // ペイロードの検証
      if (!this.validateSpeechPayload(payload)) {
        console.error('Invalid speech payload:', payload)
        this.emit(
          'error',
          new Error('Invalid speech payload format'),
          `message-validate:${topic}`
        )
        return
      }

      // メッセージ受信イベントを発火
      this.emit('messageReceived', topic, payload)
    } catch (error) {
      console.error('Error handling MQTT message:', error)
      this.emit('error', error as Error, `message-handle:${topic}`)
    }
  }

  /**
   * 発話ペイロードの妥当性を検証
   */
  private validateSpeechPayload(payload: any): payload is SpeechPayload {
    return (
      typeof payload === 'object' &&
      typeof payload.id === 'string' &&
      typeof payload.text === 'string' &&
      ['speech', 'alert', 'notification'].includes(payload.type) &&
      ['high', 'medium', 'low'].includes(payload.priority) &&
      typeof payload.timestamp === 'string'
    )
  }

  /**
   * 再接続を試行するかどうかを判定
   */
  private shouldRetryConnection(): boolean {
    return (
      this.maxReconnectAttempts === 0 ||
      this.reconnectAttempts < this.maxReconnectAttempts
    )
  }

  /**
   * 再接続をスケジュール
   */
  private async scheduleReconnect(): Promise<void> {
    this.reconnectAttempts++

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    )

    console.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    )

    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('Reconnect attempt failed:', error)
      }
    }, delay)
  }

  /**
   * 購読設定を更新
   */
  updateSubscriptions(subscriptions: MqttSubscription[]): void {
    const oldActiveCount = this.subscriptions.filter((sub) => sub.active).length
    this.subscriptions = subscriptions
    const newActiveCount = this.subscriptions.filter((sub) => sub.active).length

    console.log('🔄 MQTT: Updating subscription settings', {
      previousActiveSubscriptions: oldActiveCount,
      newActiveSubscriptions: newActiveCount,
      connected: this.connectionStatus === 'connected',
    })

    // 新しいサブスクリプションの詳細をログ出力
    if (newActiveCount > 0) {
      console.log(
        'MQTT: Active subscription topics:',
        this.subscriptions
          .filter((sub) => sub.active)
          .map((sub) => `${sub.topic} (QoS: ${sub.qos})`)
      )
    }

    // 接続中の場合は購読を更新
    if (this.connectionStatus === 'connected') {
      console.log('MQTT: Resubscribing to updated topics...')
      this.subscribeToTopics()
    }
  }
}
