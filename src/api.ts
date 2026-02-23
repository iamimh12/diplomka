import type { Booking, Hall, Movie, Seat, Session, User } from './types'

declare global {
  interface Window {
    __APP_CONFIG__?: {
      API_URL?: string
    }
  }
}

function normalizeApiBase(rawBase?: string) {
  if (!rawBase) {
    return '/api'
  }
  const trimmed = rawBase.replace(/\/$/, '')
  if (trimmed.endsWith('/api')) {
    return trimmed
  }
  return `${trimmed}/api`
}

function getApiUrlFromConfig() {
  const runtimeValue = window.__APP_CONFIG__?.API_URL?.trim()
  if (runtimeValue) {
    return runtimeValue
  }
  return import.meta.env.VITE_API_URL as string | undefined
}

const API_BASE = normalizeApiBase(getApiUrlFromConfig())

type ApiError = {
  error: string
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  })
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!isJson) {
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`)
    }
    throw new Error('API misconfigured: expected JSON response')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = (data as ApiError).error || 'Request failed'
    throw new Error(message)
  }
  return data as T
}

export async function fetchMovies() {
  const data = await request<unknown>('/movies')
  if (!Array.isArray(data)) {
    throw new Error('API misconfigured: movies payload is not an array')
  }
  return data as Movie[]
}

export async function fetchSessions(movieId?: number) {
  const query = movieId ? `?movie_id=${movieId}` : ''
  const data = await request<unknown>(`/sessions${query}`)
  if (!Array.isArray(data)) {
    throw new Error('API misconfigured: sessions payload is not an array')
  }
  return data as Session[]
}

export async function fetchHalls() {
  const data = await request<unknown>('/halls')
  if (!Array.isArray(data)) {
    throw new Error('API misconfigured: halls payload is not an array')
  }
  return data as Hall[]
}

export async function fetchSeats(hallId: number) {
  return request<Seat[]>(`/halls/${hallId}/seats`)
}

export async function fetchAvailability(sessionId: number) {
  return request<{ booked_seat_ids: number[] }>(`/sessions/${sessionId}/availability`)
}

export async function registerUser(payload: { name: string; email: string; password: string }) {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function loginUser(payload: { email: string; password: string }) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchMe(token: string) {
  return request<User>('/me', {}, token)
}

export async function updateProfile(token: string, payload: { name: string }) {
  return request<User>(
    '/me',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token
  )
}

export async function changePassword(
  token: string,
  payload: { current_password: string; new_password: string }
) {
  return request<{ status: string }>(
    '/me/password',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token
  )
}

export async function createBooking(token: string, payload: { session_id: number; seat_ids: number[] }) {
  return request<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export async function fetchMyBookings(token: string) {
  return request<Booking[]>('/bookings/mine', {}, token)
}

export async function cancelBooking(token: string, bookingId: number) {
  return request<Booking>(`/bookings/${bookingId}/cancel`, { method: 'PATCH' }, token)
}

export async function adminCreateMovie(
  token: string,
  payload: {
    title: string
    title_en?: string
    title_kk?: string
    description: string
    description_en?: string
    description_kk?: string
    duration_mins: number
    poster_url: string
    country?: string
    country_en?: string
    country_kk?: string
    genres?: string
    genres_en?: string
    genres_kk?: string
    release_year?: number
  }
) {
  return request<Movie>('/admin/movies', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export async function adminUpdateMovie(
  token: string,
  id: number,
  payload: Partial<{
    title: string
    title_en: string
    title_kk: string
    description: string
    description_en: string
    description_kk: string
    duration_mins: number
    poster_url: string
    country: string
    country_en: string
    country_kk: string
    genres: string
    genres_en: string
    genres_kk: string
    release_year: number
  }>
) {
  return request<Movie>(`/admin/movies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export async function adminDeleteMovie(token: string, id: number) {
  await request(`/admin/movies/${id}`, { method: 'DELETE' }, token)
}

export async function adminCreateHall(token: string, payload: { name: string; rows: number; cols: number }) {
  return request<Hall>('/admin/halls', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export async function adminUpdateHall(token: string, id: number, payload: { name: string }) {
  return request<Hall>(`/admin/halls/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export async function adminDeleteHall(token: string, id: number) {
  await request(`/admin/halls/${id}`, { method: 'DELETE' }, token)
}

export async function adminCreateSession(token: string, payload: { movie_id: number; hall_id: number; start_time: string; base_price: number }) {
  return request<Session>('/admin/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token)
}

export async function adminUpdateSession(token: string, id: number, payload: Partial<{ movie_id: number; hall_id: number; start_time: string; base_price: number }>) {
  return request<Session>(`/admin/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token)
}

export async function adminDeleteSession(token: string, id: number) {
  await request(`/admin/sessions/${id}`, { method: 'DELETE' }, token)
}

export async function adminUpdateBookingStatus(token: string, id: number, status: 'confirmed' | 'cancelled') {
  return request<Booking>(`/admin/bookings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token)
}

export async function fetchBookingQr(token: string, bookingId: number) {
  const response = await fetch(`${API_BASE}/bookings/${bookingId}/qr`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new Error('Не удалось получить QR')
  }
  return response.blob()
}

export async function fetchBookingTicket(token: string, bookingId: number) {
  const response = await fetch(`${API_BASE}/bookings/${bookingId}/ticket`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new Error('Не удалось получить билет')
  }
  return response.blob()
}
