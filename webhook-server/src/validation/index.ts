export interface ValidationError {
  readonly code: string
  readonly message: string
}

export interface ValidationResultFailure {
  readonly valid: false
  readonly ok: false
  readonly code: string
  readonly message: string
  readonly error: ValidationError
}

export interface ValidationResultSuccess {
  readonly valid: true
  readonly ok: true
}

export type ValidationResult = ValidationResultSuccess | ValidationResultFailure

export const validateHealthRecord = (record: unknown): ValidationResult => {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      ok: false,
      code: 'INVALID_ITEM',
      message: 'Record must be an object',
      error: { code: 'INVALID_ITEM', message: 'Record must be an object' },
    }
  }

  const rec = record as Record<string, unknown>

  if (!rec['type'] || !rec['timestamp'] || !rec['data']) {
    return {
      valid: false,
      ok: false,
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'Missing required fields: type, timestamp, data',
      error: {
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required fields: type, timestamp, data',
      },
    }
  }

  if (Number.isNaN(Date.parse(rec['timestamp'] as string))) {
    return {
      valid: false,
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'Timestamp must be ISO 8601 format',
      error: { code: 'INVALID_TIMESTAMP', message: 'Timestamp must be ISO 8601 format' },
    }
  }

  const data = rec['data']
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      valid: false,
      ok: false,
      code: 'INVALID_DATA',
      message: 'Data must be a JSON object',
      error: { code: 'INVALID_DATA', message: 'Data must be a JSON object' },
    }
  }

  return { valid: true, ok: true }
}
