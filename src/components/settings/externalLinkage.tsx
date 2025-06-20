import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import { TextButton } from '../textButton'
import { useCallback, useEffect } from 'react'
import { mqttBrokerIntegration } from '@/features/mqtt/MqttBrokerIntegration'

const ExternalLinkage = () => {
  const { t } = useTranslation()
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)
  const mqttEnabled = settingsStore((s) => s.mqttEnabled)

  const handleExternalLinkageModeChange = useCallback((newMode: boolean) => {
    settingsStore.setState({
      externalLinkageMode: newMode,
    })

    if (newMode) {
      settingsStore.setState({
        conversationContinuityMode: false,
        realtimeAPIMode: false,
      })
    }
  }, [])

  // MQTT統合の初期化と接続制御
  useEffect(() => {
    const handleMqttConnection = async () => {
      console.log(
        `External Linkage: MQTT function toggled - ${mqttEnabled ? 'ON' : 'OFF'}`
      )

      if (mqttEnabled) {
        console.log('External Linkage: Attempting to connect to MQTT broker...')
        const connected = await mqttBrokerIntegration.toggleConnection(true)
        if (connected) {
          console.log('External Linkage: Successfully connected to MQTT broker')
        } else {
          console.error('External Linkage: Failed to connect to MQTT broker')
        }
      } else {
        console.log('External Linkage: Disconnecting from MQTT broker...')
        await mqttBrokerIntegration.toggleConnection(false)
        console.log('External Linkage: Disconnected from MQTT broker')
      }
    }

    handleMqttConnection()
  }, [mqttEnabled])

  return (
    <div className="mb-10">
      <div className="mb-4 text-xl font-bold">{t('ExternalLinkageMode')}</div>
      <p className="mb-4 text-sm text-gray-600">
        {t('ExternalLinkageModeDescription')}
      </p>

      {/* WebSocket設定 */}
      <div className="mb-6">
        <div className="mb-2 text-lg font-semibold">WebSocket</div>
        <p className="mb-2 text-sm text-gray-600">
          {t('WebSocketDescription')}
        </p>
        <div className="my-2">
          <TextButton
            onClick={() => {
              handleExternalLinkageModeChange(!externalLinkageMode)
            }}
          >
            {externalLinkageMode ? t('StatusOn') : t('StatusOff')}
          </TextButton>
        </div>
        {externalLinkageMode && (
          <div className="mt-2 p-3 bg-gray-100 rounded">
            <p className="text-sm">WebSocket URL: ws://localhost:8000/ws</p>
          </div>
        )}
      </div>

      {/* MQTT設定 */}
      <div className="mb-6">
        <div className="mb-2 text-lg font-semibold">MQTT</div>
        <p className="mb-2 text-sm text-gray-600">
          {t('MqttIntegrationDescription')}
        </p>
        <div className="my-2">
          <TextButton
            onClick={() => {
              settingsStore.setState({ mqttEnabled: !mqttEnabled })
            }}
          >
            {mqttEnabled ? t('StatusOn') : t('StatusOff')}
          </TextButton>
        </div>
        {mqttEnabled && (
          <div className="mt-2 p-3 bg-gray-100 rounded">
            <p className="text-sm">トピック: aituber/speech (QoS: 2)</p>
          </div>
        )}
        <div className="mt-2">
          <button
            onClick={() => {
              console.log('MQTT設定ボタンがクリックされました')
              menuStore.setState({ activeSettingsTab: 'mqttBroker' })
            }}
            className="text-sm text-blue-600 hover:text-blue-800 underline bg-transparent border-none cursor-pointer"
          >
            → {t('GoToMqttSettings')}
          </button>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">{t('ExternalLinkageNote')}</p>
      </div>
    </div>
  )
}
export default ExternalLinkage
