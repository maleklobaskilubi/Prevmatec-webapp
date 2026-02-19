import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, sql, and } from 'drizzle-orm'
import { geocodeCache } from '../../../db/schema'
import { requireAuth } from '../lib/session'
import { GeocodeQuerySchema, ReverseGeocodeQuerySchema } from '../../../shared/schemas'
import type { AppContext } from '../types'

export const geocodeRouter = new Hono<AppContext>()

geocodeRouter.use('*', requireAuth)

// Simple in-memory rate limiter (per instance, resets on cold start)
const requestLog: number[] = []
const MAX_REQUESTS_PER_MINUTE = 10

function isRateLimited(): boolean {
  const now = Date.now()
  const oneMinuteAgo = now - 60_000
  // Remove old entries
  while (requestLog.length > 0 && requestLog[0] < oneMinuteAgo) requestLog.shift()
  if (requestLog.length >= MAX_REQUESTS_PER_MINUTE) return true
  requestLog.push(now)
  return false
}

// GET /api/geocode?q=...
geocodeRouter.get('/geocode', zValidator('query', GeocodeQuerySchema), async (c) => {
  const { q } = c.req.valid('query')
  const db = c.get('db')
  const normalizedQ = q.trim().toLowerCase()

  // Check cache
  const [cached] = await db
    .select()
    .from(geocodeCache)
    .where(
      and(
        eq(geocodeCache.query, normalizedQ),
        eq(geocodeCache.provider, 'nominatim')
      )
    )
    .limit(1)

  if (cached) {
    // Update hit count and last_used_at
    await db
      .update(geocodeCache)
      .set({
        hitCount: sql`${geocodeCache.hitCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(geocodeCache.id, cached.id))

    return c.json(cached.responseJson)
  }

  // Rate limit before calling Nominatim
  if (isRateLimited()) {
    return c.json({ error: 'Rate limit exceeded. Skúste neskôr.' }, 429)
  }

  // Call Nominatim
  const params = new URLSearchParams({
    q: normalizedQ,
    format: 'json',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'sk',
  })

  const nominatimRes = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent': 'Prevmatec-WebApp/1.0 (robot-installation-tracker; contact@prevmatec.sk)',
        'Accept-Language': 'sk,cs',
      },
    }
  )

  if (!nominatimRes.ok) {
    return c.json({ error: 'Geocoding service unavailable' }, 502)
  }

  const results = await nominatimRes.json()

  // Cache the result
  await db
    .insert(geocodeCache)
    .values({
      query: normalizedQ,
      provider: 'nominatim',
      responseJson: results,
      lat: results[0]?.lat ?? null,
      lon: results[0]?.lon ?? null,
      displayName: results[0]?.display_name ?? null,
    })
    .onConflictDoNothing()

  return c.json(results)
})

// GET /api/reverse?lat=..&lon=..
geocodeRouter.get('/reverse', zValidator('query', ReverseGeocodeQuerySchema), async (c) => {
  const { lat, lon } = c.req.valid('query')

  if (isRateLimited()) {
    return c.json({ error: 'Rate limit exceeded. Skúste neskôr.' }, 429)
  }

  const params = new URLSearchParams({
    lat,
    lon,
    format: 'json',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      'User-Agent': 'Prevmatec-WebApp/1.0 (robot-installation-tracker; contact@prevmatec.sk)',
      'Accept-Language': 'sk,cs',
    },
  })

  if (!res.ok) return c.json({ error: 'Reverse geocoding failed' }, 502)

  const data = await res.json()
  return c.json(data)
})
