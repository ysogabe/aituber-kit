import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TextButton } from '../textButton'
import {
  useMqttBrokerStore,
  type SendMode,
  type ConnectionStatus,
  type MessageType,
  type Priority,
  validateMqttBrokerConfig,
} from '@/features/stores/mqttBrokerSettings'
import { EMOTIONS, type EmotionType } from '@/features/messages/messages'
import settingsStore from '@/features/stores/settings'

/**
 * MQTTブローカー設定コンポーネント
 *
 * AITuber向けのMQTTブローカー統合設定を管理するUIコンポーネント
 */
const MqttBrokerSettings = () => {
  const { t } = useTranslation()

  // Zustandストアから状態とアクションを取得
  const {
    enabled,
    clientId,
    sendMode,
    connectionStatus,
    defaultMessageType,
    defaultPriority,
    defaultEmotion,
    includeTimestamp,
    includeMetadata,
    updateMqttBrokerConfig,
    generateNewClientId,
    updateConnectionStatus,
  } = useMqttBrokerStore()

  // MQTT接続設定をsettingsStoreから取得
  const {
    mqttHost,
    mqttPort,
    mqttUsername,
    mqttPassword,
    mqttSecure,
    mqttWebsocketPath,
    mqttReconnectEnabled,
    mqttReconnectInitialDelay,
    mqttReconnectMaxDelay,
    mqttReconnectMaxAttempts,
  } = settingsStore()

  // ローカル状態
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  /**
   * MQTT有効/無効の切り替え
   */
  const handleToggleEnabled = useCallback(() => {
    updateMqttBrokerConfig({ enabled: !enabled })
    if (!enabled) {
      updateConnectionStatus('disconnected')
    }
  }, [enabled, updateMqttBrokerConfig, updateConnectionStatus])

  /**
   * MQTT接続設定の変更ハンドラー
   */
  const handleHostChange = useCallback((value: string) => {
    settingsStore.setState({ mqttHost: value })
  }, [])

  const handlePortChange = useCallback((value: string) => {
    const port = parseInt(value, 10)
    if (!isNaN(port)) {
      settingsStore.setState({ mqttPort: port })
    }
  }, [])

  const handleUsernameChange = useCallback((value: string) => {
    settingsStore.setState({ mqttUsername: value })
  }, [])

  const handlePasswordChange = useCallback((value: string) => {
    settingsStore.setState({ mqttPassword: value })
  }, [])

  const handleSecureToggle = useCallback(() => {
    settingsStore.setState({ mqttSecure: !mqttSecure })
  }, [mqttSecure])

  const handleWebsocketPathChange = useCallback((value: string) => {
    settingsStore.setState({ mqttWebsocketPath: value })
  }, [])

  const handleReconnectToggle = useCallback(() => {
    settingsStore.setState({ mqttReconnectEnabled: !mqttReconnectEnabled })
  }, [mqttReconnectEnabled])

  const handleReconnectInitialDelayChange = useCallback((value: string) => {
    const delay = parseInt(value, 10)
    if (!isNaN(delay)) {
      settingsStore.setState({ mqttReconnectInitialDelay: delay })
    }
  }, [])

  const handleReconnectMaxDelayChange = useCallback((value: string) => {
    const delay = parseInt(value, 10)
    if (!isNaN(delay)) {
      settingsStore.setState({ mqttReconnectMaxDelay: delay })
    }
  }, [])

  const handleReconnectMaxAttemptsChange = useCallback((value: string) => {
    const attempts = parseInt(value, 10)
    if (!isNaN(attempts)) {
      settingsStore.setState({ mqttReconnectMaxAttempts: attempts })
    }
  }, [])

  /**
   * 送信モード変更
   */
  const handleSendModeChange = useCallback(
    (mode: SendMode) => {
      updateMqttBrokerConfig({ sendMode: mode })
    },
    [updateMqttBrokerConfig]
  )

  /**
   * メッセージタイプ変更
   */
  const handleMessageTypeChange = useCallback(
    (type: MessageType) => {
      updateMqttBrokerConfig({ defaultMessageType: type })
    },
    [updateMqttBrokerConfig]
  )

  /**
   * 優先度変更
   */
  const handlePriorityChange = useCallback(
    (priority: Priority) => {
      updateMqttBrokerConfig({ defaultPriority: priority })
    },
    [updateMqttBrokerConfig]
  )

  /**
   * 感情変更
   */
  const handleEmotionChange = useCallback(
    (emotion: EmotionType | null) => {
      updateMqttBrokerConfig({ defaultEmotion: emotion })
    },
    [updateMqttBrokerConfig]
  )

  /**
   * タイムスタンプ設定変更
   */
  const handleTimestampToggle = useCallback(() => {
    updateMqttBrokerConfig({ includeTimestamp: !includeTimestamp })
  }, [includeTimestamp, updateMqttBrokerConfig])

  /**
   * メタデータ設定変更
   */
  const handleMetadataToggle = useCallback(() => {
    updateMqttBrokerConfig({ includeMetadata: !includeMetadata })
  }, [includeMetadata, updateMqttBrokerConfig])

  /**
   * クライアントIDをクリップボードにコピー
   */
  const handleCopyClientId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clientId)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy client ID:', error)
    }
  }, [clientId])

  /**
   * 接続テスト
   */
  const handleTestConnection = useCallback(async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      // 設定の妥当性チェック
      if (!mqttHost || !mqttPort) {
        throw new Error('ホストとポートを設定してください')
      }

      updateConnectionStatus('connecting')

      // TODO: 実際の接続テストロジックを実装
      // 現在はモックで2秒後に成功を返す
      await new Promise((resolve) => setTimeout(resolve, 2000))

      updateConnectionStatus('connected')
      setTestResult({
        success: true,
        message: `${mqttHost}:${mqttPort} への接続テストに成功しました`,
      })
    } catch (error) {
      updateConnectionStatus('error')
      setTestResult({
        success: false,
        message: `接続テストに失敗しました: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      })
    } finally {
      setIsTestingConnection(false)
    }
  }, [mqttHost, mqttPort, updateConnectionStatus])

  /**
   * 接続状態に応じた色を取得
   */
  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'text-green-600'
      case 'connecting':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  /**
   * 接続状態のテキストを取得
   */
  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return t('MqttStatusConnected')
      case 'connecting':
        return t('MqttStatusConnecting')
      case 'disconnected':
        return t('MqttStatusDisconnected')
      case 'error':
        return t('MqttStatusError')
      default:
        return status
    }
  }

  /**
   * 送信モードタブのスタイル
   */
  const getTabStyle = (mode: SendMode) => {
    return `px-4 py-2 rounded-lg transition-colors ${
      sendMode === mode
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('MqttBrokerSettings')}</h2>
        <p className="text-sm text-gray-600">
          {t('MqttBrokerSettingsDescription')}
        </p>
      </div>

      {/* MQTT有効/無効 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t('MqttEnabled')}</h3>
            <p className="text-sm text-gray-600">
              {t('MqttEnabledDescription')}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <TextButton onClick={handleToggleEnabled}>
              {enabled ? t('StatusOn') : t('StatusOff')}
            </TextButton>
            {enabled && (
              <span
                className={`text-sm font-medium ${getStatusColor(connectionStatus)}`}
              >
                {getStatusText(connectionStatus)}
              </span>
            )}
          </div>
        </div>
      </div>

      {enabled && (
        <>
          {/* Client ID表示エリア */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{t('MqttClientId')}</h3>
            <div className="flex items-center space-x-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm">
                {clientId}
              </div>
              <TextButton onClick={handleCopyClientId} className="shrink-0">
                {copySuccess ? t('Copied') : t('Copy')}
              </TextButton>
              <TextButton onClick={generateNewClientId} className="shrink-0">
                {t('Regenerate')}
              </TextButton>
            </div>
            <p className="text-xs text-gray-500">
              {t('MqttClientIdDescription')}
            </p>
          </div>

          {/* ブローカー接続設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              {t('MqttBrokerConfiguration')}
            </h3>

            {/* プロトコル情報 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                プロトコル
              </label>
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                WebSocket (固定)
              </div>
              <p className="text-xs text-gray-500 mt-1">
                MQTTブローカーへの接続はWebSocketプロトコルのみをサポートしています
              </p>
            </div>

            {/* ホスト */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">ホスト</label>
              <input
                type="text"
                value={mqttHost}
                onChange={(e) => handleHostChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="localhost"
              />
            </div>

            {/* ポート */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">ポート</label>
              <input
                type="number"
                value={mqttPort}
                onChange={(e) => handlePortChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1883"
                min="1"
                max="65535"
              />
            </div>

            {/* WebSocketパス */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">WebSocketパス</label>
              <input
                type="text"
                value={mqttWebsocketPath}
                onChange={(e) => handleWebsocketPathChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="/mqtt"
              />
            </div>

            {/* セキュア接続 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  セキュア接続 (TLS/SSL)
                </label>
                <p className="text-xs text-gray-500">
                  HTTPS/WSS接続を使用します
                </p>
              </div>
              <TextButton onClick={handleSecureToggle}>
                {mqttSecure ? 'ON' : 'OFF'}
              </TextButton>
            </div>
          </div>

          {/* 認証設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">認証設定</h3>

            {/* ユーザー名 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">ユーザー名</label>
              <input
                type="text"
                value={mqttUsername || ''}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="オプション"
              />
            </div>

            {/* パスワード */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">パスワード</label>
              <input
                type="password"
                value={mqttPassword || ''}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="オプション"
              />
            </div>
          </div>

          {/* 再接続設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">再接続設定</h3>

            {/* 再接続有効/無効 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  自動再接続を有効にする
                </label>
                <p className="text-xs text-gray-500">
                  接続が切断された場合に自動的に再接続を試行します
                </p>
              </div>
              <TextButton onClick={handleReconnectToggle}>
                {mqttReconnectEnabled ? 'ON' : 'OFF'}
              </TextButton>
            </div>

            {mqttReconnectEnabled && (
              <>
                {/* 初期遅延 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    初期遅延 (ミリ秒)
                  </label>
                  <input
                    type="number"
                    value={mqttReconnectInitialDelay}
                    onChange={(e) =>
                      handleReconnectInitialDelayChange(e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1000"
                  />
                  <p className="text-xs text-gray-500">
                    最初の再接続試行までの遅延時間
                  </p>
                </div>

                {/* 最大遅延 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    最大遅延 (ミリ秒)
                  </label>
                  <input
                    type="number"
                    value={mqttReconnectMaxDelay}
                    onChange={(e) =>
                      handleReconnectMaxDelayChange(e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="30000"
                  />
                  <p className="text-xs text-gray-500">
                    再接続試行の最大遅延時間
                  </p>
                </div>

                {/* 最大試行回数 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    最大試行回数
                  </label>
                  <input
                    type="number"
                    value={mqttReconnectMaxAttempts}
                    onChange={(e) =>
                      handleReconnectMaxAttemptsChange(e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5"
                  />
                  <p className="text-xs text-gray-500">
                    再接続を試行する最大回数
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 送信モード選択 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('MqttSendMode')}</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSendModeChange('direct_send')}
                className={getTabStyle('direct_send')}
              >
                {t('MqttSendModeDirectSend')}
              </button>
              <button
                onClick={() => handleSendModeChange('ai_generated')}
                className={getTabStyle('ai_generated')}
              >
                {t('MqttSendModeAiGenerated')}
              </button>
              <button
                onClick={() => handleSendModeChange('user_input')}
                className={getTabStyle('user_input')}
              >
                {t('MqttSendModeUserInput')}
              </button>
            </div>
            <div className="text-sm text-gray-600">
              {sendMode === 'direct_send' && (
                <p>{t('MqttSendModeDirectSendDescription')}</p>
              )}
              {sendMode === 'ai_generated' && (
                <p>{t('MqttSendModeAiGeneratedDescription')}</p>
              )}
              {sendMode === 'user_input' && (
                <p>{t('MqttSendModeUserInputDescription')}</p>
              )}
            </div>
          </div>

          {/* ペイロードオプション設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('MqttPayloadOptions')}</h3>
            <p className="text-sm text-gray-600">
              {t('MqttPayloadOptionsDescription')}
            </p>

            {/* メッセージタイプ選択 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {t('MqttMessageType')}
              </label>
              <select
                value={defaultMessageType}
                onChange={(e) =>
                  handleMessageTypeChange(e.target.value as MessageType)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="speech">{t('MqttMessageTypeSpeech')}</option>
                <option value="alert">{t('MqttMessageTypeAlert')}</option>
                <option value="notification">
                  {t('MqttMessageTypeNotification')}
                </option>
              </select>
              <p className="text-xs text-gray-500">
                {t('MqttMessageTypeDescription')}
              </p>
            </div>

            {/* 優先度選択 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {t('MqttPriority')}
              </label>
              <select
                value={defaultPriority}
                onChange={(e) =>
                  handlePriorityChange(e.target.value as Priority)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">{t('MqttPriorityLow')}</option>
                <option value="medium">{t('MqttPriorityMedium')}</option>
                <option value="high">{t('MqttPriorityHigh')}</option>
              </select>
              <p className="text-xs text-gray-500">
                {t('MqttPriorityDescription')}
              </p>
            </div>

            {/* 感情設定 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {t('MqttEmotion')}
              </label>
              <select
                value={defaultEmotion || ''}
                onChange={(e) =>
                  handleEmotionChange(
                    e.target.value === ''
                      ? null
                      : (e.target.value as EmotionType)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('MqttEmotionNone')}</option>
                {EMOTIONS.map((emotion) => (
                  <option key={emotion} value={emotion}>
                    {t(
                      `MqttEmotion${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`
                    )}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {t('MqttEmotionDescription')}
              </p>
            </div>

            {/* オプション設定 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">
                    {t('MqttIncludeTimestamp')}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('MqttIncludeTimestampDescription')}
                  </p>
                </div>
                <TextButton onClick={handleTimestampToggle}>
                  {includeTimestamp ? t('StatusOn') : t('StatusOff')}
                </TextButton>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">
                    {t('MqttIncludeMetadata')}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('MqttIncludeMetadataDescription')}
                  </p>
                </div>
                <TextButton onClick={handleMetadataToggle}>
                  {includeMetadata ? t('StatusOn') : t('StatusOff')}
                </TextButton>
              </div>
            </div>
          </div>

          {/* 接続テスト */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">接続テスト</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">接続状態:</span>
                <span
                  className={`text-sm font-medium ${getStatusColor(connectionStatus)}`}
                >
                  {getStatusText(connectionStatus)}
                </span>
              </div>
              <TextButton
                onClick={handleTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? 'テスト中...' : '接続をテスト'}
              </TextButton>
              {testResult && (
                <div
                  className={`p-4 rounded-lg ${
                    testResult.success
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          {/* 注意事項 */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">
              {t('Important')}
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• {t('MqttBrokerNote1')}</li>
              <li>• {t('MqttBrokerNote2')}</li>
              <li>• {t('MqttBrokerNote3')}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default MqttBrokerSettings
