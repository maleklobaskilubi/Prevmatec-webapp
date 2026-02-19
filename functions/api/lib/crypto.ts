// PBKDF2 via WebCrypto — edge-compatible, no Node crypto needed

const ITERATIONS = 100_000
const KEY_LEN = 32 // bytes
const SALT_LEN = 16 // bytes
const ALGO = 'SHA-256'

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: ALGO },
    keyMaterial,
    KEY_LEN * 8
  )
  return `${bufToHex(salt.buffer as ArrayBuffer)}:${bufToHex(derived)}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, hashHex] = hash.split(':')
  if (!saltHex || !hashHex) return false
  const salt = hexToBuf(saltHex)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: ALGO },
    keyMaterial,
    KEY_LEN * 8
  )
  const derivedHex = bufToHex(derived)
  // Constant-time compare
  if (derivedHex.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i)
  }
  return diff === 0
}

// Generates a cryptographically random session ID
export function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bufToHex(bytes.buffer as ArrayBuffer)
}
