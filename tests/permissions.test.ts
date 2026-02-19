import { describe, it, expect } from 'vitest'

// Permission logic: only the creator can edit
function canEdit(installation: { createdBy: string }, requestingUserId: string): boolean {
  return installation.createdBy === requestingUserId
}

describe('Installation permissions', () => {
  it('creator can edit own installation', () => {
    const inst = { createdBy: 'user-1' }
    expect(canEdit(inst, 'user-1')).toBe(true)
  })

  it('other user cannot edit', () => {
    const inst = { createdBy: 'user-1' }
    expect(canEdit(inst, 'user-2')).toBe(false)
  })

  it('member without creator role cannot edit', () => {
    const inst = { createdBy: 'user-1' }
    // user-3 is a member but not creator
    expect(canEdit(inst, 'user-3')).toBe(false)
  })
})
