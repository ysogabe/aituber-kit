import {
  generateAituberClientId,
  isAituberClientId,
  convertLegacyClientId,
  extractTimestampFromClientId,
} from '../mqttClientIdGenerator'

describe('mqttClientIdGenerator', () => {
  describe('generateAituberClientId', () => {
    it('should generate a unique client ID with correct format', () => {
      const clientId1 = generateAituberClientId()
      const clientId2 = generateAituberClientId()

      // Format check: aituber-{uuid}-{timestamp}
      expect(clientId1).toMatch(
        /^aituber-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-\d{13}$/
      )
      expect(clientId2).toMatch(
        /^aituber-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-\d{13}$/
      )

      // Uniqueness check
      expect(clientId1).not.toBe(clientId2)
    })

    it('should generate client IDs with increasing timestamps', (done) => {
      const clientId1 = generateAituberClientId()

      setTimeout(() => {
        const clientId2 = generateAituberClientId()

        const timestamp1 = extractTimestampFromClientId(clientId1)
        const timestamp2 = extractTimestampFromClientId(clientId2)

        expect(timestamp2).toBeGreaterThan(timestamp1!)
        done()
      }, 10)
    })

    it('should generate valid UUID v4 in the client ID', () => {
      const clientId = generateAituberClientId()
      const parts = clientId.split('-')

      // Extract UUID parts (skipping 'aituber' prefix and timestamp suffix)
      const uuid = parts.slice(1, 6).join('-')

      // UUID v4 validation
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    })
  })

  describe('isAituberClientId', () => {
    it('should return true for valid AITuber client IDs', () => {
      const validClientId =
        'aituber-550e8400-e29b-41d4-a716-446655440000-1234567890123'
      expect(isAituberClientId(validClientId)).toBe(true)
    })

    it('should return false for legacy client IDs', () => {
      const legacyClientIds = [
        'mqttjs_12345678',
        'mqtt_client_123',
        'custom-client-id',
        'aituber_old_format',
      ]

      legacyClientIds.forEach((id) => {
        expect(isAituberClientId(id)).toBe(false)
      })
    })

    it('should return false for invalid formats', () => {
      const invalidIds = [
        'aituber-invalid-uuid-1234567890123',
        'aituber-550e8400-e29b-41d4-a716-446655440000', // missing timestamp
        'aituber-550e8400-e29b-41d4-a716-446655440000-abc', // invalid timestamp
        'prefix-550e8400-e29b-41d4-a716-446655440000-1234567890123', // wrong prefix
        '', // empty string
      ]

      invalidIds.forEach((id) => {
        expect(isAituberClientId(id)).toBe(false)
      })
    })
  })

  describe('convertLegacyClientId', () => {
    it('should convert legacy client ID to AITuber format', () => {
      const legacyId = 'mqttjs_12345678'
      const convertedId = convertLegacyClientId(legacyId)

      expect(isAituberClientId(convertedId)).toBe(true)
      expect(convertedId).toContain(legacyId)
    })

    it('should return AITuber client ID unchanged', () => {
      const aituberClientId =
        'aituber-550e8400-e29b-41d4-a716-446655440000-1234567890123'
      const result = convertLegacyClientId(aituberClientId)

      expect(result).toBe(aituberClientId)
    })

    it('should handle empty or undefined client IDs', () => {
      const emptyConverted = convertLegacyClientId('')
      const undefinedConverted = convertLegacyClientId(undefined as any)

      expect(isAituberClientId(emptyConverted)).toBe(true)
      expect(isAituberClientId(undefinedConverted)).toBe(true)
    })

    it('should preserve legacy ID information in converted format', () => {
      const legacyIds = ['custom-app-001', 'device_sensor_42', 'user123']

      legacyIds.forEach((legacyId) => {
        const converted = convertLegacyClientId(legacyId)

        // Check that converted ID contains the original legacy ID
        expect(converted).toContain(legacyId)
        expect(isAituberClientId(converted)).toBe(true)
      })
    })
  })

  describe('extractTimestampFromClientId', () => {
    it('should extract timestamp from valid AITuber client ID', () => {
      const timestamp = Date.now()
      const clientId = `aituber-550e8400-e29b-41d4-a716-446655440000-${timestamp}`

      const extracted = extractTimestampFromClientId(clientId)
      expect(extracted).toBe(timestamp)
    })

    it('should return null for legacy client IDs', () => {
      const legacyIds = [
        'mqttjs_12345678',
        'custom-client-id',
        'device_sensor_001',
      ]

      legacyIds.forEach((id) => {
        expect(extractTimestampFromClientId(id)).toBeNull()
      })
    })

    it('should return null for invalid AITuber client IDs', () => {
      const invalidIds = [
        'aituber-550e8400-e29b-41d4-a716-446655440000', // missing timestamp
        'aituber-invalid-format',
        '',
      ]

      invalidIds.forEach((id) => {
        expect(extractTimestampFromClientId(id)).toBeNull()
      })
    })

    it('should handle client IDs with invalid timestamp format', () => {
      const invalidTimestampIds = [
        'aituber-550e8400-e29b-41d4-a716-446655440000-abc123',
        'aituber-550e8400-e29b-41d4-a716-446655440000-12.34',
        'aituber-550e8400-e29b-41d4-a716-446655440000--1234567890123',
      ]

      invalidTimestampIds.forEach((id) => {
        expect(extractTimestampFromClientId(id)).toBeNull()
      })
    })

    it('should extract timestamp and allow date conversion', () => {
      const now = Date.now()
      const clientId = `aituber-550e8400-e29b-41d4-a716-446655440000-${now}`

      const extracted = extractTimestampFromClientId(clientId)
      expect(extracted).toBe(now)

      // Verify the timestamp can be converted to a valid date
      const date = new Date(extracted!)
      expect(date.getTime()).toBe(now)
      expect(date.toISOString()).toBeDefined()
    })
  })

  describe('Integration tests', () => {
    it('should generate, validate, and extract timestamp from new client ID', () => {
      const beforeGeneration = Date.now()
      const clientId = generateAituberClientId()
      const afterGeneration = Date.now()

      // Validate format
      expect(isAituberClientId(clientId)).toBe(true)

      // Extract and verify timestamp
      const timestamp = extractTimestampFromClientId(clientId)
      expect(timestamp).not.toBeNull()
      expect(timestamp!).toBeGreaterThanOrEqual(beforeGeneration)
      expect(timestamp!).toBeLessThanOrEqual(afterGeneration)
    })

    it('should handle legacy to AITuber conversion workflow', () => {
      const legacyId = 'old-mqtt-client-123'

      // Convert legacy ID
      const convertedId = convertLegacyClientId(legacyId)

      // Validate converted ID
      expect(isAituberClientId(convertedId)).toBe(true)
      expect(isAituberClientId(legacyId)).toBe(false)

      // Extract timestamp from converted ID
      const timestamp = extractTimestampFromClientId(convertedId)
      expect(timestamp).not.toBeNull()

      // Verify the converted ID contains the legacy ID
      expect(convertedId).toContain(legacyId)
    })
  })
})
