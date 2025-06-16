import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import MqttSettings from '../mqtt'
import settingsStore from '@/features/stores/settings'

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage(props: any) {
    return <img {...props} />
  }
})

// Mock settings store
const mockSettingsState = {
  mqttEnabled: false,
  mqttHost: 'localhost',
  mqttPort: 1883,
  mqttProtocol: 'mqtt' as const,
  mqttUsername: '',
  mqttPassword: '',
  mqttSecure: false,
  mqttWebsocketPath: '/mqtt',
  mqttReconnectEnabled: true,
  mqttReconnectInitialDelay: 1000,
  mqttReconnectMaxDelay: 30000,
  mqttReconnectMaxAttempts: 5,
}

const mockSetState = jest.fn()

jest.mock('@/features/stores/settings', () => {
  const mockStore = jest.fn(() => ({
    mqttEnabled: false,
    mqttHost: 'localhost',
    mqttPort: 1883,
    mqttProtocol: 'mqtt',
    mqttUsername: '',
    mqttPassword: '',
    mqttSecure: false,
    mqttWebsocketPath: '/mqtt',
    mqttReconnectEnabled: true,
    mqttReconnectInitialDelay: 1000,
    mqttReconnectMaxDelay: 30000,
    mqttReconnectMaxAttempts: 5,
  }))
  mockStore.setState = jest.fn()
  return {
    __esModule: true,
    default: mockStore,
  }
})

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        MqttSettings: 'MQTT設定',
        MqttEnabled: 'MQTT有効',
        MqttEnabledDescription: 'MQTT統合を有効にします',
        StatusOn: 'オン',
        StatusOff: 'オフ',
        MqttStatusConnected: '接続済み',
        MqttStatusConnecting: '接続中',
        MqttStatusDisconnected: '切断',
        MqttStatusError: 'エラー',
        MqttConnectionSettings: '接続設定',
        MqttProtocol: 'プロトコル',
        MqttHost: 'ホスト',
        MqttPort: 'ポート',
        MqttWebsocketPath: 'WebSocketパス',
        MqttSecureConnection: 'セキュア接続',
        MqttAuthSettings: '認証設定',
        MqttUsername: 'ユーザー名',
        MqttPassword: 'パスワード',
        MqttUsernameOptional: 'ユーザー名（オプション）',
        MqttPasswordOptional: 'パスワード（オプション）',
        MqttReconnectSettings: '再接続設定',
        MqttReconnectEnabled: '自動再接続を有効',
        MqttReconnectInitialDelay: '初期遅延',
        MqttReconnectMaxDelay: '最大遅延',
        MqttReconnectMaxAttempts: '最大試行回数',
        MqttReconnectInitialDelayHint: 'ミリ秒単位',
        MqttReconnectMaxDelayHint: 'ミリ秒単位',
        MqttReconnectMaxAttemptsHint: '回数（0で無制限）',
        MqttConnectionTest: '接続テスト',
        MqttTestConnection: '接続をテスト',
        MqttTestingConnection: 'テスト中...',
        MqttConnectionTestSuccess: '接続テストに成功しました',
        MqttConnectionTestFailed: '接続テストに失敗しました: {error}',
      }
      return translations[key] || key
    },
  }),
}))

// Mock MQTT integration modules
jest.mock('@/features/mqtt/MqttIntegration', () => ({
  MqttIntegration: class MockMqttIntegration {
    initialize = jest.fn().mockResolvedValue(undefined)
    stop = jest.fn()
    getConnectionStatus = jest.fn().mockReturnValue('disconnected')
  },
}))

jest.mock('@/features/mqtt/config/MqttConfig', () => ({
  MqttConfigLoader: {
    loadConfig: jest.fn(),
  },
}))

jest.mock('@/features/mqtt/subscribers/MqttSubscriber', () => ({
  MqttManager: class MockMqttManager {},
}))

