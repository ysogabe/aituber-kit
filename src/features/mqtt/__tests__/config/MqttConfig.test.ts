import { MqttConfigLoader } from '../../config/MqttConfig'

// Mock environment variables
const mockEnvVars = {
  NEXT_PUBLIC_MQTT_ENABLED: 'true',
  NEXT_PUBLIC_MQTT_HOST: '192.168.0.131',
  NEXT_PUBLIC_MQTT_PORT: '8083',
  NEXT_PUBLIC_MQTT_CLIENT_ID: 'aituber-test',
  NEXT_PUBLIC_MQTT_PROTOCOL: 'websocket',
  NEXT_PUBLIC_MQTT_WEBSOCKET_PATH: '/mqtt',
  NEXT_PUBLIC_MQTT_USERNAME: 'testuser',
  NEXT_PUBLIC_MQTT_PASSWORD: 'testpass',
  NEXT_PUBLIC_MQTT_SECURE: 'false',
  NEXT_PUBLIC_MQTT_RECONNECT_ENABLED: 'true',
  NEXT_PUBLIC_MQTT_RECONNECT_INITIAL_DELAY: '2000',
  NEXT_PUBLIC_MQTT_RECONNECT_MAX_DELAY: '60000',
  NEXT_PUBLIC_MQTT_RECONNECT_MAX_ATTEMPTS: '10',
}

