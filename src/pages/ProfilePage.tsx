import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../ctx/AuthContext'
import { Check, Clock, Bell, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { sk } from 'date-fns/locale'

type InstallationFilter = 'all' | 'mine' | 'reminders'

export default function ProfilePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
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

  // Upcoming open reminders (across all installations)
  const { data: allInstData } = useQuery({
    queryKey: ['installations', { hasOpenReminders: 'true', limit: '100' }],
    queryFn: () => api.installations.list({ hasOpenReminders: 'true', limit: '100' }),
  })

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
