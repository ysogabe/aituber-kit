import { v4 as uuidv4 } from 'uuid'

/**
 * AITuber用のMQTT ClientIDを生成するユーティリティ
 *
 * @description
 * 複数のブラウザタブやセッション間でのClientID衝突を防ぐため、
 * 一意性を保証するClientIDを生成します。
 *
 * 生成形式: aituber-{uuid}-{timestamp}
 * - aituber: AITuberアプリケーションであることを示すプレフィックス
 * - uuid: セッション間の一意性を保証するUUID
 * - timestamp: 生成時刻を示すタイムスタンプ（追加の一意性保証）
 */

/**
 * AITuber用の一意なMQTT ClientIDを生成
 *
 * @returns {string} 生成されたClientID (例: "aituber-550e8400-e29b-41d4-a716-446655440000-1703123456789")
 */
export function generateAituberClientId(): string {
  const uuid = uuidv4()
  const timestamp = Date.now()
  return `aituber-${uuid}-${timestamp}`
}

/**
 * 既存のClientIDがAITuber形式かどうかを判定
 *
 * @param clientId - 判定対象のClientID
 * @returns {boolean} AITuber形式の場合はtrue
 */
export function isAituberClientId(clientId: string): boolean {
  if (!clientId || typeof clientId !== 'string') {
    return false
  }

  // aituber-{uuid}-{timestamp} の基本形式をチェック
  // UUID v4の特定パターン（4番目の文字が'4'、5番目のグループの最初の文字が8,9,a,b）をチェック
  const basicAituberPattern =
    /^aituber-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-\d{13}$/

  // レガシーID変換形式もサポート: aituber-{uuid}-{timestamp}-{legacyId}
  const legacyConvertedPattern =
    /^aituber-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-\d{13}-.+$/

  return (
    basicAituberPattern.test(clientId) || legacyConvertedPattern.test(clientId)
  )
}

/**
 * ClientIDからタイムスタンプを抽出
 *
 * @param clientId - AITuber形式のClientID
 * @returns {number | null} 抽出されたタイムスタンプ、無効な形式の場合はnull
 */
export function extractTimestampFromClientId(clientId: string): number | null {
  if (!isAituberClientId(clientId)) {
    return null
  }

  const parts = clientId.split('-')

  // 基本形式: aituber-{uuid5parts}-{timestamp} なので、timestampは6番目の要素
  // レガシー変換形式: aituber-{uuid5parts}-{timestamp}-{legacyId} なので、timestampは6番目の要素
  if (parts.length < 7) {
    return null
  }

  const timestampStr = parts[6] // 0:aituber, 1-5:uuid parts, 6:timestamp
  const timestamp = parseInt(timestampStr, 10)

  return isNaN(timestamp) || timestampStr.length !== 13 ? null : timestamp
}

/**
 * レガシー形式のClientIDをAITuber形式に変換
 *
 * @param legacyClientId - 変換対象のレガシーClientID
 * @returns {string} AITuber形式に変換されたClientID
 */
export function convertLegacyClientId(legacyClientId: string): string {
  // 既にAITuber形式の場合はそのまま返す
  if (isAituberClientId(legacyClientId)) {
    return legacyClientId
  }

  // 空文字列やundefinedの場合は新しいClientIDを生成
  if (!legacyClientId || typeof legacyClientId !== 'string') {
    return generateAituberClientId()
  }

  // レガシー形式から新形式に変換（レガシーID情報を保持）
  const uuid = uuidv4()
  const timestamp = Date.now()

  // レガシーIDを末尾に追加してAITuber形式とする
  return `aituber-${uuid}-${timestamp}-${legacyClientId}`
}
