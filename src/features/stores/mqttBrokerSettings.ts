import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { type EmotionType } from '@/features/messages/messages'

/**
 * MQTT接続状態の型定義
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

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
 * MQTTブローカー設定の型定義
 */
interface MqttBrokerSettings {
  enabled: boolean
  clientId: string
  brokerUrl: string
  brokerPort: number
  sendMode: SendMode
  connectionStatus: ConnectionStatus
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
  updateMqttBrokerConfig: (config: Partial<MqttBrokerSettings>) => void
  generateNewClientId: () => void
  updateConnectionStatus: (status: ConnectionStatus) => void
}

/**
 * MQTTブローカー設定ストア
 */
export type MqttBrokerStore = MqttBrokerSettings & MqttBrokerActions

/**
 * MQTTブローカー設定のデフォルト値
 */
const defaultMqttBrokerSettings: MqttBrokerSettings = {
  enabled: false,
  clientId: uuidv4(),
  brokerUrl: 'mqtt://192.168.0.131:1883',
  brokerPort: 1883,
  sendMode: 'direct_send',
  connectionStatus: 'disconnected',
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
 * AITuberでのMQTTブローカー統合設定を管理するZustandストア
 * localStorageに永続化されます。
 */
export const useMqttBrokerStore = create<MqttBrokerStore>()(
  persist(
    (set, get) => ({
      ...defaultMqttBrokerSettings,

      /**
       * MQTT設定を更新
       */
      updateMqttBrokerConfig: (config: Partial<MqttBrokerSettings>) => {
        set((state) => ({
          ...state,
          ...config,
        }))
      },

      /**
       * 新しいクライアントIDを生成
       */
      generateNewClientId: () => {
        const newClientId = uuidv4()
        set((state) => ({
          ...state,
          clientId: newClientId,
        }))
      },

      /**
       * 接続状態を更新
       */
      updateConnectionStatus: (status: ConnectionStatus) => {
        set((state) => ({
          ...state,
          connectionStatus: status,
        }))
      },
    }),
    {
      name: 'mqtt-broker-settings',
      partialize: (state) => ({
        enabled: state.enabled,
        clientId: state.clientId,
        brokerUrl: state.brokerUrl,
        brokerPort: state.brokerPort,
        sendMode: state.sendMode,
        // ペイロードオプション設定も永続化
        defaultMessageType: state.defaultMessageType,
        defaultPriority: state.defaultPriority,
        defaultEmotion: state.defaultEmotion,
        includeTimestamp: state.includeTimestamp,
        includeMetadata: state.includeMetadata,
        // connectionStatusは永続化しない（セッション開始時は常にdisconnected）
      }),
    }
  )
)

/**
 * 設定の妥当性をチェック
 */
export const validateMqttBrokerConfig = (config: Partial<MqttBrokerSettings>): boolean => {
  // URLフォーマットの基本チェック
  if (config.brokerUrl && !config.brokerUrl.match(/^(mqtt|mqtts|ws|wss):\/\/.+/)) {
    return false
  }

  // ポート番号の範囲チェック
  if (config.brokerPort && (config.brokerPort < 1 || config.brokerPort > 65535)) {
    return false
  }

  // クライアントIDの存在チェック
  if (config.clientId && config.clientId.trim().length === 0) {
    return false
  }

  return true
}

/**
 * MQTTブローカー設定をデフォルト値にリセット
 */
export const resetMqttBrokerSettings = () => {
  const store = useMqttBrokerStore.getState()
  store.updateMqttBrokerConfig({
    ...defaultMqttBrokerSettings,
    clientId: uuidv4(), // 新しいクライアントIDを生成
  })
}