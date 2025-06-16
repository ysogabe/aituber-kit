import { useMqttBrokerStore, type ConnectionStatus, type SendMode, type MessageType, type Priority } from '@/features/stores/mqttBrokerSettings'
import { type EmotionType } from '@/features/messages/messages'

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

  private constructor() {
    // シングルトンパターン
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
  public validateConfig(config: MqttConnectionConfig): boolean {
    // ブローカーURLの形式チェック
    const urlRegex = /^(mqtt|mqtts|ws|wss):\/\/.+/
    if (!urlRegex.test(config.brokerUrl)) {
      return false
    }

    // ポート番号の範囲チェック
    if (config.brokerPort < 1 || config.brokerPort > 65535) {
      return false
    }

    // クライアントIDの存在チェック
    if (!config.clientId || config.clientId.trim().length === 0) {
      return false
    }

    return true
  }

  /**
   * MQTTブローカーへの接続テスト
   */
  public async testConnection(config: MqttConnectionConfig): Promise<MqttTestResult> {
    const startTime = Date.now()
    
    try {
      // 設定の妥当性をチェック
      if (!this.validateConfig(config)) {
        throw new Error('Invalid MQTT configuration')
      }

      // MQTTクライアントを動的にロード（ブラウザ環境対応）
      const mqtt = await this.loadMqttClient()
      if (!mqtt) {
        throw new Error('MQTT client could not be loaded')
      }

      // テスト用の一時的な接続を作成
      const testClientId = `${config.clientId}_test_${Date.now()}`
      const client = await this.createTestConnection(mqtt, {
        ...config,
        clientId: testClientId,
      })

      // 接続成功
      const latency = Date.now() - startTime
      
      // テスト接続を閉じる
      await this.closeTestConnection(client)

      return {
        success: true,
        message: `Connection successful (${latency}ms)`,
        latency,
      }

    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      // ブラウザ環境での動的インポート
      if (typeof window !== 'undefined') {
        // WebSocket経由でMQTTを使用する場合の実装
        // 実際の実装では mqtt.js のWebSocket版を使用
        return null // TODO: WebSocket MQTT クライアントを実装
      }
      
      // Node.js環境での動的インポート
      const mqtt = await import('mqtt')
      return mqtt
    } catch (error) {
      console.error('Failed to load MQTT client:', error)
      return null
    }
  }

  /**
   * テスト用の接続を作成
   */
  private async createTestConnection(mqtt: any, config: MqttConnectionConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000) // 10秒でタイムアウト

      try {
        // 接続オプションを構築
        const connectOptions: any = {
          clientId: config.clientId,
          connectTimeout: 5000,
          keepalive: 60,
        }

        if (config.username) {
          connectOptions.username = config.username
        }
        if (config.password) {
          connectOptions.password = config.password
        }

        // MQTTクライアントを作成
        const client = mqtt.connect(config.brokerUrl, connectOptions)

        client.on('connect', () => {
          clearTimeout(timeoutId)
          resolve(client)
        })

        client.on('error', (error: Error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
      } catch (error) {
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
    
    if (!store.enabled) {
      store.updateConnectionStatus('disconnected')
      return
    }

    // TODO: 実際の接続状態をチェックするロジックを実装
    // 現在はモック実装
    if (this.client && this.client.connected) {
      store.updateConnectionStatus('connected')
    } else {
      store.updateConnectionStatus('disconnected')
    }
  }

  /**
   * 設定から接続設定を構築
   */
  public buildConnectionConfig(): MqttConnectionConfig {
    const store = useMqttBrokerStore.getState()
    
    return {
      brokerUrl: store.brokerUrl,
      brokerPort: store.brokerPort,
      clientId: store.clientId,
    }
  }

  /**
   * メッセージペイロードを生成
   * 後方互換性を保ちながら、新しいペイロード形式に対応
   */
  public generatePayload(text: string, options?: MqttPayloadOptions): string | MqttMessagePayload {
    const store = useMqttBrokerStore.getState()
    
    // オプションが指定されていない場合はストア設定を使用
    const payloadOptions = {
      messageType: options?.messageType || store.defaultMessageType,
      priority: options?.priority || store.defaultPriority,
      emotion: options?.emotion !== undefined ? options.emotion : store.defaultEmotion,
      includeTimestamp: options?.includeTimestamp !== undefined ? options.includeTimestamp : store.includeTimestamp,
      includeMetadata: options?.includeMetadata !== undefined ? options.includeMetadata : store.includeMetadata,
    }

    // 後方互換性：direct_sendモードで追加オプションが使用されていない場合は文字列を返す
    if (store.sendMode === 'direct_send' && this.isSimplePayload(payloadOptions)) {
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
      payload.metadata = {
        clientId: store.clientId,
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
      if (typeof parsed === 'object' && parsed.text && parsed.type && parsed.priority) {
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
   * 統合サービスの初期化
   */
  public async initialize(): Promise<void> {
    const store = useMqttBrokerStore.getState()
    
    if (store.enabled) {
      this.startConnectionMonitoring()
    }
  }

  /**
   * 統合サービスの終了処理
   */
  public async shutdown(): Promise<void> {
    this.cleanup()
  }
}

/**
 * デフォルトのMQTTブローカー統合インスタンス
 */
export const mqttBrokerIntegration = MqttBrokerIntegration.getInstance()