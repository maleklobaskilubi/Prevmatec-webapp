import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generateSessionId } from '../functions/api/lib/crypto'

describe('PBKDF2 password hashing', () => {
  it('hashes and verifies correct password', async () => {
    const hash = await hashPassword('supersecret123')
    expect(typeof hash).toBe('string')
    expect(hash).toContain(':')

    const valid = await verifyPassword('supersecret123', hash)
    expect(valid).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correctpassword')
    const valid = await verifyPassword('wrongpassword', hash)
    expect(valid).toBe(false)
  })

  it('produces different hashes for same password (different salts)', async () => {
    const hash1 = await hashPassword('samepassword')
    const hash2 = await hashPassword('samepassword')
    expect(hash1).not.toBe(hash2)
  })

  it('generates unique session IDs', () => {
    const id1 = generateSessionId()
    const id2 = generateSessionId()
    expect(id1.length).toBe(64) // 32 bytes hex
    expect(id1).not.toBe(id2)
  })
})
