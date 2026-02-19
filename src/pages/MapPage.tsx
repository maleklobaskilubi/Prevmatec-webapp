import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { ensurePlaces } from '../lib/googleMaps'
import { useAuth } from '../ctx/AuthContext'
import MapView from '../components/MapView'
import AddInstallationModal from '../components/AddInstallationModal'
import type { InstallationGeoFeature } from '@shared/types'
import { Search, X, SlidersHorizontal, MapPin, ChevronDown, ChevronRight, Layers, Plus } from 'lucide-react'

interface FilterState {
  mine: boolean
  robotId: string
  text: string
  hasOpenReminders: boolean
  groupId: string
}

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#ec4899']

export default function MapPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPin, setSelectedPin] = useState<{ lat: number; lng: number; displayName: string } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ mine: false, robotId: '', text: '', hasOpenReminders: false, groupId: '' })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [groupsOpen, setGroupsOpen] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#6366f1')
  const [popoverInstId, setPopoverInstId] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build query params — memoized so queryKey stays stable between renders
  const queryParams = useMemo(() => {
    const p: Record<string, string> = { limit: '200' }
    if (filters.mine) p.mine = 'true'
    if (filters.robotId) p.robotId = filters.robotId
    if (filters.text) p.text = filters.text
    if (filters.hasOpenReminders) p.hasOpenReminders = 'true'
    if (filters.groupId) p.groupId = filters.groupId
    return p
  }, [filters.mine, filters.robotId, filters.text, filters.hasOpenReminders, filters.groupId])

  const { data: installationsData } = useQuery({
    queryKey: ['installations', queryParams],
    queryFn: () => api.installations.list(queryParams),
  })

  const { data: robotsData } = useQuery({
    queryKey: ['robots'],
    queryFn: () => api.robots.list(),
  })

  const { data: groupsData = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
  })

  const createGroup = useMutation({
    mutationFn: () => api.groups.create({ name: newGroupName, color: newGroupColor }),
    onSuccess: () => {
      setNewGroupName('')
      setShowCreateGroup(false)
      setNewGroupColor('#6366f1')
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.groups.delete(id),
    onSuccess: (_data, id) => {
      setFilters(f => f.groupId === id ? { ...f, groupId: '' } : f)
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['installations'] })
    },
  })

  const addToGroup = useMutation({
    mutationFn: ({ groupId, instId }: { groupId: string; instId: string }) =>
      api.groups.addInstallation(groupId, instId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installations'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const removeFromGroup = useMutation({
    mutationFn: ({ groupId, instId }: { groupId: string; instId: string }) =>
      api.groups.removeInstallation(groupId, instId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installations'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const installations = installationsData?.data ?? []

  // Convert to GeoJSON features
  const features: InstallationGeoFeature[] = installations.map((inst: any) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [inst.lon, inst.lat] },
    properties: {
      id: inst.id,
      venueName: inst.venueName,
      addressText: inst.addressText,
      installedAt: inst.installedAt,
      robotName: inst.robot?.name ?? null,
      groups: inst.groups ?? [],
    },
  }))

  // Debounced Google Places Autocomplete search
  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchQuery(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!val.trim()) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        await ensurePlaces()
        const svc = new google.maps.places.AutocompleteService()
        svc.getPlacePredictions(
          { input: val, componentRestrictions: { country: 'sk' } },
          (predictions, status) => {
            setSearchResults(status === google.maps.places.PlacesServiceStatus.OK ? (predictions ?? []) : [])
            setSearchLoading(false)
          },
        )
      } catch {
        setSearchResults([])
        setSearchLoading(false)
      }
    }, 400)
  }

  function selectResult(r: google.maps.places.AutocompletePrediction) {
    ensurePlaces().then(() => {
      new google.maps.Geocoder().geocode({ placeId: r.place_id }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location
          setSelectedPin({ lat: loc.lat(), lng: loc.lng(), displayName: r.description })
          setSearchQuery(r.description)
          setSearchResults([])
        }
      })
    })
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults([])
    setSelectedPin(null)
  }

  async function handleMapClick(lat: number, lng: number) {
    await ensurePlaces()
    new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      const address = status === 'OK' && results?.[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setSelectedPin({ lat, lng, displayName: address })
    })
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="md:hidden absolute inset-0 z-[9] bg-black/20" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Popover backdrop */}
      {popoverInstId && (
        <div className="fixed inset-0 z-20" onClick={() => setPopoverInstId(null)} />
      )}

      {/* Map — always full screen */}
      <div className="absolute inset-0">
        <MapView
          installations={features}
          pendingPin={selectedPin ? { lat: selectedPin.lat, lng: selectedPin.lng } : null}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Floating search bar */}
      <div className="absolute top-3 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[440px] z-20 pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="Hľadaj adresu alebo miesto..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            )}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => selectResult(r)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900">{r.structured_formatting.main_text}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.structured_formatting.secondary_text}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-brand-700 text-white text-sm font-medium py-2.5 rounded-2xl shadow-lg hover:bg-brand-800 transition-colors"
            >
              <MapPin size={15} /> Pridať inštaláciu tu
            </button>
          )}
        </div>
      </div>

      {/* Mobile FAB — open sidebar when closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white border border-gray-200 rounded-2xl px-5 py-2.5 shadow-lg flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <SlidersHorizontal size={15} /> Inštalácie ({installations.length})
        </button>
      )}

      {/* Sidebar — bottom sheet on mobile, left drawer on desktop */}
      <div
        className={`absolute z-10 bg-white shadow-xl flex flex-col transition-transform duration-200
          bottom-0 left-0 right-0 h-[58vh] rounded-t-2xl
          md:top-0 md:bottom-0 md:right-auto md:h-auto md:w-72 md:rounded-none
          md:translate-y-0
          ${sidebarOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:-translate-x-full'}
        `}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0 cursor-pointer" onClick={() => setSidebarOpen(false)}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Desktop sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-8 items-center justify-center bg-white border border-l-0 border-gray-200 rounded-r-xl h-12 w-8 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex-shrink-0 p-3 space-y-2">

          {/* Groups section */}
          <div className="rounded-xl overflow-hidden">
            <button
              onClick={() => setGroupsOpen(!groupsOpen)}
              className="w-full flex items-center gap-2 text-sm py-2 px-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Layers size={15} className="text-gray-500" />
              <span className="font-medium text-gray-700">Skupiny</span>
              {filters.groupId && <span className="ml-auto mr-1 bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">1</span>}
              <ChevronDown size={14} className={`${filters.groupId ? '' : 'ml-auto'} text-gray-400 transition-transform duration-200 ${groupsOpen ? 'rotate-180' : ''}`} />
            </button>
            {groupsOpen && (
              <div className="px-2 pb-2 space-y-0.5">
                {(groupsData as any[]).map((g) => (
                  <div key={g.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => setFilters(f => ({ ...f, groupId: f.groupId === g.id ? '' : g.id }))}
                      className={`flex-1 flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg transition-colors ${
                        filters.groupId === g.id ? 'bg-white shadow-sm text-brand-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                      <span className="truncate">{g.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{g.installationCount}</span>
                    </button>
                    {user?.id === g.createdBy && (
                      <button
                        onClick={() => deleteGroup.mutate(g.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 rounded transition-all"
                        title="Vymazať skupinu"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {showCreateGroup ? (
                  <div className="pt-1 pb-0.5 space-y-2">
                    <input
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newGroupName.trim()) createGroup.mutate()
                        if (e.key === 'Escape') { setShowCreateGroup(false); setNewGroupName('') }
                      }}
                      placeholder="Názov skupiny..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                    />
                    <div className="flex gap-1.5 flex-wrap px-0.5">
                      {GROUP_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewGroupColor(c)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newGroupColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setShowCreateGroup(false); setNewGroupName('') }}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >Zrušiť</button>
                      <button
                        onClick={() => createGroup.mutate()}
                        disabled={!newGroupName.trim() || createGroup.isPending}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-40"
                      >{createGroup.isPending ? '...' : 'Vytvoriť'}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 py-1.5 px-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Plus size={12} /> Nová skupina
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full flex items-center gap-2 text-sm py-2 px-3 rounded-xl transition-colors ${showFilters ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <SlidersHorizontal size={15} /> Filtre
            {(filters.mine || filters.robotId || filters.hasOpenReminders) && (
              <span className="ml-auto bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {[filters.mine, !!filters.robotId, filters.hasOpenReminders].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Filters panel */}
          {showFilters && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.mine} onChange={e => setFilters(f => ({ ...f, mine: e.target.checked }))} className="rounded" />
                <span>Len moje inštalácie</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.hasOpenReminders} onChange={e => setFilters(f => ({ ...f, hasOpenReminders: e.target.checked }))} className="rounded" />
                <span>Má otvorené remindere</span>
              </label>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Robot</label>
                <select
                  value={filters.robotId}
                  onChange={e => setFilters(f => ({ ...f, robotId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Všetky</option>
                  {(robotsData ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Text search</label>
                <input
                  value={filters.text}
                  onChange={e => setFilters(f => ({ ...f, text: e.target.value }))}
                  placeholder="Názov / adresa / vedúci"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={() => setFilters({ mine: false, robotId: '', text: '', hasOpenReminders: false, groupId: '' })}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Zrušiť filtre
              </button>
            </div>
          )}
        </div>

        {/* Installation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {installations.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Žiadne inštalácie</div>
          )}
          {installations.map((inst: any) => {
            const instGroups: any[] = inst.groups ?? []
            const assignedIds = new Set(instGroups.map((g: any) => g.id))
            const available = (groupsData as any[]).filter(g => !assignedIds.has(g.id))
            const isOpen = popoverInstId === inst.id
            return (
              <div key={inst.id} className="relative">
                <div
                  onClick={() => navigate(`/installations/${inst.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-gray-900 pr-1">{inst.venueName}</div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {inst.openReminderCount > 0 && (
                        <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                          {inst.openReminderCount} 🔔
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setPopoverInstId(isOpen ? null : inst.id) }}
                        className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                          isOpen ? 'bg-brand-100 text-brand-700' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                        }`}
                        title="Pridať do skupiny"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{inst.addressText}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{inst.installedAt}</span>
                    {inst.robot && <span>🤖 {inst.robot.name}</span>}
                    {instGroups.length > 0 && (
                      <span className="ml-auto flex gap-1">
                        {instGroups.map((g: any) => (
                          <span key={g.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} title={g.name} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="absolute right-3 top-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-44 overflow-hidden">
                    {instGroups.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs text-gray-400 font-medium">V skupinách</div>
                        {instGroups.map((g: any) => (
                          <button
                            key={g.id}
                            onClick={(e) => { e.stopPropagation(); removeFromGroup.mutate({ groupId: g.id, instId: inst.id }) }}
                            className="w-full flex items-center gap-2 text-sm px-3 py-1.5 hover:bg-red-50 text-gray-700 transition-colors"
                          >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                            <span className="flex-1 text-left">{g.name}</span>
                            <X size={11} className="text-gray-400" />
                          </button>
                        ))}
                        {available.length > 0 && <div className="border-t border-gray-100 mx-2 my-0.5" />}
                      </>
                    )}
                    {available.length > 0 ? (
                      <>
                        {instGroups.length === 0 && (
                          <div className="px-3 pt-2 pb-1 text-xs text-gray-400 font-medium">Pridať do skupiny</div>
                        )}
                        {available.map((g: any) => (
                          <button
                            key={g.id}
                            onClick={(e) => { e.stopPropagation(); addToGroup.mutate({ groupId: g.id, instId: inst.id }) }}
                            className="w-full flex items-center gap-2 text-sm px-3 py-1.5 hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                            <span>{g.name}</span>
                          </button>
                        ))}
                      </>
                    ) : instGroups.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-gray-400">Žiadne skupiny</div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add installation modal */}
      {showAddModal && selectedPin && (
        <AddInstallationModal
          lat={selectedPin.lat}
          lon={selectedPin.lng}
          addressText={selectedPin.displayName}
          robots={robotsData ?? []}
          onClose={() => setShowAddModal(false)}
          onSuccess={(id: string) => {
            setShowAddModal(false)
            setSelectedPin(null)
            clearSearch()
            qc.invalidateQueries({ queryKey: ['installations'] })
            navigate(`/installations/${id}`)
          }}
        />
      )}
    </div>
  )
}
