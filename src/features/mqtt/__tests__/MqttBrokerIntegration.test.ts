import { MqttBrokerIntegration } from '../MqttBrokerIntegration'
import { useMqttBrokerStore } from '@/features/stores/mqttBrokerSettings'
import { diagnoseMqttConfig } from '../utils/errorHandler'

// Zustandストアのモック
jest.mock('@/features/stores/mqttBrokerSettings', () => ({
  useMqttBrokerStore: {
    getState: jest.fn(),
  },
}))

// settingsStoreのモック
jest.mock('@/features/stores/settings', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
    setState: jest.fn(),
  },
}))

// mqttClientIdGeneratorのモック
jest.mock('../utils/mqttClientIdGenerator', () => ({
  generateAituberClientId: jest.fn(() => 'aituber-test-12345'),
  isAituberClientId: jest.fn((id: string) => id.startsWith('aituber-')),
  convertLegacyClientId: jest.fn((id: string) => `aituber-${id}`),
}))

// errorHandlerのモック
jest.mock('../utils/errorHandler', () => ({
  analyzeMqttError: jest.fn((error: Error) => ({
    type: 'connection',
    message: error.message,
  })),
  formatMqttError: jest.fn((errorInfo: any) => errorInfo.message),
  diagnoseMqttConfig: jest.fn(() => ({
    valid: true,
    issues: [],
    warnings: [],
  })),
}))

const mockUseMqttBrokerStore = useMqttBrokerStore as jest.MockedObject<
  typeof useMqttBrokerStore
>

const mockDiagnoseMqttConfig = diagnoseMqttConfig as jest.MockedFunction<
  typeof diagnoseMqttConfig
>

