import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Configure once — importLibrary() calls are idempotent after this
setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  v: 'weekly',
})

export async function ensureMaps(): Promise<void> {
  await importLibrary('maps')
}

export async function ensureMarker(): Promise<void> {
  await importLibrary('marker')
}

export async function ensurePlaces(): Promise<void> {
  await importLibrary('maps')
  await importLibrary('places')
  await importLibrary('geocoding')
}
