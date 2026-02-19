import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import MapView from '../components/MapView'
import AddInstallationModal from '../components/AddInstallationModal'
import type { InstallationGeoFeature } from '@shared/types'
import { Search, X, SlidersHorizontal, MapPin } from 'lucide-react'
import { format } from 'date-fns'

interface GeocodeResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
}

interface FilterState {
  mine: boolean
  robotId: string
  text: string
  hasOpenReminders: boolean
}

export default function MapPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPin, setSelectedPin] = useState<{ lat: number; lon: number; displayName: string } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ mine: false, robotId: '', text: '', hasOpenReminders: false })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build query params — memoized so queryKey stays stable between renders
  const queryParams = useMemo(() => {
    const p: Record<string, string> = { limit: '200' }
    if (filters.mine) p.mine = 'true'
    if (filters.robotId) p.robotId = filters.robotId
    if (filters.text) p.text = filters.text
    if (filters.hasOpenReminders) p.hasOpenReminders = 'true'
    return p
  }, [filters.mine, filters.robotId, filters.text, filters.hasOpenReminders])

  const { data: installationsData } = useQuery({
    queryKey: ['installations', queryParams],
    queryFn: () => api.installations.list(queryParams),
  })

  const { data: robotsData } = useQuery({
    queryKey: ['robots'],
    queryFn: () => api.robots.list(),
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
    },
  }))

  // Debounced geocode search
  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchQuery(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!val.trim()) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await api.geocode.search(val)
        setSearchResults(results ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 600)
  }

  function selectResult(r: GeocodeResult) {
    setSelectedPin({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), displayName: r.display_name })
    setSearchQuery(r.display_name)
    setSearchResults([])
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults([])
    setSelectedPin(null)
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-200 overflow-hidden flex flex-col bg-white border-r border-gray-200 z-10`}>
        <div className="p-3 space-y-2 flex-shrink-0">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="Hľadaj adresu / POI..."
              className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
            {/* Autocomplete */}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => selectResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="text-sm text-gray-900 font-medium line-clamp-1">{r.display_name.split(',')[0]}</div>
                    <div className="text-xs text-gray-400 line-clamp-1">{r.display_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add installation button */}
          {selectedPin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-brand-700 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-brand-800 transition-colors"
            >
              <MapPin size={16} /> Pridať inštaláciu tu
            </button>
          )}

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
                onClick={() => setFilters({ mine: false, robotId: '', text: '', hasOpenReminders: false })}
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
          {installations.map((inst: any) => (
            <button
              key={inst.id}
              onClick={() => navigate(`/installations/${inst.id}`)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="font-medium text-sm text-gray-900">{inst.venueName}</div>
                {inst.openReminderCount > 0 && (
                  <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {inst.openReminderCount} 🔔
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{inst.addressText}</div>
              <div className="flex gap-3 mt-1 text-xs text-gray-400">
                <span>{inst.installedAt}</span>
                {inst.robot && <span>🤖 {inst.robot.name}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-200 rounded-r-xl py-4 px-1 shadow-sm hover:bg-gray-50 transition-colors"
        style={{ left: sidebarOpen ? '320px' : '0' }}
      >
        <span className="text-gray-400 text-xs">{sidebarOpen ? '◀' : '▶'}</span>
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          installations={features}
          pendingPin={selectedPin ? { lat: selectedPin.lat, lon: selectedPin.lon } : null}
        />
      </div>

      {/* Add installation modal */}
      {showAddModal && selectedPin && (
        <AddInstallationModal
          lat={selectedPin.lat}
          lon={selectedPin.lon}
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
