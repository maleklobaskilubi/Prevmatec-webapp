import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../ctx/AuthContext'
import type { ApiUser } from '@shared/types'

export default function InvitePage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Read pending_google cookie (will be available via document.cookie since it's NOT HttpOnly... wait, it IS HttpOnly)
    // The backend sends it as HttpOnly so we can't read it from JS.
    // Instead, we ask the user to submit the form, and the backend reads the cookie server-side.
    // We pass a dummy pendingToken from the URL or use a special endpoint.
    // For simplicity, we'll ask the backend to read the pending_google cookie and complete the flow.
    // The pendingToken here is the base64 we pass back — we get it from the URL query param
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) setPendingToken(token)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.auth.googleComplete({ inviteCode, pendingToken })
      const user = (await api.auth.me()) as ApiUser
      setUser(user)
      navigate('/map')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nastala chyba')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-700 text-white text-2xl font-bold mb-3">P</div>
          <h1 className="text-2xl font-bold text-gray-900">Dokončenie registrácie</h1>
          <p className="text-gray-500 text-sm mt-1">Zadaj pozvánkový kód pre dokončenie Google prihlásenia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pozvánkový kód</label>
            <input
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value); setError('') }}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Zadaj kód od admina"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-2.5 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Spracovávam...' : 'Dokončiť registráciu'}
          </button>
        </form>
      </div>
    </div>
  )
}