describe('MqttConfigLoader', () => {
  let originalEnv: typeof process.env

  beforeEach(() => {
    originalEnv = process.env
    // Clear existing env vars and set test values
    jest.resetModules()
    process.env = { ...originalEnv, ...mockEnvVars }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      const config = MqttConfigLoader.loadConfig()

      expect(config.enabled).toBe(true)
      expect(config.connection.host).toBe('192.168.0.131')
      expect(config.connection.port).toBe(8083)
      expect(config.connection.clientId).toBe('aituber-test')
      expect(config.connection.protocol).toBe('websocket')
      expect(config.connection.websocketPath).toBe('/mqtt')
      expect(config.connection.username).toBe('testuser')
      expect(config.connection.password).toBe('testpass')
      expect(config.connection.secure).toBe(false)
    })

    it('should load reconnect configuration', () => {
      const config = MqttConfigLoader.loadConfig()

      expect(config.reconnect.enabled).toBe(true)
      expect(config.reconnect.initialDelay).toBe(2000)
      expect(config.reconnect.maxDelay).toBe(60000)
      expect(config.reconnect.maxAttempts).toBe(10)
    })

    it('should load default subscriptions', () => {
      const config = MqttConfigLoader.loadConfig()

      expect(config.subscriptions).toHaveLength(3)
      expect(config.subscriptions[0].topic).toBe('aituber/speech')
      expect(config.subscriptions[1].topic).toBe('aituber/speech/alert')
      expect(config.subscriptions[2].topic).toBe('aituber/speech/notification')

      config.subscriptions.forEach((sub) => {
        expect(sub.qos).toBe(1)
        expect(sub.active).toBe(true)
      })
    })

    it('should return disabled config when MQTT is disabled', () => {
      process.env.NEXT_PUBLIC_MQTT_ENABLED = 'false'

      const config = MqttConfigLoader.loadConfig()

      expect(config.enabled).toBe(false)
      expect(config.subscriptions).toHaveLength(0)
    })

    it('should use default values for missing environment variables', () => {
      // Remove specific env vars to test defaults
      delete process.env.NEXT_PUBLIC_MQTT_HOST
      delete process.env.NEXT_PUBLIC_MQTT_PORT
      delete process.env.NEXT_PUBLIC_MQTT_PROTOCOL

      const config = MqttConfigLoader.loadConfig()

      expect(config.connection.host).toBe('localhost')
      expect(config.connection.port).toBe(1883)
      expect(config.connection.protocol).toBe('mqtt')
    })

    it('should generate unique client ID when not provided', () => {
      delete process.env.NEXT_PUBLIC_MQTT_CLIENT_ID

      const config1 = MqttConfigLoader.loadConfig()
      const config2 = MqttConfigLoader.loadConfig()

      expect(config1.connection.clientId).toMatch(/^aituber-\d+-[a-z0-9]+$/)
      expect(config2.connection.clientId).toMatch(/^aituber-\d+-[a-z0-9]+$/)
      expect(config1.connection.clientId).not.toBe(config2.connection.clientId)
    })

    it('should handle additional subscription topics from environment', () => {
      process.env.NEXT_PUBLIC_MQTT_SPEECH_TOPICS =
        'custom/topic1,custom/topic2,  custom/topic3  '

      const config = MqttConfigLoader.loadConfig()

      expect(config.subscriptions).toHaveLength(6) // 3 default + 3 custom
      expect(config.subscriptions[3].topic).toBe('custom/topic1')
      expect(config.subscriptions[4].topic).toBe('custom/topic2')
      expect(config.subscriptions[5].topic).toBe('custom/topic3')
    })
  })

  describe('validateConfig', () => {
    it('should return no errors for valid configuration', () => {
      const config = MqttConfigLoader.loadConfig()
      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toHaveLength(0)
    })

    it('should skip validation for disabled configuration', () => {
      process.env.NEXT_PUBLIC_MQTT_ENABLED = 'false'
      const config = MqttConfigLoader.loadConfig()
      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toHaveLength(0)
    })

    it('should validate required connection fields', () => {
      const config = MqttConfigLoader.loadConfig()
      config.connection.host = ''
      config.connection.clientId = ''

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain('MQTT host is required')
      expect(errors).toContain('MQTT client ID is required')
    })

    it('should validate port range', () => {
      const config = MqttConfigLoader.loadConfig()
      config.connection.port = 0

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain('MQTT port must be between 1 and 65535')
    })

    it('should validate protocol values', () => {
      const config = MqttConfigLoader.loadConfig()
      // @ts-ignore - intentionally setting invalid value for test
      config.connection.protocol = 'invalid'

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain('MQTT protocol must be "mqtt" or "websocket"')
    })

    it('should validate WebSocket path requirement', () => {
      const config = MqttConfigLoader.loadConfig()
      config.connection.protocol = 'websocket'
      config.connection.websocketPath = undefined

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain(
        'WebSocket path is required when using websocket protocol'
      )
    })

    it('should validate subscription topics', () => {
      const config = MqttConfigLoader.loadConfig()
      config.subscriptions = []

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain('At least one subscription topic is required')
    })

    it('should validate QoS levels', () => {
      const config = MqttConfigLoader.loadConfig()
      // @ts-ignore - intentionally setting invalid value for test
      config.subscriptions[0].qos = 3

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain('Invalid QoS level: 3')
    })

    it('should validate reconnect configuration', () => {
      const config = MqttConfigLoader.loadConfig()
      config.reconnect.initialDelay = -1
      config.reconnect.maxDelay = -1 // Set to negative to trigger other validation
      config.reconnect.maxAttempts = -1

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain('Reconnect initial delay must be non-negative')
      expect(errors).toContain(
        'Reconnect max attempts must be non-negative (0 for unlimited)'
      )
    })

    it('should validate max delay is greater than initial delay', () => {
      const config = MqttConfigLoader.loadConfig()
      config.reconnect.initialDelay = 1000
      config.reconnect.maxDelay = 500 // less than initial delay

      const errors = MqttConfigLoader.validateConfig(config)

      expect(errors).toContain(
        'Reconnect max delay must be greater than or equal to initial delay'
      )
    })
  })

  describe('configToEnvString', () => {
    it('should convert configuration to environment string format', () => {
      const config = MqttConfigLoader.loadConfig()
      const envString = MqttConfigLoader.configToEnvString(config)

      expect(envString).toContain('NEXT_PUBLIC_MQTT_ENABLED=true')
      expect(envString).toContain('NEXT_PUBLIC_MQTT_HOST=192.168.0.131')
      expect(envString).toContain('NEXT_PUBLIC_MQTT_PORT=8083')
      expect(envString).toContain('NEXT_PUBLIC_MQTT_PROTOCOL=websocket')
      expect(envString).toContain('NEXT_PUBLIC_MQTT_WEBSOCKET_PATH=/mqtt')
      expect(envString).toContain('NEXT_PUBLIC_MQTT_USERNAME=testuser')
      expect(envString).toContain('NEXT_PUBLIC_MQTT_PASSWORD=***') // Should be redacted
    })

    it('should handle optional fields correctly', () => {
      const config = MqttConfigLoader.loadConfig()
      config.connection.username = undefined
      config.connection.password = undefined
      config.connection.websocketPath = undefined

      const envString = MqttConfigLoader.configToEnvString(config)

      expect(envString).not.toContain('NEXT_PUBLIC_MQTT_USERNAME=')
      expect(envString).not.toContain('NEXT_PUBLIC_MQTT_PASSWORD=')
      expect(envString).not.toContain('NEXT_PUBLIC_MQTT_WEBSOCKET_PATH=')
    })
  })
})
