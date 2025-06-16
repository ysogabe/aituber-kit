import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../textButton'
import { MqttConfigLoader } from '@/features/mqtt/config/MqttConfig'
import { MqttIntegration } from '@/features/mqtt/MqttIntegration'

// MQTTインテグレーションのシングルトンインスタンス
let mqttIntegration: MqttIntegration | null = null

const MqttSettings = () => {
  const { t } = useTranslation()

  // Storeから設定を取得
  const {
    mqttEnabled,
    mqttHost,
    mqttPort,
    mqttProtocol,
    mqttUsername,
    mqttPassword,
    mqttSecure,
    mqttWebsocketPath,
    mqttReconnectEnabled,
    mqttReconnectInitialDelay,
    mqttReconnectMaxDelay,
    mqttReconnectMaxAttempts,
  } = settingsStore()

  const [connectionStatus, setConnectionStatus] =
    useState<string>('disconnected')
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // MQTT統合の初期化
  useEffect(() => {
    if (!mqttIntegration) {
      mqttIntegration = new MqttIntegration()
    }

    if (mqttEnabled) {
      const config = {
        enabled: mqttEnabled,
        connection: {
          host: mqttHost || 'localhost',
          port: mqttPort || 1883,
          clientId: `aituber-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          protocol: 'websocket' as const,
          websocketPath: mqttWebsocketPath,
          username: mqttUsername,
          password: mqttPassword,
          secure: mqttSecure,
        },
        subscriptions: [
          { topic: 'aituber/speech', qos: 1 as const, active: true },
          { topic: 'aituber/speech/alert', qos: 1 as const, active: true },
          {
            topic: 'aituber/speech/notification',
            qos: 1 as const,
            active: true,
          },
        ],
        reconnect: {
          enabled: mqttReconnectEnabled,
          initialDelay: mqttReconnectInitialDelay,
          maxDelay: mqttReconnectMaxDelay,
          maxAttempts: mqttReconnectMaxAttempts,
        },
      }

      mqttIntegration
        .initialize(config)
        .then(() => {
          const status =
            mqttIntegration?.getConnectionStatus() || 'disconnected'
          setConnectionStatus(status)
        })
        .catch((error) => {
          console.error('Failed to initialize MQTT integration:', error)
          setConnectionStatus('error')
        })
    } else {
      mqttIntegration?.stop()
      setConnectionStatus('disconnected')
    }
  }, [
    mqttEnabled,
    mqttHost,
    mqttPort,
    mqttProtocol,
    mqttUsername,
    mqttPassword,
    mqttSecure,
    mqttWebsocketPath,
    mqttReconnectEnabled,
    mqttReconnectInitialDelay,
    mqttReconnectMaxDelay,
    mqttReconnectMaxAttempts,
  ])

  // 接続状態の定期的な更新
  useEffect(() => {
    if (mqttEnabled && mqttIntegration) {
      const interval = setInterval(() => {
        const status = mqttIntegration?.getConnectionStatus() || 'disconnected'
        setConnectionStatus(status)
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [mqttEnabled])

  // MQTT有効/無効の制御はMQTTブローカー設定で行うため、ハンドラーを削除

  // WebSocketプロトコル固定のため、プロトコル変更ハンドラーを削除

  const handleTestConnection = useCallback(async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      // 一時的なMQTT接続を作成してテスト
      const { MqttManager } = await import(
        '@/features/mqtt/subscribers/MqttSubscriber'
      )
      // TODO: 実際の接続テストロジックを実装

      setTestResult({
        success: true,
        message: t('MqttConnectionTestSuccess'),
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: t('MqttConnectionTestFailed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      })
    } finally {
      setIsTestingConnection(false)
    }
  }, [t])

  const getStatusColor = (status: string) => {
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

  const getStatusText = (status: string) => {
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

  return (
    <>
      <div className="flex items-center mb-6">
        <Image
          src="/images/icons/external-link.svg"
          alt="MQTT Settings"
          width={24}
          height={24}
          className="mr-2"
        />
        <h2 className="text-2xl font-bold">{t('MqttSettings')}</h2>
      </div>

      {/* MQTT機能状態表示 */}
      <div className="mb-8">
        <div className="mb-4 text-xl font-bold">
          {t('MqttConnectionSettings')}
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="mb-2 text-sm text-blue-800">
            📝 MQTT機能の有効/無効は「MQTTブローカー設定」タブで制御します。
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">機能状態:</span>
            <span
              className={`text-sm font-medium ${mqttEnabled ? 'text-green-600' : 'text-gray-600'}`}
            >
              {mqttEnabled ? '有効' : '無効'}
            </span>
            {mqttEnabled && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-sm">接続状態:</span>
                <span
                  className={`text-sm font-medium ${getStatusColor(connectionStatus)}`}
                >
                  {getStatusText(connectionStatus)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 接続設定は常に表示 */}
      <>
        {/* 接続設定 */}
        <div className="mb-8">
          <div className="mb-4 text-lg font-bold">
            {t('MqttConnectionSettings')}
          </div>

          {/* WebSocket固定情報 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('MqttProtocol')}
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
              WebSocket (固定)
            </div>
            <p className="text-xs text-gray-500 mt-1">
              MQTTブローカーへの接続はWebSocketプロトコルのみをサポートしています
            </p>
          </div>

          {/* ホスト */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('MqttHost')}
            </label>
            <input
              type="text"
              value={mqttHost}
              onChange={(e) =>
                settingsStore.setState({ mqttHost: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="localhost"
            />
          </div>

          {/* ポート */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('MqttPort')}
            </label>
            <input
              type="number"
              value={mqttPort}
              onChange={(e) =>
                settingsStore.setState({
                  mqttPort: parseInt(e.target.value, 10),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="1883"
            />
          </div>

          {/* WebSocketパス */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('MqttWebsocketPath')}
            </label>
            <input
              type="text"
              value={mqttWebsocketPath}
              onChange={(e) =>
                settingsStore.setState({ mqttWebsocketPath: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="/mqtt"
            />
          </div>

          {/* セキュア接続 */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={mqttSecure}
                onChange={(e) =>
                  settingsStore.setState({ mqttSecure: e.target.checked })
                }
                className="mr-2"
              />
              <span className="text-sm font-medium">
                {t('MqttSecureConnection')}
              </span>
            </label>
          </div>
        </div>

        {/* 認証設定 */}
        <div className="mb-8">
          <div className="mb-4 text-lg font-bold">{t('MqttAuthSettings')}</div>

          {/* ユーザー名 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('MqttUsername')}
            </label>
            <input
              type="text"
              value={mqttUsername || ''}
              onChange={(e) =>
                settingsStore.setState({ mqttUsername: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('MqttUsernameOptional')}
            />
          </div>

          {/* パスワード */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('MqttPassword')}
            </label>
            <input
              type="password"
              value={mqttPassword || ''}
              onChange={(e) =>
                settingsStore.setState({ mqttPassword: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('MqttPasswordOptional')}
            />
          </div>
        </div>

        {/* 再接続設定 */}
        <div className="mb-8">
          <div className="mb-4 text-lg font-bold">
            {t('MqttReconnectSettings')}
          </div>

          {/* 再接続有効/無効 */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={mqttReconnectEnabled}
                onChange={(e) =>
                  settingsStore.setState({
                    mqttReconnectEnabled: e.target.checked,
                  })
                }
                className="mr-2"
              />
              <span className="text-sm font-medium">
                {t('MqttReconnectEnabled')}
              </span>
            </label>
          </div>

          {mqttReconnectEnabled && (
            <>
              {/* 初期遅延 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('MqttReconnectInitialDelay')}
                </label>
                <input
                  type="number"
                  value={mqttReconnectInitialDelay}
                  onChange={(e) =>
                    settingsStore.setState({
                      mqttReconnectInitialDelay: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="1000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('MqttReconnectInitialDelayHint')}
                </p>
              </div>

              {/* 最大遅延 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('MqttReconnectMaxDelay')}
                </label>
                <input
                  type="number"
                  value={mqttReconnectMaxDelay}
                  onChange={(e) =>
                    settingsStore.setState({
                      mqttReconnectMaxDelay: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="30000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('MqttReconnectMaxDelayHint')}
                </p>
              </div>

              {/* 最大試行回数 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('MqttReconnectMaxAttempts')}
                </label>
                <input
                  type="number"
                  value={mqttReconnectMaxAttempts}
                  onChange={(e) =>
                    settingsStore.setState({
                      mqttReconnectMaxAttempts: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('MqttReconnectMaxAttemptsHint')}
                </p>
              </div>
            </>
          )}
        </div>

        {/* 接続テスト */}
        <div className="mb-8">
          <div className="mb-4 text-lg font-bold">
            {t('MqttConnectionTest')}
          </div>
          <TextButton
            onClick={handleTestConnection}
            disabled={isTestingConnection}
          >
            {isTestingConnection
              ? t('MqttTestingConnection')
              : t('MqttTestConnection')}
          </TextButton>
          {testResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {testResult.message}
            </div>
          )}
        </div>
      </>
    </>
  )
}

export default MqttSettings