describe('MqttBrokerIntegration', () => {
  let integration: MqttBrokerIntegration

  beforeEach(() => {
    integration = MqttBrokerIntegration.getInstance()

    // デフォルト設定をモック
    mockUseMqttBrokerStore.getState.mockReturnValue({
      sendMode: 'direct_send',
      defaultMessageType: 'speech',
      defaultPriority: 'medium',
      defaultEmotion: null,
      includeTimestamp: false,
      includeMetadata: false,
      updateMqttBrokerConfig: jest.fn(),
      generateNewClientId: jest.fn(),
      updateConnectionStatus: jest.fn(),
      getBasicSettings: () => ({
        enabled: true,
        clientId: 'test-client-id',
        host: '192.168.0.131',
        port: 1883,
        protocol: 'websocket' as const,
        websocketPath: '/mqtt',
        username: undefined,
        password: undefined,
        secure: false,
        reconnectEnabled: true,
        reconnectInitialDelay: 1000,
        reconnectMaxDelay: 30000,
        reconnectMaxAttempts: 5,
      }),
      getBrokerUrl: () => 'ws://192.168.0.131:1883',
      getConnectionStatus: () => 'disconnected' as const,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('シングルトンパターンのテスト', () => {
    it('同じインスタンスを返す', () => {
      const instance1 = MqttBrokerIntegration.getInstance()
      const instance2 = MqttBrokerIntegration.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('設定の妥当性チェック', () => {
    it('有効な設定を受け入れる', () => {
      const config = {
        brokerUrl: 'ws://192.168.0.131:1883',
        brokerPort: 1883,
        clientId: 'test-client',
      }

      const result = integration.validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('無効なURL形式を拒否する', () => {
      // 無効な診断結果を設定
      mockDiagnoseMqttConfig.mockReturnValue({
        valid: false,
        issues: ['URLが無効です'],
        warnings: [],
      })

      const config = {
        brokerUrl: 'invalid-url',
        brokerPort: 1883,
        clientId: 'test-client',
      }

      const result = integration.validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('無効なポート番号を拒否する', () => {
      // 無効な診断結果を設定
      mockDiagnoseMqttConfig.mockReturnValue({
        valid: false,
        issues: ['ポート番号が無効です（1-65535の範囲で設定してください）'],
        warnings: [],
      })

      const config = {
        brokerUrl: 'ws://localhost:70000',
        brokerPort: 70000,
        clientId: 'test-client',
      }

      const result = integration.validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        'ポート番号が無効です（1-65535の範囲で設定してください）'
      )
    })

    it('空のクライアントIDを拒否する', () => {
      // 無効な診断結果を設定
      mockDiagnoseMqttConfig.mockReturnValue({
        valid: false,
        issues: ['クライアントIDが設定されていません'],
        warnings: [],
      })

      const config = {
        brokerUrl: 'ws://localhost:1883',
        brokerPort: 1883,
        clientId: '',
      }

      const result = integration.validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('クライアントIDが設定されていません')
    })
  })

  describe('接続設定の構築', () => {
    it('ストア設定から接続設定を構築する', () => {
      const config = integration.buildConnectionConfig()

      expect(config).toEqual({
        brokerUrl: 'ws://192.168.0.131:1883',
        brokerPort: 1883,
        clientId: 'aituber-test-client-id', // convertLegacyClientIdが呼ばれる
        username: undefined,
        password: undefined,
        secure: false,
      })
    })

    it('既存の有効なAITuber ClientIDを使用する', () => {
      const mockState = mockUseMqttBrokerStore.getState()
      mockUseMqttBrokerStore.getState.mockReturnValue({
        ...mockState,
        getBasicSettings: () => ({
          ...mockState.getBasicSettings(),
          clientId: 'aituber-existing-12345',
        }),
      })

      const config = integration.buildConnectionConfig()
      expect(config.clientId).toBe('aituber-existing-12345')
    })

    it('無効なClientIDの場合は新規生成する', () => {
      const mockState = mockUseMqttBrokerStore.getState()
      mockUseMqttBrokerStore.getState.mockReturnValue({
        ...mockState,
        getBasicSettings: () => ({
          ...mockState.getBasicSettings(),
          clientId: 'old-client-id',
        }),
      })

      const config = integration.buildConnectionConfig()
      expect(config.clientId).toBe('aituber-old-client-id')
    })
  })

  describe('ペイロード生成のテスト', () => {
    it('後方互換性: direct_sendモードでシンプルペイロードを生成', () => {
      const result = integration.generatePayload('Hello World')

      expect(result).toBe('Hello World')
    })

    it('構造化ペイロードを生成（タイムスタンプ有効）', () => {
      const mockState = mockUseMqttBrokerStore.getState()
      mockUseMqttBrokerStore.getState.mockReturnValue({
        ...mockState,
        includeTimestamp: true,
      })

      const result = integration.generatePayload('Hello World')

      expect(typeof result).toBe('object')
      expect((result as any).text).toBe('Hello World')
      expect((result as any).type).toBe('speech')
      expect((result as any).priority).toBe('medium')
      expect((result as any).timestamp).toBeDefined()
    })

    it('構造化ペイロードを生成（メタデータ有効）', () => {
      const mockState = mockUseMqttBrokerStore.getState()
      mockUseMqttBrokerStore.getState.mockReturnValue({
        ...mockState,
        includeMetadata: true,
      })

      const result = integration.generatePayload('Hello World')

      expect(typeof result).toBe('object')
      expect((result as any).metadata).toBeDefined()
      expect((result as any).metadata.clientId).toBe('test-client-id')
      expect((result as any).metadata.sendMode).toBe('direct_send')
    })

    it('感情設定を含むペイロードを生成', () => {
      const mockState = mockUseMqttBrokerStore.getState()
      mockUseMqttBrokerStore.getState.mockReturnValue({
        ...mockState,
        defaultEmotion: 'happy',
      })

      const result = integration.generatePayload('Hello World')

      expect(typeof result).toBe('object')
      expect((result as any).emotion).toBe('happy')
    })

    it('カスタムオプションでペイロードを生成', () => {
      const options = {
        messageType: 'alert' as const,
        priority: 'high' as const,
        emotion: 'surprised' as const,
        includeTimestamp: true,
        includeMetadata: true,
      }

      const result = integration.generatePayload('Alert Message', options)

      expect(typeof result).toBe('object')
      expect((result as any).text).toBe('Alert Message')
      expect((result as any).type).toBe('alert')
      expect((result as any).priority).toBe('high')
      expect((result as any).emotion).toBe('surprised')
      expect((result as any).timestamp).toBeDefined()
      expect((result as any).metadata).toBeDefined()
    })
  })

  describe('ペイロード文字列化のテスト', () => {
    it('文字列ペイロードをそのまま返す', () => {
      const result = integration.stringifyPayload('Hello World')
      expect(result).toBe('Hello World')
    })

    it('オブジェクトペイロードをJSON文字列化', () => {
      const payload = {
        text: 'Hello World',
        type: 'speech' as const,
        priority: 'medium' as const,
      }

      const result = integration.stringifyPayload(payload)
      expect(result).toBe(JSON.stringify(payload))
    })
  })

  describe('ペイロード解析のテスト', () => {
    it('JSON文字列を構造化ペイロードに解析', () => {
      const jsonString = JSON.stringify({
        text: 'Hello World',
        type: 'speech',
        priority: 'medium',
      })

      const result = integration.parsePayload(jsonString)

      expect(typeof result).toBe('object')
      expect((result as any).text).toBe('Hello World')
      expect((result as any).type).toBe('speech')
      expect((result as any).priority).toBe('medium')
    })

    it('無効なJSONを文字列として扱う', () => {
      const invalidJson = 'Hello World'

      const result = integration.parsePayload(invalidJson)

      expect(result).toBe('Hello World')
    })

    it('不完全なオブジェクトを文字列として扱う', () => {
      const incompleteObject = JSON.stringify({
        text: 'Hello World',
        // type と priority が不足
      })

      const result = integration.parsePayload(incompleteObject)

      expect(result).toBe(incompleteObject)
    })
  })

  describe('後方互換性の確認', () => {
    it('デフォルト設定で後方互換性を保つ', () => {
      // デフォルト設定（speech, medium, null emotion, timestamp/metadata無効）
      const result = integration.generatePayload('Legacy Message')

      // シンプルな文字列を返すべき
      expect(result).toBe('Legacy Message')
    })

    it('任意の設定変更で構造化ペイロードに切り替わる', () => {
      const mockState = mockUseMqttBrokerStore.getState()
      mockUseMqttBrokerStore.getState.mockReturnValue({
        ...mockState,
        defaultMessageType: 'alert', // デフォルトから変更
      })

      const result = integration.generatePayload('Alert Message')

      // 構造化ペイロードを返すべき
      expect(typeof result).toBe('object')
      expect((result as any).type).toBe('alert')
    })
  })
})
