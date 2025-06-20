import {
  useMqttBrokerStore,
  type ConnectionStatus,
  type SendMode,
  type MessageType,
  type Priority,
} from '@/features/stores/mqttBrokerSettings'
import settingsStore from '@/features/stores/settings'
import { type EmotionType } from '@/features/messages/messages'
import {
  analyzeMqttError,
  formatMqttError,
  diagnoseMqttConfig,
} from './utils/errorHandler'
import {
  generateAituberClientId,
  isAituberClientId,
  convertLegacyClientId,
} from './utils/mqttClientIdGenerator'
import { SpeechHandler } from './handlers/SpeechHandler'
import { SpeechPayload } from './types'

/**
 * MQTT接続テスト結果の型定義
 */
export interface MqttTestResult {
  success: boolean
  message: string
  latency?: number
  error?: Error
}

/**
 * MQTT接続設定の型定義
 */
export interface MqttConnectionConfig {
  brokerUrl: string
  brokerPort: number
  clientId: string
  username?: string
  password?: string
  secure?: boolean
}

/**
 * MQTTメッセージペイロードオプション
 */
export interface MqttPayloadOptions {
  messageType?: MessageType
  priority?: Priority
  emotion?: EmotionType | null
  includeTimestamp?: boolean
  includeMetadata?: boolean
}

/**
 * MQTT送信メッセージペイロード（構造化）
 */
export interface MqttMessagePayload {
  text: string
  type: MessageType
  priority: Priority
  emotion?: EmotionType
  timestamp?: string
  metadata?: {
    clientId: string
    sendMode: SendMode
    [key: string]: any
  }
}

/**
 * MQTT送信オプション
 */
export interface MqttSendOptions {
  topic?: string
  qos?: 0 | 1 | 2
  retain?: boolean
  payloadOptions?: MqttPayloadOptions
}

/**
 * MQTTブローカー統合サービス
 *
 * AITuberでのMQTTブローカー統合機能を提供するサービスクラス
 * 設定管理、接続テスト、および基本的なMQTT操作を提供します。
 */
export class MqttBrokerIntegration {
  private static instance: MqttBrokerIntegration | null = null
  private client: any = null // MQTT クライアント（動的にロード）
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private speechHandler: SpeechHandler

  private constructor() {
    // シングルトンパターン
    this.speechHandler = new SpeechHandler()
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MqttBrokerIntegration {
    if (!MqttBrokerIntegration.instance) {
      MqttBrokerIntegration.instance = new MqttBrokerIntegration()
    }
    return MqttBrokerIntegration.instance
  }

  /**
   * 接続設定の妥当性をチェック
   */
  public validateConfig(config: MqttConnectionConfig): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const store = useMqttBrokerStore.getState()
    const basicSettings = store.getBasicSettings()

    // 診断を実行
    const diagnostic = diagnoseMqttConfig({
      enabled: basicSettings.enabled,
      host: basicSettings.host,
      port: basicSettings.port,
      clientId: basicSettings.clientId,
      protocol: basicSettings.protocol,
      websocketPath: basicSettings.websocketPath,
      secure: basicSettings.secure,
      username: basicSettings.username,
      password: basicSettings.password,
    })

    // 追加のURLフォーマットチェック
    const urlRegex = /^(mqtt|mqtts|ws|wss):\/\/.+/
    if (!urlRegex.test(config.brokerUrl)) {
      diagnostic.issues.push(
        'ブローカーURLの形式が無効です（mqtt://, mqtts://, ws://, wss:// のいずれかで始まる必要があります）'
      )
    }

    return {
      valid: diagnostic.valid,
      errors: diagnostic.issues,
      warnings: diagnostic.warnings,
    }
  }

