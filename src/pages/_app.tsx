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

    // Initialize MQTT integration
    const initializeMqtt = async () => {
      try {
        await initializeMqttIntegration()
        console.log('MQTT integration initialized successfully')
      } catch (error) {
        console.warn('Failed to initialize MQTT integration:', error)
      }
    }

    initializeMqtt()

    // Cleanup on unmount
    return () => {
      cleanupMqttIntegration().catch((error) => {
        console.warn('Failed to cleanup MQTT integration:', error)
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
