import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../ctx/AuthContext'
import { Check, Clock, Bell, Bot, Plus, Trash2, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { sk } from 'date-fns/locale'

type InstallationFilter = 'all' | 'mine' | 'reminders'

export default function ProfilePage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<InstallationFilter>('mine')
  const [text, setSearch] = useState('')

  const qParams: Record<string, string> = { limit: '100' }
  if (filter === 'mine') qParams.mine = 'true'
  if (filter === 'reminders') qParams.hasOpenReminders = 'true'
  if (text) qParams.text = text

  const { data: instData } = useQuery({
    queryKey: ['installations', qParams],
    queryFn: () => api.installations.list(qParams),
  })
  const installations = instData?.data ?? []

  const filters: { key: InstallationFilter; label: string }[] = [
    { key: 'mine', label: 'Moje' },
    { key: 'all', label: 'Všetky' },
    { key: 'reminders', label: '🔔 S remindrami' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 space-y-5">

        {/* Profile card */}
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-700 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{user?.name}</div>
            <div className="text-sm text-gray-500">{user?.email}</div>
          </div>
        </div>

        {/* Upcoming reminders section */}
        <UpcomingReminders />

        {/* Robots section */}
        <RobotsSection />

        {/* Installations section */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800">Inštalácie</h2>

          {/* Quick filters */}
          <div className="flex gap-2 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f.key ? 'bg-brand-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            value={text}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hľadaj (názov / adresa / vedúci)"
            className="input-field"
          />

          {installations.length === 0 && (
            <div className="card text-center text-gray-400 py-8">Žiadne inštalácie</div>
          )}

          {installations.map((inst: any) => (
            <Link
              key={inst.id}
              to={`/installations/${inst.id}`}
              className="card block hover:border-brand-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="font-semibold text-gray-900">{inst.venueName}</div>
                {inst.openReminderCount > 0 && (
                  <span className="ml-2 flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                    <Bell size={11} /> {inst.openReminderCount}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{inst.addressText}</div>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span>📅 {inst.installedAt}</span>
                {inst.robot && <span>🤖 {inst.robot.name}</span>}
                <span>👤 {inst.creator?.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function RobotsSection() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', manufacturer: '', notes: '' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: robots = [] } = useQuery({
    queryKey: ['robots'],
    queryFn: () => api.robots.list(),
  })

  const create = useMutation({
    mutationFn: () => api.robots.create(form),
    onSuccess: () => {
      setForm({ name: '', manufacturer: '', notes: '' })
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['robots'] })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.robots.delete(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['robots'] })
      qc.invalidateQueries({ queryKey: ['installations'] })
    },
  })

  return (
    <div className="card space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Bot size={17} className="text-brand-600 flex-shrink-0" />
        <span className="font-semibold text-gray-800 flex-1">Roboty</span>
        <span className="text-xs text-gray-400 mr-1">{(robots as any[]).length}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          {(robots as any[]).map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{r.name}</div>
                {r.manufacturer && <div className="text-xs text-gray-500">{r.manufacturer}</div>}
                {r.notes && <div className="text-xs text-gray-400 truncate">{r.notes}</div>}
              </div>
              {deleteId === r.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-500">Vymazať?</span>
                  <button
                    onClick={() => remove.mutate(r.id)}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >Áno</button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >Nie</button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteId(r.id)}
                  className="text-gray-300 hover:text-red-500 p-1 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}

          {showForm ? (
            <div className="space-y-2 pt-1">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Model / názov *"
                className="input-field"
                autoFocus
              />
              <input
                value={form.manufacturer}
                onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                placeholder="Výrobca"
                className="input-field"
              />
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Poznámky"
                className="input-field"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setForm({ name: '', manufacturer: '', notes: '' }) }}
                  className="flex-1 btn-secondary text-sm py-2"
                >Zrušiť</button>
                <button
                  onClick={() => create.mutate()}
                  disabled={!form.name.trim() || create.isPending}
                  className="flex-1 btn-primary text-sm py-2 disabled:opacity-40"
                >{create.isPending ? '...' : 'Pridať'}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 py-1.5 px-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Plus size={14} /> Pridať robota
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function UpcomingReminders() {
  const qc = useQueryClient()

  // We fetch all installations with open reminders, then get individual installations' reminders
  // For MVP: query installations with open reminders and show them
  const { data: instData } = useQuery({
    queryKey: ['installations', { hasOpenReminders: 'true', limit: '50' }],
    queryFn: () => api.installations.list({ hasOpenReminders: 'true', limit: '50' }),
  })

  const installationsWithReminders = instData?.data ?? []

  const patch = useMutation({
    mutationFn: ({ remId, status }: { remId: string; status: string }) =>
      api.reminders.patch(remId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installations'] })
    },
  })

  if (installationsWithReminders.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
        <Bell size={16} className="text-orange-500" /> Otvorené pripomienky
      </h2>
      {installationsWithReminders.map((inst: any) => (
        <ReminderInstallation key={inst.id} installation={inst} onPatch={(remId, status) => patch.mutate({ remId, status })} />
      ))}
    </div>
  )
}

function ReminderInstallation({ installation, onPatch }: { installation: any; onPatch: (id: string, status: string) => void }) {
  const { data: reminders } = useQuery({
    queryKey: ['reminders', installation.id],
    queryFn: () => api.installations.reminders.list(installation.id),
  })

  const openReminders = (reminders ?? []).filter((r: any) => r.status === 'open')
  if (openReminders.length === 0) return null

  return (
    <div className="card space-y-2">
      <Link to={`/installations/${installation.id}`} className="text-sm font-medium text-brand-700 hover:underline">
        {installation.venueName}
      </Link>
      {openReminders.map((r: any) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <div className="flex-1">
            <span className="text-gray-800">{r.reason}</span>
            <span className="text-gray-400 text-xs ml-2">
              {format(new Date(r.dueAt), 'd. M. yyyy', { locale: sk })}
            </span>
          </div>
          <button
            onClick={() => onPatch(r.id, 'done')}
            className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            title="Označiť ako hotové"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => onPatch(r.id, 'snoozed')}
            className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
            title="Odložiť"
          >
            <Clock size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