  /**
   * MQTTブローカーへの接続テスト
   */
  public async testConnection(
    config: MqttConnectionConfig
  ): Promise<MqttTestResult> {
    const startTime = Date.now()

    try {
      console.log('Starting MQTT connection test...')

      // 設定の妥当性をチェック
      const validation = this.validateConfig(config)
      if (!validation.valid) {
        console.error('Configuration validation failed:', validation.errors)
        throw new Error(`設定エラー: ${validation.errors.join(', ')}`)
      }

      // 警告がある場合はログ出力
      if (validation.warnings.length > 0) {
        console.warn('Configuration warnings:', validation.warnings)
      }

      // MQTTクライアントを動的にロード（ブラウザ環境対応）
      console.log('Loading MQTT client...')
      const mqtt = await this.loadMqttClient()
      if (!mqtt) {
        throw new Error(
          'MQTTクライアントを読み込めませんでした。ブラウザ環境でWebSocketをサポートしていない可能性があります。'
        )
      }

      // テスト用の一時的な接続を作成
      const testClientId = generateAituberClientId()
      console.log(`Creating test connection with client ID: ${testClientId}`)

      const client = await this.createTestConnection(mqtt, {
        ...config,
        clientId: testClientId,
      })

      // 接続成功
      const latency = Date.now() - startTime
      console.log(`Connection test successful in ${latency}ms`)

      // テスト接続を閉じる
      await this.closeTestConnection(client)

      return {
        success: true,
        message: `接続に成功しました (${latency}ms)`,
        latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      console.error('Connection test failed:', error)

      // エラーを分析して詳細な情報を提供
      const errorInfo = analyzeMqttError(error as Error)
      const detailedMessage = formatMqttError(errorInfo)

      return {
        success: false,
        message: detailedMessage,
        latency,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }
    }
  }

  /**
   * MQTTクライアントを動的にロード
   * ブラウザ環境では WebSocket経由でMQTTを使用
   */
  private async loadMqttClient(): Promise<any> {
    try {
      // 動的インポート（ブラウザ・Node.js共通）
      const mqtt = await import('mqtt')
      console.log('Successfully loaded MQTT client')
      // default export を確認してから返す
      return mqtt.default || mqtt
    } catch (error) {
      console.error('Failed to load MQTT client:', error)
      return null
    }
  }

  /**
   * テスト用の接続を作成
   */
  private async createTestConnection(
    mqtt: any,
    config: MqttConnectionConfig
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout (10s)'))
      }, 10000) // 10秒でタイムアウト

