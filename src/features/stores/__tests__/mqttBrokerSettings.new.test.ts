import { useMqttBrokerStore } from '../mqttBrokerSettings'
import { renderHook, act } from '@testing-library/react'

// localStorage のモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('MQTT Broker Settings Store (New)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    // Zustandストアの状態をリセット
    useMqttBrokerStore.getState().updateMqttBrokerConfig({
      enabled: false,
      brokerUrl: 'mqtt://192.168.0.131:1883',
      brokerPort: 1883,
      sendMode: 'direct_send',
      defaultMessageType: 'speech',
      defaultPriority: 'medium',
      defaultEmotion: null,
      includeTimestamp: false,
      includeMetadata: false,
    })
  })

  describe('初期状態のテスト', () => {
    it('適切なデフォルト値を持つ', () => {
      const { result } = renderHook(() => useMqttBrokerStore())
      const state = result.current

      expect(state.enabled).toBe(false)
      expect(state.brokerUrl).toBe('mqtt://192.168.0.131:1883')
      expect(state.brokerPort).toBe(1883)
      expect(state.sendMode).toBe('direct_send')
      expect(state.connectionStatus).toBe('disconnected')
      
      // ペイロードオプションのデフォルト値
      expect(state.defaultMessageType).toBe('speech')
      expect(state.defaultPriority).toBe('medium')
      expect(state.defaultEmotion).toBe(null)
      expect(state.includeTimestamp).toBe(false)
      expect(state.includeMetadata).toBe(false)
    })

    it('clientIdが生成される', () => {
      const { result } = renderHook(() => useMqttBrokerStore())
      
      expect(result.current.clientId).toBeDefined()
      expect(typeof result.current.clientId).toBe('string')
      expect(result.current.clientId.length).toBeGreaterThan(0)
    })
  })

  describe('設定更新のテスト', () => {
    it('MQTT設定を更新できる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      act(() => {
        result.current.updateMqttBrokerConfig({
          enabled: true,
          brokerUrl: 'mqtt://test.example.com:1883',
          brokerPort: 8883,
        })
      })

      expect(result.current.enabled).toBe(true)
      expect(result.current.brokerUrl).toBe('mqtt://test.example.com:1883')
      expect(result.current.brokerPort).toBe(8883)
    })

    it('ペイロードオプションを更新できる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      act(() => {
        result.current.updateMqttBrokerConfig({
          defaultMessageType: 'alert',
          defaultPriority: 'high',
          defaultEmotion: 'happy',
          includeTimestamp: true,
          includeMetadata: true,
        })
      })

      expect(result.current.defaultMessageType).toBe('alert')
      expect(result.current.defaultPriority).toBe('high')
      expect(result.current.defaultEmotion).toBe('happy')
      expect(result.current.includeTimestamp).toBe(true)
      expect(result.current.includeMetadata).toBe(true)
    })

    it('送信モードを更新できる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      act(() => {
        result.current.updateMqttBrokerConfig({ sendMode: 'ai_generated' })
      })

      expect(result.current.sendMode).toBe('ai_generated')
    })
  })

  describe('クライアントID生成のテスト', () => {
    it('新しいクライアントIDを生成できる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())
      const originalClientId = result.current.clientId

      act(() => {
        result.current.generateNewClientId()
      })

      expect(result.current.clientId).not.toBe(originalClientId)
      expect(result.current.clientId).toBeDefined()
      expect(typeof result.current.clientId).toBe('string')
    })
  })

  describe('接続状態管理のテスト', () => {
    it('接続状態を更新できる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      act(() => {
        result.current.updateConnectionStatus('connecting')
      })
      expect(result.current.connectionStatus).toBe('connecting')

      act(() => {
        result.current.updateConnectionStatus('connected')
      })
      expect(result.current.connectionStatus).toBe('connected')

      act(() => {
        result.current.updateConnectionStatus('error')
      })
      expect(result.current.connectionStatus).toBe('error')

      act(() => {
        result.current.updateConnectionStatus('disconnected')
      })
      expect(result.current.connectionStatus).toBe('disconnected')
    })
  })

  describe('後方互換性のテスト', () => {
    it('既存の設定と共存できる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      // 既存の設定項目
      act(() => {
        result.current.updateMqttBrokerConfig({
          enabled: true,
          brokerUrl: 'mqtt://legacy.example.com:1883',
          sendMode: 'direct_send',
        })
      })

      // 新しい設定項目のデフォルト値が維持される
      expect(result.current.defaultMessageType).toBe('speech')
      expect(result.current.defaultPriority).toBe('medium')
      expect(result.current.defaultEmotion).toBe(null)
      expect(result.current.includeTimestamp).toBe(false)
      expect(result.current.includeMetadata).toBe(false)

      // 既存設定は正常に動作
      expect(result.current.enabled).toBe(true)
      expect(result.current.brokerUrl).toBe('mqtt://legacy.example.com:1883')
      expect(result.current.sendMode).toBe('direct_send')
    })

    it('部分的な更新で他の設定が影響されない', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      // 初期設定
      act(() => {
        result.current.updateMqttBrokerConfig({
          enabled: true,
          defaultMessageType: 'alert',
          defaultPriority: 'high',
        })
      })

      // 部分更新
      act(() => {
        result.current.updateMqttBrokerConfig({
          brokerUrl: 'mqtt://updated.example.com:1883',
        })
      })

      // 変更された項目
      expect(result.current.brokerUrl).toBe('mqtt://updated.example.com:1883')
      
      // 変更されていない項目
      expect(result.current.enabled).toBe(true)
      expect(result.current.defaultMessageType).toBe('alert')
      expect(result.current.defaultPriority).toBe('high')
    })
  })

  describe('型安全性のテスト', () => {
    it('正しいメッセージタイプのみ受け入れる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      const validTypes = ['speech', 'alert', 'notification'] as const
      
      validTypes.forEach(type => {
        act(() => {
          result.current.updateMqttBrokerConfig({ defaultMessageType: type })
        })
        expect(result.current.defaultMessageType).toBe(type)
      })
    })

    it('正しい優先度のみ受け入れる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      const validPriorities = ['high', 'medium', 'low'] as const
      
      validPriorities.forEach(priority => {
        act(() => {
          result.current.updateMqttBrokerConfig({ defaultPriority: priority })
        })
        expect(result.current.defaultPriority).toBe(priority)
      })
    })

    it('正しい感情タイプのみ受け入れる', () => {
      const { result } = renderHook(() => useMqttBrokerStore())

      const validEmotions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'] as const
      
      validEmotions.forEach(emotion => {
        act(() => {
          result.current.updateMqttBrokerConfig({ defaultEmotion: emotion })
        })
        expect(result.current.defaultEmotion).toBe(emotion)
      })

      // nullも許可される
      act(() => {
        result.current.updateMqttBrokerConfig({ defaultEmotion: null })
      })
      expect(result.current.defaultEmotion).toBe(null)
    })
  })
})