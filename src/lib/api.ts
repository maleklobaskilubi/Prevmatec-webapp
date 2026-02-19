// All API calls go through this module – never fetch DB directly from client

const BASE = ''

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, (err as any).error ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me: () => request('/api/me'),
    register: (body: Record<string, string>) =>
      request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    googleStart: () => { window.location.href = '/api/auth/google/start' },
    googleComplete: (body: { inviteCode: string; pendingToken: string }) =>
      request('/api/auth/google/complete', { method: 'POST', body: JSON.stringify(body) }),
  },

  robots: {
    list: () => request<any[]>('/api/robots'),
    create: (body: object) =>
      request('/api/robots', { method: 'POST', body: JSON.stringify(body) }),
  },

  installations: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ''
      return request<any>(`/api/installations${qs}`)
    },
    get: (id: string) => request<any>(`/api/installations/${id}`),
    create: (body: object) =>
      request<any>('/api/installations', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) =>
      request<any>(`/api/installations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    addMember: (id: string, body: { email: string; role?: string }) =>
      request(`/api/installations/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),
    removeMember: (id: string, userId: string) =>
      request(`/api/installations/${id}/members/${userId}`, { method: 'DELETE' }),

    notes: {
      list: (id: string) => request<any[]>(`/api/installations/${id}/notes`),
      create: (id: string, text: string) =>
        request(`/api/installations/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),
    },

    visits: {
      list: (id: string) => request<any[]>(`/api/installations/${id}/visits`),
      create: (id: string, body: object) =>
        request(`/api/installations/${id}/visits`, { method: 'POST', body: JSON.stringify(body) }),
    },

    reminders: {
      list: (id: string) => request<any[]>(`/api/installations/${id}/reminders`),
      create: (id: string, body: object) =>
        request(`/api/installations/${id}/reminders`, { method: 'POST', body: JSON.stringify(body) }),
    },
  },

  reminders: {
    patch: (id: string, body: object) =>
      request(`/api/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },

  geocode: {
    search: (q: string) =>
      request<any[]>(`/api/geocode?${new URLSearchParams({ q })}`),
    reverse: (lat: number, lon: number) =>
      request<any>(`/api/reverse?lat=${lat}&lon=${lon}`),
  },
}
