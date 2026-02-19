import { useEffect, useRef } from 'react'
import { ensureMaps, ensureMarker } from '../lib/googleMaps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import type { InstallationGeoFeature } from '@shared/types'

export interface MapViewProps {
  installations: InstallationGeoFeature[]
  center?: { lat: number; lng: number }
  zoom?: number
  onInstallationClick?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  pendingPin?: { lat: number; lng: number } | null
}

const DEFAULT_CENTER = { lat: 48.7, lng: 19.15 }
const DEFAULT_ZOOM = 7

export default function MapView({
  installations,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onInstallationClick,
  onMapClick,
  pendingPin,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const pendingMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const installationsRef = useRef(installations)

  onMapClickRef.current = onMapClick
  installationsRef.current = installations

  // ── Initialize map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    ensureMaps().then(async () => {
      if (cancelled || !containerRef.current) return

      await ensureMarker()
      if (cancelled || !containerRef.current) return

      const map = new google.maps.Map(containerRef.current, {
        center,
        zoom,
        mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      })

      mapRef.current = map
      infoWindowRef.current = new google.maps.InfoWindow()

      const clusterer = new MarkerClusterer({ map })
      clustererRef.current = clusterer

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) onMapClickRef.current?.(e.latLng.lat(), e.latLng.lng())
      })

      renderMarkers(map, clusterer)
    })

    return () => {
      cancelled = true
      clustererRef.current?.clearMarkers()
      markersRef.current = []
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pin element helper ────────────────────────────────────────────────────────
  function makePinElement(color: string): HTMLElement {
    const pin = new google.maps.marker.PinElement({
      background: color,
      borderColor: shadeColor(color, -25),
      glyphColor: 'rgba(255,255,255,0.9)',
    })
    return pin.element
  }

  function shadeColor(hex: string, pct: number): string {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.min(255, Math.max(0, (n >> 16) + pct))
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + pct))
    const b = Math.min(255, Math.max(0, (n & 0xff) + pct))
    return `rgb(${r},${g},${b})`
  }

  // ── Render markers helper ─────────────────────────────────────────────────
  function renderMarkers(map: google.maps.Map, clusterer: MarkerClusterer) {
    markersRef.current.forEach(m => { m.map = null })
    markersRef.current = []
    clusterer.clearMarkers()

    const newMarkers = installationsRef.current.map((feature) => {
      const [lng, lat] = feature.geometry.coordinates
      const color = feature.properties.groups?.[0]?.color ?? '#ef4444'
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        title: feature.properties.venueName,
        content: makePinElement(color),
      })
      marker.addListener('click', () => {
        const { id, venueName, addressText, installedAt, robotName } = feature.properties
        infoWindowRef.current?.setContent(`
          <div style="padding:10px;min-width:190px;font-family:-apple-system,sans-serif">
            <div style="font-weight:600;font-size:14px;color:#111827">${venueName}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:3px">${addressText}</div>
            ${robotName ? `<div style="font-size:12px;color:#2563eb;margin-top:4px">🤖 ${robotName}</div>` : ''}
            <div style="font-size:11px;color:#9ca3af;margin-top:3px">${installedAt ?? ''}</div>
            <a href="/installations/${id}"
              style="display:block;margin-top:10px;text-align:center;background:#1d4ed8;color:#fff;
                     font-size:12px;padding:6px 12px;border-radius:8px;text-decoration:none">
              Otvoriť detail →
            </a>
          </div>
        `)
        infoWindowRef.current?.open({ anchor: marker, map })
        onInstallationClick?.(id)
      })
      return marker
    })

    markersRef.current = newMarkers
    clusterer.addMarkers(newMarkers)
  }

  // ── Sync markers when installations change ────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !clustererRef.current) return
    renderMarkers(mapRef.current, clustererRef.current)
  }, [installations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pending pin marker ────────────────────────────────────────────────────
  useEffect(() => {
    if (pendingMarkerRef.current) { pendingMarkerRef.current.map = null; pendingMarkerRef.current = null }
    if (!pendingPin || !mapRef.current) return
    const dot = document.createElement('div')
    dot.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#f97316;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)'
    pendingMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: pendingPin.lat, lng: pendingPin.lng },
      map: mapRef.current,
      content: dot,
      zIndex: 999,
    })
    mapRef.current.panTo({ lat: pendingPin.lat, lng: pendingPin.lng })
    mapRef.current.setZoom(15)
  }, [pendingPin])

  return <div ref={containerRef} className="w-full h-full" />
}
