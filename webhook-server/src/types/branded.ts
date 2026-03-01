// Branded types for domain identifiers (opaque string types)
//
// These types prevent accidental mixing of semantically different string values.
// For example, you cannot pass a DeviceToken where a PairingToken is expected.
//
// Usage:
//   const token = toDeviceToken('abc123')
//   const pairing = toPairingToken('xyz789')
//   // token and pairing have different types, cannot be mixed

export type DeviceToken = string & { readonly _brand: 'DeviceToken' }
export type PairingToken = string & { readonly _brand: 'PairingToken' }
export type SyncId = string & { readonly _brand: 'SyncId' }
export type HealthRecordId = string & { readonly _brand: 'HealthRecordId' }

// Factory functions for creating branded types
// These are the only places where type assertions are allowed
export const toDeviceToken = (s: string): DeviceToken => s as DeviceToken
export const toPairingToken = (s: string): PairingToken => s as PairingToken
export const toSyncId = (s: string): SyncId => s as SyncId
export const toHealthRecordId = (s: string): HealthRecordId => s as HealthRecordId

// Type guards for runtime validation (optional, but recommended)
export const isNonEmptyString = (s: unknown): s is string => typeof s === 'string' && s.length > 0

export const isValidDeviceToken = (s: unknown): s is DeviceToken =>
  isNonEmptyString(s) && s.length >= 32

export const isValidPairingToken = (s: unknown): s is PairingToken =>
  isNonEmptyString(s) && s.length >= 16

export const isValidSyncId = (s: unknown): s is SyncId => isNonEmptyString(s)

export const isValidHealthRecordId = (s: unknown): s is HealthRecordId => isNonEmptyString(s)
