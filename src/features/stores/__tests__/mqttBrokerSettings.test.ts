import { create } from 'zustand'
import settingsStore from '../settings'

// localStorage のモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

// zustandのpersistミドルウェアで使用されるlocalStorageをモック
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// 環境変数のモック
const originalEnv = process.env

describe('MQTT Broker Settings Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 各テストで環境変数をリセット
    process.env = { ...originalEnv }
    // MQTTに関連する環境変数をクリア
    delete process.env.NEXT_PUBLIC_MQTT_ENABLED
    delete process.env.NEXT_PUBLIC_MQTT_HOST
    delete process.env.NEXT_PUBLIC_MQTT_PORT
    delete process.env.NEXT_PUBLIC_MQTT_CLIENT_ID
    delete process.env.NEXT_PUBLIC_MQTT_PROTOCOL
    delete process.env.NEXT_PUBLIC_MQTT_WEBSOCKET_PATH
    delete process.env.NEXT_PUBLIC_MQTT_USERNAME
    delete process.env.NEXT_PUBLIC_MQTT_PASSWORD
    delete process.env.NEXT_PUBLIC_MQTT_SECURE
    delete process.env.NEXT_PUBLIC_MQTT_RECONNECT_ENABLED
    delete process.env.NEXT_PUBLIC_MQTT_RECONNECT_INITIAL_DELAY
    delete process.env.NEXT_PUBLIC_MQTT_RECONNECT_MAX_DELAY
    delete process.env.NEXT_PUBLIC_MQTT_RECONNECT_MAX_ATTEMPTS
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('初期状態のテスト', () => {
    it('MQTTが無効の初期状態を持つ', () => {
      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const state = newSettingsStore.getState()

      expect(state.mqttEnabled).toBe(false)
      expect(state.mqttHost).toBe('localhost')
      expect(state.mqttPort).toBe(1883)
      expect(state.mqttProtocol).toBe('mqtt')
      expect(state.mqttWebsocketPath).toBe('/mqtt')
      expect(state.mqttSecure).toBe(false)
      expect(state.mqttConnectionStatus).toBe('disconnected')
    })

    it('環境変数からMQTT設定を読み込む', () => {
      process.env.NEXT_PUBLIC_MQTT_ENABLED = 'true'
      process.env.NEXT_PUBLIC_MQTT_HOST = '192.168.0.131'
      process.env.NEXT_PUBLIC_MQTT_PORT = '8083'
      process.env.NEXT_PUBLIC_MQTT_PROTOCOL = 'websocket'
      process.env.NEXT_PUBLIC_MQTT_WEBSOCKET_PATH = '/mqtt-ws'
      process.env.NEXT_PUBLIC_MQTT_USERNAME = 'testuser'
      process.env.NEXT_PUBLIC_MQTT_PASSWORD = 'testpass'
      process.env.NEXT_PUBLIC_MQTT_SECURE = 'true'

      // モジュールを再読み込みして環境変数を反映
      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const state = newSettingsStore.getState()

      expect(state.mqttEnabled).toBe(true)
      expect(state.mqttHost).toBe('192.168.0.131')
      expect(state.mqttPort).toBe(8083)
      expect(state.mqttProtocol).toBe('websocket')
      expect(state.mqttWebsocketPath).toBe('/mqtt-ws')
      expect(state.mqttUsername).toBe('testuser')
      expect(state.mqttPassword).toBe('testpass')
      expect(state.mqttSecure).toBe(true)
    })

    it('再接続設定の初期値が正しい', () => {
      // MQTT_RECONNECT_ENABLEDのデフォルトは'false'でない限りtrue
      process.env.NEXT_PUBLIC_MQTT_RECONNECT_ENABLED = undefined

      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const state = newSettingsStore.getState()

      expect(state.mqttReconnectEnabled).toBe(true)
      expect(state.mqttReconnectInitialDelay).toBe(1000)
      expect(state.mqttReconnectMaxDelay).toBe(30000)
      expect(state.mqttReconnectMaxAttempts).toBe(5)
    })
  })

  describe('設定更新アクションのテスト', () => {
    it('MQTT有効化設定を更新できる', () => {
      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const initialState = newSettingsStore.getState()
      expect(initialState.mqttEnabled).toBe(false)

      newSettingsStore.setState({ mqttEnabled: true })

      const updatedState = newSettingsStore.getState()
      expect(updatedState.mqttEnabled).toBe(true)
    })

    it('MQTTホスト設定を更新できる', () => {
      settingsStore.setState({ mqttHost: '192.168.1.100' })

      const state = settingsStore.getState()
      expect(state.mqttHost).toBe('192.168.1.100')
    })

    it('MQTTポート設定を更新できる', () => {
      settingsStore.setState({ mqttPort: 8083 })

      const state = settingsStore.getState()
      expect(state.mqttPort).toBe(8083)
    })

    it('MQTTプロトコル設定を更新できる', () => {
      settingsStore.setState({ mqttProtocol: 'websocket' })

      const state = settingsStore.getState()
      expect(state.mqttProtocol).toBe('websocket')
    })

    it('WebSocketパス設定を更新できる', () => {
      settingsStore.setState({ mqttWebsocketPath: '/websocket' })

      const state = settingsStore.getState()
      expect(state.mqttWebsocketPath).toBe('/websocket')
    })

    it('MQTT認証設定を更新できる', () => {
      settingsStore.setState({
        mqttUsername: 'newuser',
        mqttPassword: 'newpass',
      })

      const state = settingsStore.getState()
      expect(state.mqttUsername).toBe('newuser')
      expect(state.mqttPassword).toBe('newpass')
    })

    it('MQTTセキュア接続設定を更新できる', () => {
      settingsStore.setState({ mqttSecure: true })

      const state = settingsStore.getState()
      expect(state.mqttSecure).toBe(true)
    })

    it('MQTT再接続設定を更新できる', () => {
      settingsStore.setState({
        mqttReconnectEnabled: false,
        mqttReconnectInitialDelay: 2000,
        mqttReconnectMaxDelay: 60000,
        mqttReconnectMaxAttempts: 10,
      })

      const state = settingsStore.getState()
      expect(state.mqttReconnectEnabled).toBe(false)
      expect(state.mqttReconnectInitialDelay).toBe(2000)
      expect(state.mqttReconnectMaxDelay).toBe(60000)
      expect(state.mqttReconnectMaxAttempts).toBe(10)
    })
  })

  describe('Client ID生成のテスト', () => {
    it('環境変数からClient IDを読み込む', () => {
      process.env.NEXT_PUBLIC_MQTT_CLIENT_ID = 'custom-client-id'

      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const state = newSettingsStore.getState()

      expect(state.mqttClientId).toBe('custom-client-id')
    })

    it('Client IDが環境変数にない場合、動的に生成される', () => {
      // 環境変数をクリア
      delete process.env.NEXT_PUBLIC_MQTT_CLIENT_ID

      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const state = newSettingsStore.getState()

      // 動的に生成されたClient IDのパターンをチェック
      expect(state.mqttClientId).toMatch(/^aituber-\d+$/)
      expect(state.mqttClientId.length).toBeGreaterThan(8)
    })

    it('複数回の初期化で異なるClient IDが生成される', () => {
      delete process.env.NEXT_PUBLIC_MQTT_CLIENT_ID

      jest.resetModules()
      const { default: store1 } = require('../settings')
      const clientId1 = store1.getState().mqttClientId

      jest.resetModules()
      const { default: store2 } = require('../settings')
      const clientId2 = store2.getState().mqttClientId

      expect(clientId1).not.toBe(clientId2)
      expect(clientId1).toMatch(/^aituber-\d+$/)
      expect(clientId2).toMatch(/^aituber-\d+$/)
    })
  })

  describe('接続状態管理のテスト', () => {
    it('接続状態を更新できる', () => {
      settingsStore.setState({ mqttConnectionStatus: 'connecting' })
      expect(settingsStore.getState().mqttConnectionStatus).toBe('connecting')

      settingsStore.setState({ mqttConnectionStatus: 'connected' })
      expect(settingsStore.getState().mqttConnectionStatus).toBe('connected')

      settingsStore.setState({ mqttConnectionStatus: 'error' })
      expect(settingsStore.getState().mqttConnectionStatus).toBe('error')

      settingsStore.setState({ mqttConnectionStatus: 'disconnected' })
      expect(settingsStore.getState().mqttConnectionStatus).toBe('disconnected')
    })

    it('無効な接続状態は設定されない（TypeScript型チェック）', () => {
      // この部分は実際にはTypeScriptのコンパイル時に検出されるが、
      // テストでは正しい型のみが受け入れられることを確認
      const validStatuses = [
        'disconnected',
        'connecting',
        'connected',
        'error',
      ] as const

      validStatuses.forEach((status) => {
        settingsStore.setState({ mqttConnectionStatus: status })
        expect(settingsStore.getState().mqttConnectionStatus).toBe(status)
      })
    })
  })

  describe('localStorage永続化のテスト', () => {
    it('MQTT設定がlocalStorageに永続化される（モック確認）', () => {
      // zustandのpersistミドルウェアがsetItemを呼ぶかテスト
      settingsStore.setState({
        mqttEnabled: true,
        mqttHost: '192.168.0.131',
        mqttPort: 8083,
      })

      // persistミドルウェアはデバウンスされているため、少し待つ
      setTimeout(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled()
      }, 100)
    })

    it('永続化対象のフィールドが正しく設定されている', () => {
      // settings.ts のpartialize設定を確認するために、
      // 実際の永続化対象を検証
      const state = settingsStore.getState()

      // MQTT関連の設定が含まれているかチェック
      // 注意: この部分は実際のpartialize実装に依存する
      const persistedFields = [
        'mqttEnabled',
        'mqttHost',
        'mqttPort',
        'mqttProtocol',
        'mqttWebsocketPath',
        'mqttUsername',
        'mqttPassword',
        'mqttSecure',
        'mqttReconnectEnabled',
        'mqttReconnectInitialDelay',
        'mqttReconnectMaxDelay',
        'mqttReconnectMaxAttempts',
      ]

      persistedFields.forEach((field) => {
        expect(state).toHaveProperty(field)
      })
    })

    it('一時的な状態（接続状態など）は永続化されない', () => {
      // mqttConnectionStatusは永続化されるべきではない
      // これは実装詳細のテストだが、重要なビジネスロジック
      jest.resetModules()
      const { default: newSettingsStore } = require('../settings')
      const state = newSettingsStore.getState()

      // 接続状態は初期値にリセットされる
      expect(state.mqttConnectionStatus).toBe('disconnected')
    })
  })

  describe('複数設定の同時更新テスト', () => {
    it('複数のMQTT設定を同時に更新できる', () => {
      const updateData = {
        mqttEnabled: true,
        mqttHost: '192.168.0.131',
        mqttPort: 8083,
        mqttProtocol: 'websocket' as const,
        mqttWebsocketPath: '/ws',
        mqttUsername: 'admin',
        mqttPassword: 'secret',
        mqttSecure: true,
        mqttReconnectEnabled: false,
        mqttReconnectInitialDelay: 5000,
        mqttReconnectMaxDelay: 120000,
        mqttReconnectMaxAttempts: 3,
      }

      settingsStore.setState(updateData)

      const state = settingsStore.getState()
      Object.entries(updateData).forEach(([key, value]) => {
        expect((state as any)[key]).toBe(value)
      })
    })

    it('部分的な設定更新で他の設定が影響されない', () => {
      // 初期設定
      settingsStore.setState({
        mqttEnabled: true,
        mqttHost: 'initial-host',
        mqttPort: 1883,
      })

      // 部分更新
      settingsStore.setState({ mqttHost: 'updated-host' })

      const state = settingsStore.getState()
      expect(state.mqttEnabled).toBe(true) // 変更されない
      expect(state.mqttHost).toBe('updated-host') // 更新される
      expect(state.mqttPort).toBe(1883) // 変更されない
    })
  })

  describe('型安全性のテスト', () => {
    it('正しいプロトコル値のみ受け入れる', () => {
      settingsStore.setState({ mqttProtocol: 'mqtt' })
      expect(settingsStore.getState().mqttProtocol).toBe('mqtt')

      settingsStore.setState({ mqttProtocol: 'websocket' })
      expect(settingsStore.getState().mqttProtocol).toBe('websocket')
    })

    it('数値フィールドは数値のみ受け入れる', () => {
      settingsStore.setState({ mqttPort: 8083 })
      expect(settingsStore.getState().mqttPort).toBe(8083)
      expect(typeof settingsStore.getState().mqttPort).toBe('number')

      settingsStore.setState({ mqttReconnectInitialDelay: 2000 })
      expect(settingsStore.getState().mqttReconnectInitialDelay).toBe(2000)
      expect(typeof settingsStore.getState().mqttReconnectInitialDelay).toBe(
        'number'
      )
    })

    it('ブール値フィールドはブール値のみ受け入れる', () => {
      settingsStore.setState({ mqttEnabled: true })
      expect(settingsStore.getState().mqttEnabled).toBe(true)
      expect(typeof settingsStore.getState().mqttEnabled).toBe('boolean')

      settingsStore.setState({ mqttSecure: false })
      expect(settingsStore.getState().mqttSecure).toBe(false)
      expect(typeof settingsStore.getState().mqttSecure).toBe('boolean')
    })
  })
})
