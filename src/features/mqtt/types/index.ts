/**
 * MQTT Speech Integration Types
 * MCP Server から AITuber Kit への発話指示に関する型定義
 */

/**
 * MQTT経由で受信する発話ペイロード
 */
export interface SpeechPayload {
  /** ユニークなメッセージID */
  id: string
  /** 発話テキスト */
  text: string
  /** 発話タイプ */
  type: 'speech' | 'alert' | 'notification'
  /** 優先度（高い方が先に再生される） */
  priority: 'high' | 'medium' | 'low'
  /** タイムスタンプ（ISO 8601形式） */
  timestamp: string
  /** 発話者名（オプション） */
  speaker?: string
  /** 感情表現（Live2D/VRM用） */
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'relaxed' | 'surprised'
  /** 追加メタデータ */
  metadata?: Record<string, any>
}

/**
 * MQTT接続設定
 */
export interface MqttConfig {
  /** MQTTブローカーのホスト */
  host: string
  /** MQTTブローカーのポート */
  port: number
  /** MQTTクライアントID */
  clientId: string
  /** 接続プロトコル */
  protocol: 'mqtt' | 'websocket'
  /** WebSocketエンドポイントパス */
  websocketPath?: string
  /** 認証情報 */
  username?: string
  password?: string
  /** SSL/TLS設定 */
  secure?: boolean
}

/**
 * MQTT接続状態
 */
export type MqttConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

/**
 * MQTT購読トピック設定
 */
export interface MqttSubscription {
  /** トピック名 */
  topic: string
  /** QoSレベル */
  qos: 0 | 1 | 2
  /** 購読がアクティブかどうか */
  active: boolean
}

/**
 * MQTT統合設定
 */
export interface MqttIntegrationConfig {
  /** MQTT統合機能の有効/無効 */
  enabled: boolean
  /** MQTT接続設定 */
  connection: MqttConfig
  /** 購読するトピック一覧 */
  subscriptions: MqttSubscription[]
  /** 再接続設定 */
  reconnect: {
    /** 再接続を試行するかどうか */
    enabled: boolean
    /** 初回再接続までの待機時間（ミリ秒） */
    initialDelay: number
    /** 最大再接続待機時間（ミリ秒） */
    maxDelay: number
    /** 再接続試行回数（0で無制限） */
    maxAttempts: number
  }
}

/**
 * MQTT メッセージハンドラーの戻り値
 */
export interface MqttMessageHandleResult {
  /** 処理が成功したかどうか */
  success: boolean
  /** エラーメッセージ（失敗時） */
  error?: string
  /** 処理されたメッセージID */
  messageId?: string
}

/**
 * MQTT統合イベント
 */
export interface MqttIntegrationEvents {
  /** 接続状態変更 */
  connectionStatusChanged: (status: MqttConnectionStatus) => void
  /** メッセージ受信 */
  messageReceived: (topic: string, payload: SpeechPayload) => void
  /** メッセージ処理完了 */
  messageProcessed: (result: MqttMessageHandleResult) => void
  /** エラー発生 */
  error: (error: Error, context?: string) => void
}