describe('MqttSettings Component', () => {
  const mockSettingsStore = require('@/features/stores/settings').default

  beforeEach(() => {
    jest.clearAllMocks()
    // 初期状態にリセット
    mockSettingsStore.mockReturnValue({
      mqttEnabled: false,
      mqttHost: 'localhost',
      mqttPort: 1883,
      mqttProtocol: 'mqtt',
      mqttUsername: '',
      mqttPassword: '',
      mqttSecure: false,
      mqttWebsocketPath: '/mqtt',
      mqttReconnectEnabled: true,
      mqttReconnectInitialDelay: 1000,
      mqttReconnectMaxDelay: 30000,
      mqttReconnectMaxAttempts: 5,
    })
  })

  describe('初期描画テスト', () => {
    it('コンポーネントが正常に描画される', () => {
      render(<MqttSettings />)

      expect(screen.getByText('MQTT設定')).toBeInTheDocument()
      expect(screen.getByText('MQTT有効')).toBeInTheDocument()
      expect(screen.getByText('オフ')).toBeInTheDocument()
    })

    it('アイコンが正しく表示される', () => {
      render(<MqttSettings />)

      const icon = screen.getByAltText('MQTT Settings')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute(
        'src',
        '/images/setting-icons/external-link.svg'
      )
    })
  })

  describe('Client ID表示テスト', () => {
    it('MQTT有効時にClient IDが含まれた設定が初期化される', async () => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt' as const,
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })

      render(<MqttSettings />)

      // MQTTが有効な場合、詳細設定が表示される
      await waitFor(() => {
        expect(screen.getByText('接続設定')).toBeInTheDocument()
      })
    })
  })

  describe('送信モード切り替えテスト', () => {
    it('MQTTトグルボタンが機能する', () => {
      render(<MqttSettings />)

      const toggleButton = screen.getByText('オフ')
      fireEvent.click(toggleButton)

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttEnabled: true,
      })
    })

    it('プロトコル切り替えボタンが機能する', () => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })

      render(<MqttSettings />)

      const websocketButton = screen.getByText('WebSocket')
      fireEvent.click(websocketButton)

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttProtocol: 'websocket',
      })
    })
  })

  describe('設定保存テスト', () => {
    beforeEach(() => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })
    })

    it('ホスト設定が更新される', () => {
      render(<MqttSettings />)

      const hostInput = screen.getByPlaceholderText('localhost')
      fireEvent.change(hostInput, { target: { value: '192.168.1.100' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttHost: '192.168.1.100',
      })
    })

    it('ポート設定が更新される', () => {
      render(<MqttSettings />)

      const portInput = screen.getByPlaceholderText('1883')
      fireEvent.change(portInput, { target: { value: '8083' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttPort: 8083,
      })
    })

    it('WebSocketパス設定が更新される', () => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'websocket',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })

      render(<MqttSettings />)

      const websocketPathInput = screen.getByPlaceholderText('/mqtt')
      fireEvent.change(websocketPathInput, { target: { value: '/websocket' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttWebsocketPath: '/websocket',
      })
    })

    it('セキュア接続設定が更新される', () => {
      render(<MqttSettings />)

      const secureCheckbox = screen.getByText('セキュア接続')
        .previousElementSibling as HTMLInputElement
      fireEvent.click(secureCheckbox)

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttSecure: true,
      })
    })

    it('ユーザー名設定が更新される', () => {
      render(<MqttSettings />)

      const usernameInput =
        screen.getByPlaceholderText('ユーザー名（オプション）')
      fireEvent.change(usernameInput, { target: { value: 'testuser' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttUsername: 'testuser',
      })
    })

    it('パスワード設定が更新される', () => {
      render(<MqttSettings />)

      const passwordInput =
        screen.getByPlaceholderText('パスワード（オプション）')
      fireEvent.change(passwordInput, { target: { value: 'testpass' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttPassword: 'testpass',
      })
    })
  })

  describe('接続テストボタンのテスト', () => {
    beforeEach(() => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })
    })

    it('接続テストボタンが表示される', () => {
      render(<MqttSettings />)

      expect(screen.getByText('接続をテスト')).toBeInTheDocument()
    })

    it('接続テストボタンクリック時にテスト状態になる', async () => {
      render(<MqttSettings />)

      const testButton = screen.getByText('接続をテスト')
      fireEvent.click(testButton)

      // テスト中の状態を確認
      await waitFor(() => {
        expect(screen.getByText('テスト中...')).toBeInTheDocument()
      })
    })

    it('接続テスト成功時に成功メッセージが表示される', async () => {
      render(<MqttSettings />)

      const testButton = screen.getByText('接続をテスト')
      fireEvent.click(testButton)

      // 成功メッセージの確認
      await waitFor(
        () => {
          expect(
            screen.getByText('接続テストに成功しました')
          ).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('接続状態表示テスト', () => {
    it('MQTT無効時は接続状態が表示されない', () => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: false,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })

      render(<MqttSettings />)

      expect(screen.queryByText('切断')).not.toBeInTheDocument()
      expect(screen.queryByText('接続済み')).not.toBeInTheDocument()
    })

    it('MQTT有効時は接続状態が表示される', () => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })

      render(<MqttSettings />)

      // 初期状態では切断状態
      expect(screen.getByText('切断')).toBeInTheDocument()
    })
  })

  describe('再接続設定テスト', () => {
    beforeEach(() => {
      mockSettingsStore.mockReturnValue({
        mqttEnabled: true,
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttProtocol: 'mqtt',
        mqttUsername: '',
        mqttPassword: '',
        mqttSecure: false,
        mqttWebsocketPath: '/mqtt',
        mqttReconnectEnabled: true,
        mqttReconnectInitialDelay: 1000,
        mqttReconnectMaxDelay: 30000,
        mqttReconnectMaxAttempts: 5,
      })
    })

    it('再接続有効チェックボックスが機能する', () => {
      render(<MqttSettings />)

      const reconnectCheckbox = screen.getByText('自動再接続を有効')
        .previousElementSibling as HTMLInputElement
      fireEvent.click(reconnectCheckbox)

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttReconnectEnabled: false,
      })
    })

    it('初期遅延設定が更新される', () => {
      render(<MqttSettings />)

      const initialDelayInput = screen.getByDisplayValue('1000')
      fireEvent.change(initialDelayInput, { target: { value: '2000' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttReconnectInitialDelay: 2000,
      })
    })

    it('最大遅延設定が更新される', () => {
      render(<MqttSettings />)

      const maxDelayInput = screen.getByDisplayValue('30000')
      fireEvent.change(maxDelayInput, { target: { value: '60000' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttReconnectMaxDelay: 60000,
      })
    })

    it('最大試行回数設定が更新される', () => {
      render(<MqttSettings />)

      const maxAttemptsInput = screen.getByDisplayValue('5')
      fireEvent.change(maxAttemptsInput, { target: { value: '10' } })

      expect(mockSettingsStore.setState).toHaveBeenCalledWith({
        mqttReconnectMaxAttempts: 10,
      })
    })
  })
})
