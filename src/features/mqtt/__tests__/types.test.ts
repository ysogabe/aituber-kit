import { SpeechPayload, MqttConfig, MqttIntegrationConfig } from '../types'

describe('MQTT Types', () => {
  describe('SpeechPayload', () => {
    it('should validate SpeechPayload interface', () => {
      const validPayload: SpeechPayload = {
        id: 'test-001',
        text: 'Hello AITuber',
        type: 'speech',
        priority: 'medium',
        timestamp: '2025-06-15T10:30:00.000Z',
      }

      expect(validPayload.id).toBe('test-001')
      expect(validPayload.text).toBe('Hello AITuber')
      expect(validPayload.type).toBe('speech')
      expect(validPayload.priority).toBe('medium')
      expect(validPayload.timestamp).toBe('2025-06-15T10:30:00.000Z')
    })

    it('should allow optional fields', () => {
      const payloadWithOptionals: SpeechPayload = {
        id: 'test-002',
        text: 'Hello with emotion',
        type: 'alert',
        priority: 'high',
        timestamp: '2025-06-15T10:30:00.000Z',
        speaker: 'TestSpeaker',
        emotion: 'happy',
        voice: 'voice-001',
        speed: 1.2,
        pitch: 0.5,
        metadata: { category: 'test' },
      }

      expect(payloadWithOptionals.speaker).toBe('TestSpeaker')
      expect(payloadWithOptionals.emotion).toBe('happy')
      expect(payloadWithOptionals.voice).toBe('voice-001')
      expect(payloadWithOptionals.speed).toBe(1.2)
      expect(payloadWithOptionals.pitch).toBe(0.5)
      expect(payloadWithOptionals.metadata).toEqual({ category: 'test' })
    })

    it('should allow valid type values', () => {
      const speechTypes: Array<SpeechPayload['type']> = [
        'speech',
        'alert',
        'notification',
      ]

      speechTypes.forEach((type) => {
        const payload: SpeechPayload = {
          id: `test-${type}`,
          text: `Test ${type}`,
          type,
          priority: 'medium',
          timestamp: '2025-06-15T10:30:00.000Z',
        }
        expect(payload.type).toBe(type)
      })
    })

    it('should allow valid priority values', () => {
      const priorities: Array<SpeechPayload['priority']> = [
        'high',
        'medium',
        'low',
      ]

      priorities.forEach((priority) => {
        const payload: SpeechPayload = {
          id: `test-${priority}`,
          text: `Test ${priority} priority`,
          type: 'speech',
          priority,
          timestamp: '2025-06-15T10:30:00.000Z',
        }
        expect(payload.priority).toBe(priority)
      })
    })

    it('should allow valid emotion values', () => {
      const emotions: Array<SpeechPayload['emotion']> = [
        'neutral',
        'happy',
        'sad',
        'angry',
        'relaxed',
        'surprised',
      ]

      emotions.forEach((emotion) => {
        const payload: SpeechPayload = {
          id: `test-${emotion}`,
          text: `Test ${emotion} emotion`,
          type: 'speech',
          priority: 'medium',
          timestamp: '2025-06-15T10:30:00.000Z',
          emotion,
        }
        expect(payload.emotion).toBe(emotion)
      })
    })
  })

  describe('MqttConfig', () => {
    it('should validate MqttConfig interface', () => {
      const config: MqttConfig = {
        host: '192.168.0.131',
        port: 8083,
        clientId: 'aituber-test',
        protocol: 'websocket',
      }

      expect(config.host).toBe('192.168.0.131')
      expect(config.port).toBe(8083)
      expect(config.clientId).toBe('aituber-test')
      expect(config.protocol).toBe('websocket')
    })

    it('should allow optional WebSocket path', () => {
      const config: MqttConfig = {
        host: 'localhost',
        port: 8083,
        clientId: 'test-client',
        protocol: 'websocket',
        websocketPath: '/mqtt',
      }

      expect(config.websocketPath).toBe('/mqtt')
    })

    it('should allow authentication credentials', () => {
      const config: MqttConfig = {
        host: 'localhost',
        port: 1883,
        clientId: 'test-client',
        protocol: 'mqtt',
        username: 'user',
        password: 'pass',
        secure: true,
      }

      expect(config.username).toBe('user')
      expect(config.password).toBe('pass')
      expect(config.secure).toBe(true)
    })
  })

  describe('MqttIntegrationConfig', () => {
    it('should validate complete integration config', () => {
      const config: MqttIntegrationConfig = {
        enabled: true,
        connection: {
          host: '192.168.0.131',
          port: 8083,
          clientId: 'aituber-integration',
          protocol: 'websocket',
          websocketPath: '/mqtt',
        },
        subscriptions: [
          {
            topic: 'aituber/speech',
            qos: 1,
            active: true,
          },
        ],
        reconnect: {
          enabled: true,
          initialDelay: 1000,
          maxDelay: 30000,
          maxAttempts: 5,
        },
      }

      expect(config.enabled).toBe(true)
      expect(config.connection.host).toBe('192.168.0.131')
      expect(config.subscriptions).toHaveLength(1)
      expect(config.subscriptions[0].topic).toBe('aituber/speech')
      expect(config.reconnect.enabled).toBe(true)
    })

    it('should allow disabled configuration', () => {
      const config: MqttIntegrationConfig = {
        enabled: false,
        connection: {
          host: 'localhost',
          port: 1883,
          clientId: 'disabled-client',
          protocol: 'mqtt',
        },
        subscriptions: [],
        reconnect: {
          enabled: false,
          initialDelay: 1000,
          maxDelay: 30000,
          maxAttempts: 0,
        },
      }

      expect(config.enabled).toBe(false)
      expect(config.subscriptions).toHaveLength(0)
      expect(config.reconnect.enabled).toBe(false)
    })
  })
})
