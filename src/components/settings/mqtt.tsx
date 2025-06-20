import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { TextButton } from '../textButton'
import { useMqttBrokerStore } from '@/features/stores/mqttBrokerSettings'
import { mqttBrokerIntegration } from '@/features/mqtt/MqttBrokerIntegration'

const MqttSettings = () => {
  const { t } = useTranslation()

  // Storeから設定を取得
  const { mqttEnabled } = settingsStore()

  const [connectionStatus, setConnectionStatus] =
    useState<string>('disconnected')

  // MQTT統合の初期化と接続制御
  useEffect(() => {
    const handleMqttConnection = async () => {
      console.log(
        `MQTT Settings: MQTT function toggled - ${mqttEnabled ? 'ON' : 'OFF'}`
      )

      if (mqttEnabled) {
        console.log('MQTT Settings: Attempting to connect to MQTT broker...')
        const connected = await mqttBrokerIntegration.toggleConnection(true)
        if (connected) {
          console.log('MQTT Settings: Successfully connected to MQTT broker')
        } else {
          console.error('MQTT Settings: Failed to connect to MQTT broker')
        }
      } else {
        console.log('MQTT Settings: Disconnecting from MQTT broker...')
        await mqttBrokerIntegration.toggleConnection(false)
        console.log('MQTT Settings: Disconnected from MQTT broker')
      }
    }

    handleMqttConnection()
  }, [mqttEnabled])

  // 接続状態の定期的な更新
  useEffect(() => {
    if (mqttEnabled) {
      const interval = setInterval(() => {
        const store = useMqttBrokerStore.getState()
        const status = store.getConnectionStatus()
        setConnectionStatus(status)
      }, 2000)

      return () => clearInterval(interval)
    } else {
      setConnectionStatus('disconnected')
    }
  }, [mqttEnabled])

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
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      {/* On/Off制御エリア */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">MQTT:</span>
            <span
              className={`text-sm font-medium ${mqttEnabled ? 'text-green-600' : 'text-gray-600'}`}
            >
              {mqttEnabled ? 'ON' : 'OFF'}
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
          <p className="text-xs text-blue-700">
            MQTTブローカーとの接続を制御します
          </p>
        </div>
        <TextButton
          onClick={() => settingsStore.setState({ mqttEnabled: !mqttEnabled })}
        >
          {mqttEnabled ? 'OFF' : 'ON'}
        </TextButton>
      </div>

      {/* 詳細設定へのリンクエリア */}
      <div className="pt-2 border-t border-blue-200">
        <button
          onClick={() => {
            // MQTTブローカー設定タブへの遷移
            const settingsMenu = document.querySelector('[role="tablist"]')
            const mqttBrokerTab = Array.from(
              settingsMenu?.querySelectorAll('button') || []
            ).find((button) =>
              button.textContent?.includes('MQTTブローカー設定')
            )
            if (mqttBrokerTab) {
              ;(mqttBrokerTab as HTMLButtonElement).click()
            }
          }}
          className="text-sm text-blue-600 hover:text-blue-800 underline bg-transparent border-none cursor-pointer"
        >
          → MQTTブローカー設定を開く
        </button>
      </div>

      {/* MVP制限事項の通知 */}
      <div className="mt-3 pt-2 border-t border-blue-200">
        <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
          <strong>MVP版制限:</strong> 現在は固定トピック「aituber/speech」
          (QoS:2) のみサポート。詳細設定は次期バージョンで対応予定。
        </div>
      </div>
    </div>
  )
}

export default MqttSettings
