import '@charcoal-ui/icons'
import type { AppProps } from 'next/app'
import React, { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'

import { isLanguageSupported } from '@/features/constants/settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/styles/globals.css'
import migrateStore from '@/utils/migrateStore'
import i18n from '../lib/i18n'
import {
  initializeMqttIntegration,
  cleanupMqttIntegration,
} from '@/features/mqtt'
import { mqttBrokerIntegration } from '@/features/mqtt/MqttBrokerIntegration'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const hs = homeStore.getState()
    const ss = settingsStore.getState()

    if (hs.userOnboarded) {
      i18n.changeLanguage(ss.selectLanguage)
    } else {
      migrateStore()

      const browserLanguage = navigator.language
      const languageCode = browserLanguage.match(/^zh/i)
        ? 'zh'
        : browserLanguage.split('-')[0].toLowerCase()

      let language = ss.selectLanguage
      if (!language) {
        language = isLanguageSupported(languageCode) ? languageCode : 'ja'
      }
      i18n.changeLanguage(language)
      settingsStore.setState({ selectLanguage: language })

      homeStore.setState({ userOnboarded: true })
    }

    // Initialize MQTT integrations after settings are hydrated
    const initializeMqtt = async () => {
      try {
        // Wait for settings to be hydrated from localStorage
        let retries = 0
        const maxRetries = 10
        const retryDelay = 100

        while (retries < maxRetries) {
          const settings = settingsStore.getState()
          // Check if settings have been hydrated by looking for non-default MQTT values
          if (
            settings.mqttEnabled !== false ||
            settings.mqttHost !== 'localhost'
          ) {
            break
          }

          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          retries++
        }

        // Initialize legacy MQTT integration
        await initializeMqttIntegration()
        console.log('Legacy MQTT integration initialized successfully')

        // Initialize new MQTT broker integration
        await mqttBrokerIntegration.initialize()
        console.log('MQTT Broker Integration initialized successfully')
      } catch (error) {
        console.warn('Failed to initialize MQTT integrations:', error)
      }
    }

    // Delay MQTT initialization to ensure settings are hydrated
    setTimeout(initializeMqtt, 100)

    // Cleanup on unmount
    return () => {
      cleanupMqttIntegration().catch((error) => {
        console.warn('Failed to cleanup legacy MQTT integration:', error)
      })

      mqttBrokerIntegration.shutdown().catch((error) => {
        console.warn('Failed to cleanup MQTT Broker Integration:', error)
      })
    }
  }, [])

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
