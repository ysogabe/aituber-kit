/**
 * MQTT統合機能のメインエクスポート
 * MCP Server から MQTT ブローカー経由で AITuber Kit に発話指示を送信する機能
 */

// 主要クラス
export { MqttIntegration } from './MqttIntegration'
export { MqttSubscriber } from './subscribers/MqttSubscriber'
export { SpeechHandler } from './handlers/SpeechHandler'

// 設定
export { MqttConfigLoader } from './config/MqttConfig'

// 型定義
export type {
  SpeechPayload,
  MqttConfig,
  MqttConnectionStatus,
  MqttSubscription,
  MqttIntegrationConfig,
  MqttMessageHandleResult,
  MqttIntegrationEvents,
} from './types'

// 便利関数
import { MqttIntegration } from './MqttIntegration'
import { MqttConfigLoader } from './config/MqttConfig'

let globalMqttIntegration: MqttIntegration | null = null

/**
 * グローバルなMQTT統合インスタンスを取得
 * シングルトンパターンでアプリケーション全体で一つのインスタンスを使用
 */
export function getMqttIntegration(): MqttIntegration {
  if (!globalMqttIntegration) {
    globalMqttIntegration = new MqttIntegration()
  }
  return globalMqttIntegration
}

/**
 * MQTT統合を初期化（環境変数から設定を読み込み）
 */
export async function initializeMqttIntegration(): Promise<MqttIntegration> {
  const integration = getMqttIntegration()
  const config = MqttConfigLoader.loadConfig()

  // 設定の妥当性を検証
  const validationErrors = MqttConfigLoader.validateConfig(config)
  if (validationErrors.length > 0) {
    console.warn('MQTT configuration validation warnings:', validationErrors)
  }

  await integration.initialize(config)
  return integration
}

/**
 * MQTT統合を開始
 */
export async function startMqttIntegration(): Promise<void> {
  const integration = getMqttIntegration()
  await integration.start()
}

/**
 * MQTT統合を停止
 */
export async function stopMqttIntegration(): Promise<void> {
  const integration = getMqttIntegration()
  await integration.stop()
}

/**
 * MQTT統合をクリーンアップ
 */
export async function cleanupMqttIntegration(): Promise<void> {
  if (globalMqttIntegration) {
    await globalMqttIntegration.cleanup()
    globalMqttIntegration = null
  }
}

/**
 * MQTT統合の状態を取得
 */
export function getMqttIntegrationStatus() {
  if (!globalMqttIntegration) {
    return {
      initialized: false,
      enabled: false,
      connectionStatus: 'disconnected' as const,
      subscriptions: [],
    }
  }
  return globalMqttIntegration.getStatus()
}
