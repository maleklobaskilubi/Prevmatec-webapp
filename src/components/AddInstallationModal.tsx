import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import { X } from 'lucide-react'
import { format } from 'date-fns'

interface Props {
  lat: number
  lon: number
  addressText: string
  robots: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: (id: string) => void
}

export default function AddInstallationModal({ lat, lon, addressText, robots, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    venueName: '',
    addressText,
    managerName: '',
    managerContact: '',
    installedAt: format(new Date(), 'yyyy-MM-dd'),
    robotId: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await api.installations.create({
        ...form,
        lat,
        lon,
        robotId: form.robotId || undefined,
      })
      onSuccess(result.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nastala chyba')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nová inštalácia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Názov prevádzky *</label>
            <input name="venueName" value={form.venueName} onChange={handleChange} required
              className="input-field" placeholder="napr. Kaufland Nitra" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
            <input name="addressText" value={form.addressText} onChange={handleChange}
              className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontaktná osoba</label>
              <input name="managerName" value={form.managerName} onChange={handleChange}
                className="input-field" placeholder="Ján Novák" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontakt</label>
              <input name="managerContact" value={form.managerContact} onChange={handleChange}
                className="input-field" placeholder="+421 900 000 000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dátum inštalácie *</label>
              <input name="installedAt" type="date" value={form.installedAt} onChange={handleChange} required
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Robot</label>
              <select name="robotId" value={form.robotId} onChange={handleChange} className="input-field">
                <option value="">Vyber robot</option>
                {robots.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
            📍 {lat.toFixed(5)}, {lon.toFixed(5)}
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-2.5 border border-red-200">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Zrušiť
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50">
              {loading ? 'Ukladám...' : 'Pridať inštaláciu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