      try {
        // 接続オプションを構築
        const connectOptions: any = {
          clientId: config.clientId,
          connectTimeout: 5000,
          keepalive: 60,
          clean: true,
        }

        // 認証情報の設定
        if (config.username) {
          connectOptions.username = config.username
        }
        if (config.password) {
          connectOptions.password = config.password
        }

        // セキュア接続の設定
        if (config.secure) {
          connectOptions.rejectUnauthorized = false // 開発用、本番では適切な証明書設定が必要
        }

        // WebSocket特有の設定
        if (typeof window !== 'undefined') {
          // ブラウザ環境でのWebSocket設定
          connectOptions.transformWsUrl = (
            url: string,
            options: any,
            client: any
          ) => {
            console.log(`Transforming WebSocket URL: ${url}`)
            return url
          }
        }

        console.log(`Testing connection to: ${config.brokerUrl}`, {
          clientId: config.clientId,
          secure: config.secure,
          hasAuth: !!config.username,
        })

        // MQTTクライアントを作成
        const client = mqtt.connect(config.brokerUrl, connectOptions)

        client.on('connect', () => {
          console.log('Test connection established successfully')
          clearTimeout(timeoutId)
          resolve(client)
        })

        client.on('error', (error: Error) => {
          console.error('Test connection error:', error)
          clearTimeout(timeoutId)
          reject(error)
        })

        client.on('close', () => {
          console.log('Test connection closed')
        })

        client.on('offline', () => {
          console.log('Test connection went offline')
        })
      } catch (error) {
        console.error('Failed to create test connection:', error)
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  /**
   * テスト接続を閉じる
   */
  private async closeTestConnection(client: any): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (client && typeof client.end === 'function') {
          client.end(false, {}, () => {
            resolve()
          })
        } else {
          resolve()
        }
      } catch (error) {
        console.warn('Error closing test connection:', error)
        resolve()
      }
    })
  }

  /**
   * 接続状態の定期監視を開始
   */
  public startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      return // 既に監視中
    }

    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionStatus()
    }, 5000) // 5秒間隔で監視
  }

  /**
   * 接続状態の定期監視を停止
   */
  public stopConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }
  }

  /**
   * 現在の接続状態をチェック
   */
  private checkConnectionStatus(): void {
    const store = useMqttBrokerStore.getState()
    const basicSettings = store.getBasicSettings()

    if (!basicSettings.enabled) {
      store.updateConnectionStatus('disconnected')
      return
    }

    // 実際の接続状態をチェック
    if (this.client && this.client.connected) {
      store.updateConnectionStatus('connected')
    } else if (this.client && this.client.reconnecting) {
      store.updateConnectionStatus('connecting')
    } else {
      store.updateConnectionStatus('disconnected')
    }
  }

  /**
   * 設定から接続設定を構築
   */
  public buildConnectionConfig(): MqttConnectionConfig {
    const store = useMqttBrokerStore.getState()
    const basicSettings = store.getBasicSettings()

    // ClientIDの決定：既存の有効なIDがあればそれを使用、なければ新規生成
    let clientId: string
    if (basicSettings.clientId && isAituberClientId(basicSettings.clientId)) {
      // 既存の有効なAITuber形式のClientIDを使用
      clientId = basicSettings.clientId
      console.log(`MQTT: Using existing ClientID: ${clientId}`)
    } else {
      // 新規生成または既存IDを変換
      clientId = basicSettings.clientId
        ? convertLegacyClientId(basicSettings.clientId)
        : generateAituberClientId()
      console.log(`MQTT: Generated new ClientID: ${clientId}`)
      // 新しいClientIDをsettingsStoreに保存
      settingsStore.setState({ mqttClientId: clientId })
    }

    return {
      brokerUrl: store.getBrokerUrl(),
      brokerPort: basicSettings.port,
      clientId: clientId,
      username: basicSettings.username,
      password: basicSettings.password,
      secure: basicSettings.secure,
    }
  }

  /**
   * メッセージペイロードを生成
   * 後方互換性を保ちながら、新しいペイロード形式に対応
   */
  public generatePayload(
    text: string,
    options?: MqttPayloadOptions
  ): string | MqttMessagePayload {
    const store = useMqttBrokerStore.getState()

    // オプションが指定されていない場合はストア設定を使用
    const payloadOptions = {
      messageType: options?.messageType || store.defaultMessageType,
      priority: options?.priority || store.defaultPriority,
      emotion:
        options?.emotion !== undefined ? options.emotion : store.defaultEmotion,
      includeTimestamp:
        options?.includeTimestamp !== undefined
          ? options.includeTimestamp
          : store.includeTimestamp,
      includeMetadata:
        options?.includeMetadata !== undefined
          ? options.includeMetadata
          : store.includeMetadata,
    }

    // 後方互換性：direct_sendモードで追加オプションが使用されていない場合は文字列を返す
    if (
      store.sendMode === 'direct_send' &&
      this.isSimplePayload(payloadOptions)
    ) {
      return text
    }

    // 構造化ペイロードを生成
    const payload: MqttMessagePayload = {
      text,
      type: payloadOptions.messageType,
      priority: payloadOptions.priority,
    }

    // 感情設定
    if (payloadOptions.emotion) {
      payload.emotion = payloadOptions.emotion
    }

    // タイムスタンプ
    if (payloadOptions.includeTimestamp) {
      payload.timestamp = new Date().toISOString()
    }

    // メタデータ
    if (payloadOptions.includeMetadata) {
      const basicSettings = store.getBasicSettings()
      payload.metadata = {
        clientId: basicSettings.clientId,
        sendMode: store.sendMode,
        generatedAt: Date.now(),
      }
    }

    return payload
  }

  /**
   * シンプルペイロード（後方互換性）かどうかを判定
   */
  private isSimplePayload(options: Required<MqttPayloadOptions>): boolean {
    return (
      options.messageType === 'speech' &&
      options.priority === 'medium' &&
      options.emotion === null &&
      !options.includeTimestamp &&
      !options.includeMetadata
    )
  }

  /**
   * ペイロードを文字列に変換
   */
  public stringifyPayload(payload: string | MqttMessagePayload): string {
    if (typeof payload === 'string') {
      return payload
    }
    return JSON.stringify(payload)
  }

  /**
   * 文字列ペイロードをパース
   */
  public parsePayload(payloadString: string): string | MqttMessagePayload {
    try {
      const parsed = JSON.parse(payloadString)
      if (
        typeof parsed === 'object' &&
        parsed.text &&
        parsed.type &&
        parsed.priority
      ) {
        return parsed as MqttMessagePayload
      }
    } catch (error) {
      // JSON解析に失敗した場合は文字列として扱う
    }
    return payloadString
  }

  /**
   * リソースをクリーンアップ
   */
  public cleanup(): void {
    this.stopConnectionMonitoring()

    if (this.client) {
      try {
        this.client.end()
      } catch (error) {
        console.warn('Error during cleanup:', error)
      }
      this.client = null
    }
  }

  /**
   * MQTTブローカーに接続
   */
  public async connect(): Promise<boolean> {
    const store = useMqttBrokerStore.getState()
    const basicSettings = store.getBasicSettings()

    if (this.client && this.client.connected) {
      console.log('MQTT: Already connected to broker')
      return true
    }

    try {
      console.log('MQTT: Attempting to connect to broker...')

      store.updateConnectionStatus('connecting')

      const config = this.buildConnectionConfig()
      const validation = this.validateConfig(config)

      if (!validation.valid) {
        console.error(
          'MQTT: Connection failed - Configuration invalid:',
          validation.errors
        )
        store.updateConnectionStatus('disconnected')
        return false
      }

      // 詳細な接続情報をログ出力
      console.log('MQTT: Connection details:')
      console.log(
        `- Protocol: ${basicSettings.protocol === 'websocket' ? 'WebSocket' : 'MQTT'}`
      )
      console.log(`- URL: ${config.brokerUrl}`)
      console.log(`- ClientID: ${config.clientId}`)
      console.log(`- Topic: aituber/speech (QoS: 2)`)

      const mqtt = await this.loadMqttClient()
      if (!mqtt) {
        console.error('MQTT: Connection failed - Could not load MQTT client')
        store.updateConnectionStatus('disconnected')
        return false
      }

      const connectOptions: any = {
        clientId: config.clientId,
        connectTimeout: 10000,
        keepalive: 60,
        clean: true,
      }

      if (config.username) {
        connectOptions.username = config.username
      }
      if (config.password) {
        connectOptions.password = config.password
      }
      if (config.secure) {
        connectOptions.rejectUnauthorized = false
      }

      this.client = mqtt.connect(config.brokerUrl, connectOptions)

      return new Promise((resolve) => {
        this.client.on('connect', async () => {
          console.log('✅ MQTT: Successfully connected to broker')
          console.log('📡 MQTT: Connection established:')
          console.log(`- Broker: ${config.brokerUrl}`)
          console.log(`- ClientID: ${config.clientId}`)

          // 接続成功時にClientIDを確実に保存
          if (config.clientId !== basicSettings.clientId) {
            console.log(`MQTT: Saving updated ClientID: ${config.clientId}`)
            settingsStore.setState({ mqttClientId: config.clientId })
          }

          store.updateConnectionStatus('connected')
          this.startConnectionMonitoring()

          // MVP: 固定でaituber/speechトピックをサブスクライブ
          await this.subscribeToDefaultTopics()

          resolve(true)
        })

        this.client.on('error', (error: Error) => {
          console.error('❌ MQTT: Connection failed')
          console.error(`- Error: ${error.message}`)
          console.error(
            `- Protocol: ${basicSettings.protocol === 'websocket' ? 'WebSocket' : 'MQTT'}`
          )
          console.error(`- Broker: ${config.brokerUrl}`)
          console.error(`- ClientID: ${config.clientId}`)
          console.error(`- Topic: aituber/speech (QoS: 2)`)
          store.updateConnectionStatus('disconnected')
          resolve(false)
        })

        this.client.on('close', () => {
          console.log('📡 MQTT: Connection closed')
          store.updateConnectionStatus('disconnected')
        })

        this.client.on('offline', () => {
          console.log('🔌 MQTT: Client went offline')
          store.updateConnectionStatus('disconnected')
        })

        this.client.on('reconnect', () => {
          console.log('🔄 MQTT: Attempting to reconnect...')
          store.updateConnectionStatus('connecting')
        })

        setTimeout(() => {
          if (!this.client || !this.client.connected) {
            console.error('❌ MQTT: Connection timeout (10s)')
            console.error(
              `- Protocol: ${basicSettings.protocol === 'websocket' ? 'WebSocket' : 'MQTT'}`
            )
            console.error(`- Broker: ${config.brokerUrl}`)
            console.error(`- ClientID: ${config.clientId}`)
            console.error(
              '- Please check broker availability and network connectivity'
            )
            store.updateConnectionStatus('disconnected')
            resolve(false)
          }
        }, 10000)
      })
    } catch (error) {
      console.error('❌ MQTT: Connection failed with exception:', error)
      store.updateConnectionStatus('disconnected')
      return false
    }
  }

  /**
   * MQTTブローカーから切断
   */
  public async disconnect(): Promise<void> {
    const store = useMqttBrokerStore.getState()
    const basicSettings = store.getBasicSettings()

    console.log('MQTT: Disconnecting from broker...')
    console.log(
      `- Protocol: ${basicSettings.protocol === 'websocket' ? 'WebSocket' : 'MQTT'}`
    )
    console.log(`- Broker: ${store.getBrokerUrl()}`)
    if (this.client && this.client.options) {
      console.log(`- ClientID: ${this.client.options.clientId}`)
    } else {
      console.log(`- ClientID: ${basicSettings.clientId}`)
    }

    this.stopConnectionMonitoring()

    if (this.client) {
      return new Promise((resolve) => {
        try {
          this.client.end(false, {}, () => {
            console.log('✅ MQTT: Successfully disconnected from broker')
            this.client = null
            const store = useMqttBrokerStore.getState()
            store.updateConnectionStatus('disconnected')
            resolve()
          })
        } catch (error) {
          console.warn('⚠️ MQTT: Error during disconnection:', error)
          this.client = null
          const store = useMqttBrokerStore.getState()
          store.updateConnectionStatus('disconnected')
          resolve()
        }
      })
    } else {
      console.log('MQTT: Already disconnected')
      const store = useMqttBrokerStore.getState()
      store.updateConnectionStatus('disconnected')
    }
  }

  /**
   * MQTT機能のON/OFF切り替え
   */
  public async toggleConnection(enabled: boolean): Promise<boolean> {
    console.log(`MQTT: Toggling connection - ${enabled ? 'ON' : 'OFF'}`)

    if (enabled) {
      return await this.connect()
    } else {
      await this.disconnect()
      return true
    }
  }

  /**
   * 統合サービスの初期化
   */
  public async initialize(): Promise<void> {
    const store = useMqttBrokerStore.getState()
    const basicSettings = store.getBasicSettings()

    console.log('MQTT: Initializing MQTT Broker Integration...')
    console.log('MQTT: Initial settings:', {
      enabled: basicSettings.enabled,
      brokerUrl: store.getBrokerUrl(),
      sendMode: store.sendMode,
    })

    if (basicSettings.enabled) {
      console.log('MQTT: MQTT function is enabled, attempting connection...')
      await this.connect()
    } else {
      console.log('MQTT: MQTT function is disabled')
    }
  }

  /**
   * 統合サービスの終了処理
   */
  public async shutdown(): Promise<void> {
    this.cleanup()
  }

  /**
   * MVP: デフォルトトピックをサブスクライブ
   * 固定でaituber/speechトピックをQoS2でサブスクライブ
   */
  private async subscribeToDefaultTopics(): Promise<void> {
    if (!this.client || !this.client.connected) {
      console.warn('⚠️ MQTT: Cannot subscribe - client not connected')
      return
    }

    const topic = 'aituber/speech'
    const qos = 2

    try {
      console.log(
        `📡 MQTT: Subscribing to default topic '${topic}' with QoS ${qos}...`
      )

      await new Promise<void>((resolve, reject) => {
        this.client.subscribe(topic, { qos }, (error: Error | null) => {
          if (error) {
            console.error(
              `❌ MQTT: Failed to subscribe to topic '${topic}':`,
              error.message
            )
            reject(error)
          } else {
            console.log(
              `✅ MQTT: Successfully subscribed to topic '${topic}' (QoS: ${qos})`
            )
            resolve()
          }
        })
      })

      // メッセージ受信ハンドラーを設定（一度だけ）
      if (!this.client.listenerCount('message')) {
        this.client.on(
          'message',
          async (receivedTopic: string, message: Buffer) => {
            await this.handleReceivedMessage(receivedTopic, message)
          }
        )
        console.log('📩 MQTT: Message handler registered')
      }
    } catch (error) {
      console.error(`❌ MQTT: Subscription error for topic '${topic}':`, error)
    }
  }

  /**
   * 受信メッセージの処理
   * SpeechHandlerを使用して音声合成・発話を実行
   */
  private async handleReceivedMessage(
    topic: string,
    message: Buffer
  ): Promise<void> {
    try {
      const messageStr = message.toString()
      console.log(`📬 MQTT: Received message on topic '${topic}':`, messageStr)

      // JSONメッセージの解析
      let parsedMessage: any
      try {
        parsedMessage = JSON.parse(messageStr)
        console.log('📝 MQTT: Parsed message:', parsedMessage)
      } catch (parseError) {
        console.log('📄 MQTT: Plain text message (invalid JSON):', messageStr)
        console.warn(
          '⚠️ MQTT: Message is not valid JSON, skipping speech processing'
        )
        return
      }

      // SpeechPayload形式に変換
      const speechPayload: SpeechPayload = {
        id: parsedMessage.id || `mqtt-${Date.now()}`,
        text: parsedMessage.text || messageStr,
        type: parsedMessage.type || 'speech',
        emotion: parsedMessage.emotion || undefined,
        priority: parsedMessage.priority || 'medium',
        timestamp: parsedMessage.timestamp || new Date().toISOString(),
      }

      console.log('🎤 MQTT: Processing speech payload:', speechPayload)

      // SpeechHandlerで音声合成・発話を実行
      const result = await this.speechHandler.handleSpeechPayload(speechPayload)

      if (result.success) {
        console.log(
          `✅ MQTT: Speech processing successful for message: ${result.messageId}`
        )
      } else {
        console.error(
          `❌ MQTT: Speech processing failed for message: ${result.messageId}`,
          result.error
        )
      }
    } catch (error) {
      console.error('❌ MQTT: Error handling received message:', error)
    }
  }
}

/**
 * デフォルトのMQTTブローカー統合インスタンス
 */
export const mqttBrokerIntegration = MqttBrokerIntegration.getInstance()
