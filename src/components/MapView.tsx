import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { InstallationGeoFeature } from '@shared/types'

export interface MapViewProps {
  installations: InstallationGeoFeature[]
  tileUrl?: string
  center?: [number, number]
  zoom?: number
  onMapReady?: (map: maplibregl.Map) => void
  onInstallationClick?: (id: string) => void
  pendingPin?: { lat: number; lon: number } | null
}

const DEFAULT_CENTER: [number, number] = [19.15, 48.7] // Slovakia center
const DEFAULT_ZOOM = 7
const DEFAULT_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export default function MapView({
  installations,
  tileUrl = DEFAULT_TILE,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMapReady,
  onInstallationClick,
  pendingPin,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapReadyRef = useRef(false)          // true once map 'load' fires
  const pendingMarkerRef = useRef<maplibregl.Marker | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const installationsRef = useRef<InstallationGeoFeature[]>(installations)

  // Always keep ref in sync with latest prop
  installationsRef.current = installations

  function setSourceData(map: maplibregl.Map) {
    const source = map.getSource('installations') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData({ type: 'FeatureCollection', features: installationsRef.current })
  }

  // ── Initialize map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center,
      zoom,
    })

    // Set ref immediately so update effect can find it
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
      'top-right',
    )

    map.on('load', () => {
      map.addSource('installations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'installations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#3b82f6', 10, '#2563eb', 30, '#1d4ed8'],
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 30, 36],
          'circle-opacity': 0.9,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
        },
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'installations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      })

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'installations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#1d4ed8',
          'circle-radius': 9,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#fff',
        },
      })

      map.on('click', 'unclustered-point', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const { id, venueName, addressText, installedAt, robotName } = feature.properties as any
        const coords = (feature.geometry as any).coordinates.slice() as [number, number]

        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true })
          .setLngLat(coords)
          .setHTML(`
            <div style="padding:12px;min-width:200px;font-family:sans-serif">
              <div style="font-weight:600;font-size:14px;color:#111">${venueName}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">${addressText}</div>
              ${robotName ? `<div style="font-size:12px;color:#2563eb;margin-top:4px">🤖 ${robotName}</div>` : ''}
              <div style="font-size:11px;color:#9ca3af;margin-top:4px">${installedAt ?? ''}</div>
              <a href="/installations/${id}"
                style="display:block;margin-top:8px;text-align:center;background:#1d4ed8;color:#fff;
                       font-size:12px;padding:6px 12px;border-radius:8px;text-decoration:none">
                Otvoriť detail →
              </a>
            </div>
          `)
          .addTo(map)
        onInstallationClick?.(id)
      })

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0]?.properties?.cluster_id
        const source = map.getSource('installations') as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId)
          .then((z) => map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: z }))
          .catch(() => {})
      })

      map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })

      // Mark ready and load initial data
      mapReadyRef.current = true
      setSourceData(map)
      onMapReady?.(map)
    })

    return () => {
      mapReadyRef.current = false
      mapRef.current = null
      map.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync installations whenever prop changes ──────────────────────────────
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return
    setSourceData(mapRef.current)
  }, [installations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pending pin marker ────────────────────────────────────────────────────
  useEffect(() => {
    pendingMarkerRef.current?.remove()
    pendingMarkerRef.current = null
    if (!pendingPin || !mapRef.current) return
    const el = document.createElement('div')
    el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#f97316;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)'
    pendingMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([pendingPin.lon, pendingPin.lat])
      .addTo(mapRef.current)
    mapRef.current.flyTo({ center: [pendingPin.lon, pendingPin.lat], zoom: 14 })
  }, [pendingPin])

  return <div ref={containerRef} className="w-full h-full" />
}
