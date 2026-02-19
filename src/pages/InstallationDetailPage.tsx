import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../ctx/AuthContext'
import { ArrowLeft, MapPin, User, Phone, Calendar, Bot, Plus, Check, Clock, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { sk } from 'date-fns/locale'

type TabType = 'info' | 'notes' | 'visits' | 'reminders' | 'members'

export default function InstallationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('info')

  const { data: installation, isLoading } = useQuery({
    queryKey: ['installation', id],
    queryFn: () => api.installations.get(id!),
    enabled: !!id,
  })

  const { data: notes } = useQuery({
    queryKey: ['notes', id],
    queryFn: () => api.installations.notes.list(id!),
    enabled: !!id && activeTab === 'notes',
  })

  const { data: visits } = useQuery({
    queryKey: ['visits', id],
    queryFn: () => api.installations.visits.list(id!),
    enabled: !!id && activeTab === 'visits',
  })

  const { data: reminders } = useQuery({
    queryKey: ['reminders', id],
    queryFn: () => api.installations.reminders.list(id!),
    enabled: !!id && (activeTab === 'reminders' || activeTab === 'info'),
  })

  const isCreator = installation?.createdBy === user?.id

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-gray-400">Načítavam...</div>
  }

  if (!installation) {
    return <div className="flex h-full items-center justify-center text-gray-400">Inštalácia nenájdená</div>
  }

  const openReminders = (reminders ?? []).filter((r: any) => r.status === 'open')

  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'notes', label: 'Poznámky' },
    { key: 'visits', label: 'Návštevy' },
    { key: 'reminders', label: `Remindere ${openReminders.length > 0 ? `(${openReminders.length})` : ''}` },
    { key: 'members', label: 'Účastníci' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-200 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{installation.venueName}</h1>
            <p className="text-sm text-gray-500">{installation.addressText}</p>
          </div>
        </div>

        {/* Open reminders banner */}
        {openReminders.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-orange-500">🔔</span>
            <span className="text-sm text-orange-700 font-medium">
              {openReminders.length} otvorené {openReminders.length === 1 ? 'pripomienka' : 'pripomienky'}
            </span>
            <button onClick={() => setActiveTab('reminders')} className="ml-auto text-xs text-orange-600 underline">
              Zobraziť
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 shadow-sm overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-brand-700 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'info' && <InfoTab installation={installation} isCreator={isCreator} robots={[]} />}
        {activeTab === 'notes' && <NotesTab notes={notes ?? []} installationId={id!} />}
        {activeTab === 'visits' && <VisitsTab visits={visits ?? []} installationId={id!} />}
        {activeTab === 'reminders' && <RemindersTab reminders={reminders ?? []} installationId={id!} />}
        {activeTab === 'members' && (
          <MembersTab members={installation.members ?? []} installationId={id!} isCreator={isCreator} />
        )}
      </div>
    </div>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function InfoTab({ installation, isCreator, robots }: { installation: any; isCreator: boolean; robots: any[] }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    venueName: installation.venueName,
    addressText: installation.addressText,
    managerName: installation.managerName ?? '',
    managerContact: installation.managerContact ?? '',
    installedAt: installation.installedAt,
  })
  const [error, setError] = useState('')

  const update = useMutation({
    mutationFn: (data: object) => api.installations.update(installation.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installation', installation.id] })
      setEditing(false)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Chyba'),
  })

  const fields = [
    { icon: <MapPin size={16} />, label: 'Adresa', value: installation.addressText },
    { icon: <User size={16} />, label: 'Vedúci', value: installation.managerName ?? '—' },
    { icon: <Phone size={16} />, label: 'Kontakt', value: installation.managerContact ?? '—' },
    { icon: <Calendar size={16} />, label: 'Dátum inštalácie', value: installation.installedAt },
    { icon: <Bot size={16} />, label: 'Robot', value: installation.robot?.name ?? '—' },
    { icon: <User size={16} />, label: 'Vytvoril', value: installation.creator?.name },
  ]

  return (
    <div className="card space-y-3">
      {!editing ? (
        <>
          {fields.map((f) => (
            <div key={f.label} className="flex gap-3 items-start">
              <span className="text-gray-400 mt-0.5">{f.icon}</span>
              <div>
                <div className="text-xs text-gray-400">{f.label}</div>
                <div className="text-sm text-gray-900">{f.value}</div>
              </div>
            </div>
          ))}
          {isCreator && (
            <button onClick={() => setEditing(true)} className="mt-3 btn-secondary text-sm w-full py-2">
              Upraviť
            </button>
          )}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(form) }} className="space-y-3">
          {[
            { name: 'venueName', label: 'Názov prevádzky' },
            { name: 'addressText', label: 'Adresa' },
            { name: 'managerName', label: 'Vedúci' },
            { name: 'managerContact', label: 'Kontakt' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input
                name={f.name}
                value={(form as any)[f.name]}
                onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                className="input-field"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dátum inštalácie</label>
            <input type="date" name="installedAt" value={form.installedAt}
              onChange={e => setForm({ ...form, installedAt: e.target.value })} className="input-field" />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1 text-sm py-2">Zrušiť</button>
            <button type="submit" disabled={update.isPending} className="btn-primary flex-1 text-sm py-2">
              {update.isPending ? 'Ukladám...' : 'Uložiť'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ notes, installationId }: { notes: any[]; installationId: string }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const add = useMutation({
    mutationFn: () => api.installations.notes.create(installationId, text),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['notes', installationId] }) },
  })

  return (
    <div className="space-y-3">
      <div className="card">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="Napíš poznámku..."
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
        <button
          onClick={() => add.mutate()}
          disabled={!text.trim() || add.isPending}
          className="mt-2 btn-primary text-sm w-full py-2"
        >
          {add.isPending ? 'Ukladám...' : 'Pridať poznámku'}
        </button>
      </div>
      {notes.map((n: any) => (
        <div key={n.id} className="card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700">{n.author?.name}</span>
            <span className="text-xs text-gray-400">{format(new Date(n.createdAt), 'd. M. yyyy HH:mm', { locale: sk })}</span>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.text}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Visits Tab ───────────────────────────────────────────────────────────────

function VisitsTab({ visits, installationId }: { visits: any[]; installationId: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ visitedAt: format(new Date(), 'yyyy-MM-dd'), summary: '', nextAction: '' })

  const add = useMutation({
    mutationFn: () => api.installations.visits.create(installationId, form),
    onSuccess: () => {
      setShowForm(false)
      setForm({ visitedAt: format(new Date(), 'yyyy-MM-dd'), summary: '', nextAction: '' })
      qc.invalidateQueries({ queryKey: ['visits', installationId] })
    },
  })

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 btn-primary text-sm">
        <Plus size={16} /> Pridať návštevu
      </button>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dátum návštevy</label>
            <input type="date" value={form.visitedAt} onChange={e => setForm({ ...form, visitedAt: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Zhrnutie *</label>
            <textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Čo sa urobilo..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ďalší krok (voliteľné)</label>
            <input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })}
              className="input-field" placeholder="napr. Objednať náhradný diel" />
          </div>
          <button onClick={() => add.mutate()} disabled={!form.summary || add.isPending} className="btn-primary w-full text-sm py-2">
            {add.isPending ? 'Ukladám...' : 'Uložiť návštevu'}
          </button>
        </div>
      )}

      {visits.map((v: any) => (
        <div key={v.id} className="card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-800">{v.visitedAt}</span>
            <span className="text-xs text-gray-400">{v.visitor?.name}</span>
          </div>
          <p className="text-sm text-gray-700">{v.summary}</p>
          {v.nextAction && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-blue-600">
              <span>→</span> <span>{v.nextAction}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Reminders Tab ────────────────────────────────────────────────────────────

function RemindersTab({ reminders, installationId }: { reminders: any[]; installationId: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ dueAt: '', reason: '' })

  const add = useMutation({
    mutationFn: () => api.installations.reminders.create(installationId, {
      dueAt: new Date(form.dueAt).toISOString(),
      reason: form.reason,
    }),
    onSuccess: () => {
      setShowForm(false)
      setForm({ dueAt: '', reason: '' })
      qc.invalidateQueries({ queryKey: ['reminders', installationId] })
    },
  })

  const patch = useMutation({
    mutationFn: ({ remId, status }: { remId: string; status: string }) =>
      api.reminders.patch(remId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders', installationId] }),
  })

  const statusColor: Record<string, string> = {
    open: 'bg-orange-100 text-orange-700',
    done: 'bg-green-100 text-green-700',
    snoozed: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 btn-primary text-sm">
        <Plus size={16} /> Pridať pripomienku
      </button>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dátum a čas *</label>
            <input type="datetime-local" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })}
              className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dôvod *</label>
            <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="input-field" placeholder="napr. Servisná prehliadka" />
          </div>
          <button onClick={() => add.mutate()} disabled={!form.dueAt || !form.reason || add.isPending}
            className="btn-primary w-full text-sm py-2">
            {add.isPending ? 'Ukladám...' : 'Uložiť pripomienku'}
          </button>
        </div>
      )}

      {reminders.map((r: any) => (
        <div key={r.id} className="card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">{r.reason}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {format(new Date(r.dueAt), 'd. M. yyyy HH:mm', { locale: sk })}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status]}`}>
              {r.status === 'open' ? 'Otvorené' : r.status === 'done' ? 'Hotové' : 'Odložené'}
            </span>
          </div>
          {r.status === 'open' && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => patch.mutate({ remId: r.id, status: 'done' })}
                className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
              >
                <Check size={13} /> Hotové
              </button>
              <button
                onClick={() => patch.mutate({ remId: r.id, status: 'snoozed' })}
                className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                <Clock size={13} /> Odložiť
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ members, installationId, isCreator }: { members: any[]; installationId: string; isCreator: boolean }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const add = useMutation({
    mutationFn: () => api.installations.addMember(installationId, { email }),
    onSuccess: () => {
      setEmail('')
      qc.invalidateQueries({ queryKey: ['installation', installationId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Chyba'),
  })

  const remove = useMutation({
    mutationFn: (userId: string) => api.installations.removeMember(installationId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installation', installationId] }),
  })

  return (
    <div className="space-y-3">
      {isCreator && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Pridať účastníka podľa emailu</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              className="flex-1 input-field"
              placeholder="email@prevmatec.sk"
            />
            <button onClick={() => add.mutate()} disabled={!email || add.isPending}
              className="btn-primary px-4 text-sm py-2">
              {add.isPending ? '...' : 'Pridať'}
            </button>
          </div>
          {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
        </div>
      )}

      <div className="card space-y-2">
        {members.length === 0 && <div className="text-sm text-gray-400">Žiadni ďalší účastníci</div>}
        {members.map((m: any) => (
          <div key={m.userId} className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-medium text-gray-800">{m.user?.name}</div>
              <div className="text-xs text-gray-400">{m.user?.email}</div>
            </div>
            {isCreator && (
              <button
                onClick={() => remove.mutate(m.userId)}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
