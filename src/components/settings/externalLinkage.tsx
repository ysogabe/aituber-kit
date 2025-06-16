import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import { TextButton } from '../textButton'
import { useCallback } from 'react'

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
          <p className="text-sm">
            {mqttEnabled ? (
              <span className="text-green-600">{t('MqttEnabledStatus')}</span>
            ) : (
              <span className="text-gray-600">{t('MqttDisabledStatus')}</span>
            )}
          </p>
        </div>
        <TextButton
          onClick={() => {
            console.log('MQTT設定ボタンがクリックされました')
            menuStore.setState({ activeSettingsTab: 'mqttBroker' })
          }}
        >
          {t('GoToMqttSettings')}
        </TextButton>
      </div>

      {/* 注意事項 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">{t('ExternalLinkageNote')}</p>
      </div>
    </div>
  )
}
export default ExternalLinkage
