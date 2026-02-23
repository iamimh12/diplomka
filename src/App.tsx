
import { useEffect, useMemo, useState } from 'react'
import {
  adminCreateHall,
  adminCreateMovie,
  adminCreateSession,
  adminDeleteHall,
  adminDeleteMovie,
  adminDeleteSession,
  adminUpdateHall,
  adminUpdateMovie,
  adminUpdateSession,
  cancelBooking,
  createBooking,
  fetchAvailability,
  fetchBookingQr,
  fetchBookingTicket,
  fetchHalls,
  fetchMovies,
  fetchMyBookings,
  fetchSeats,
  fetchSessions,
  fetchMe,
  loginUser,
  registerUser,
} from './api'
import type { Booking, Hall, Movie, Seat, Session, User } from './types'
import './App.css'

type AuthMode = 'login' | 'register'

type Flash = {
  type: 'success' | 'error'
  message: string
}

function formatTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(value)
}

function toLocalInput(value: string) {
  const date = new Date(value)
  const off = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - off).toISOString().slice(0, 16)
}

function toRFC3339(localValue: string) {
  const date = new Date(localValue)
  return date.toISOString()
}

function App() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [bookedSeatIds, setBookedSeatIds] = useState<number[]>([])
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [flash, setFlash] = useState<Flash | null>(null)
  const [loading, setLoading] = useState(false)

  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kino_token'))
  const [user, setUser] = useState<User | null>(null)

  const [adminHalls, setAdminHalls] = useState<Hall[]>([])
  const [adminSessions, setAdminSessions] = useState<Session[]>([])
  const [adminMovieForm, setAdminMovieForm] = useState({ title: '', description: '', duration: 90, poster: '' })
  const [adminHallForm, setAdminHallForm] = useState({ name: '', rows: 8, cols: 12 })
  const [adminSessionForm, setAdminSessionForm] = useState({ movieId: 0, hallId: 0, start: '', price: 450 })
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null)
  const [editingHallId, setEditingHallId] = useState<number | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null)

  const [qrModal, setQrModal] = useState<{ url: string; bookingId: number | null } | null>(null)

  const totalPrice = useMemo(() => {
    if (!selectedSession) return 0
    return selectedSession.base_price * selectedSeatIds.length
  }, [selectedSeatIds, selectedSession])

  const seatLabelMap = useMemo(() => {
    const map = new Map<number, string>()
    seats.forEach((seat) => {
      map.set(seat.id, `R${seat.row}-S${seat.number}`)
    })
    return map
  }, [seats])

  const selectedSeatLabels = useMemo(() => {
    return selectedSeatIds.map((id) => seatLabelMap.get(id) ?? `#${id}`)
  }, [seatLabelMap, selectedSeatIds])
  useEffect(() => {
    fetchMovies()
      .then((data) => {
        setMovies(data)
        if (data.length > 0) {
          setSelectedMovie(data[0])
        }
      })
      .catch((err: Error) => setFlash({ type: 'error', message: err.message }))
  }, [])

  useEffect(() => {
    if (!selectedMovie) return
    fetchSessions(selectedMovie.id)
      .then((data) => setSessions(data))
      .catch((err: Error) => setFlash({ type: 'error', message: err.message }))
  }, [selectedMovie])

  useEffect(() => {
    if (!selectedSession) return
    setSelectedSeatIds([])
    Promise.all([fetchSeats(selectedSession.hall_id), fetchAvailability(selectedSession.id)])
      .then(([seatData, availability]) => {
        setSeats(seatData)
        setBookedSeatIds(availability.booked_seat_ids)
      })
      .catch((err: Error) => setFlash({ type: 'error', message: err.message }))
  }, [selectedSession])

  useEffect(() => {
    if (!token) return
    fetchMe(token)
      .then(setUser)
      .catch(() => {
        setToken(null)
        localStorage.removeItem('kino_token')
      })
  }, [token])

  useEffect(() => {
    if (!token) return
    fetchMyBookings(token)
      .then(setBookings)
      .catch((err: Error) => setFlash({ type: 'error', message: err.message }))
  }, [token])

  useEffect(() => {
    if (token) {
      localStorage.setItem('kino_token', token)
    }
  }, [token])

  useEffect(() => {
    if (!token || !user?.is_admin) return
    Promise.all([fetchHalls(), fetchSessions()])
      .then(([hallData, sessionData]) => {
        setAdminHalls(hallData)
        setAdminSessions(sessionData)
        if (hallData.length > 0 && adminSessionForm.hallId === 0) {
          setAdminSessionForm((prev) => ({ ...prev, hallId: hallData[0].id }))
        }
        if (movies.length > 0 && adminSessionForm.movieId === 0) {
          setAdminSessionForm((prev) => ({ ...prev, movieId: movies[0].id }))
        }
      })
      .catch((err: Error) => setFlash({ type: 'error', message: err.message }))
  }, [token, user?.is_admin, movies.length])

  useEffect(() => {
    return () => {
      if (qrModal?.url) {
        URL.revokeObjectURL(qrModal.url)
      }
    }
  }, [qrModal])

  const groupedSeats = useMemo(() => {
    const map = new Map<number, Seat[]>()
    seats.forEach((seat) => {
      if (!map.has(seat.row)) {
        map.set(seat.row, [])
      }
      map.get(seat.row)?.push(seat)
    })
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [seats])

  const nextSessions = useMemo(() => sessions.slice(0, 6), [sessions])

  function toggleSeat(seatId: number) {
    if (bookedSeatIds.includes(seatId)) return
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    )
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setFlash(null)
    try {
      if (authMode === 'register') {
        const result = await registerUser({ name: authName, email: authEmail, password: authPassword })
        setToken(result.token)
        setUser(result.user)
        setFlash({ type: 'success', message: 'Аккаунт создан.' })
      } else {
        const result = await loginUser({ email: authEmail, password: authPassword })
        setToken(result.token)
        setUser(result.user)
        setFlash({ type: 'success', message: 'Вы вошли в профиль.' })
      }
      setAuthPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleBooking() {
    if (!token || !selectedSession) {
      setFlash({ type: 'error', message: 'Войдите, чтобы забронировать места.' })
      return
    }
    if (selectedSeatIds.length === 0) {
      setFlash({ type: 'error', message: 'Выберите места для бронирования.' })
      return
    }
    setLoading(true)
    setFlash(null)
    try {
      await createBooking(token, { session_id: selectedSession.id, seat_ids: selectedSeatIds })
      setFlash({ type: 'success', message: 'Бронирование подтверждено.' })
      const availability = await fetchAvailability(selectedSession.id)
      setBookedSeatIds(availability.booked_seat_ids)
      setSelectedSeatIds([])
      const myBookings = await fetchMyBookings(token)
      setBookings(myBookings)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось забронировать'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelBooking(bookingId: number) {
    if (!token) return
    setLoading(true)
    setFlash(null)
    try {
      await cancelBooking(token, bookingId)
      const myBookings = await fetchMyBookings(token)
      setBookings(myBookings)
      setFlash({ type: 'success', message: 'Бронирование отменено.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отменить'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadTicket(bookingId: number) {
    if (!token) return
    setLoading(true)
    try {
      const blob = await fetchBookingTicket(token, bookingId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `booking-${bookingId}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось скачать билет'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleShowQr(bookingId: number) {
    if (!token) return
    setLoading(true)
    try {
      const blob = await fetchBookingQr(token, bookingId)
      const url = URL.createObjectURL(blob)
      setQrModal({ url, bookingId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось получить QR'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  function closeQr() {
    if (qrModal?.url) {
      URL.revokeObjectURL(qrModal.url)
    }
    setQrModal(null)
  }

  function handleLogout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('kino_token')
  }

  async function handleAdminMovieSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!token) return
    setLoading(true)
    try {
      if (editingMovieId) {
        await adminUpdateMovie(token, editingMovieId, {
          title: adminMovieForm.title,
          description: adminMovieForm.description,
          duration_mins: adminMovieForm.duration,
          poster_url: adminMovieForm.poster,
        })
      } else {
        await adminCreateMovie(token, {
          title: adminMovieForm.title,
          description: adminMovieForm.description,
          duration_mins: adminMovieForm.duration,
          poster_url: adminMovieForm.poster,
        })
      }
      const data = await fetchMovies()
      setMovies(data)
      setAdminMovieForm({ title: '', description: '', duration: 90, poster: '' })
      setEditingMovieId(null)
      setFlash({ type: 'success', message: 'Фильм сохранен.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить фильм'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminDeleteMovie(id: number) {
    if (!token) return
    setLoading(true)
    try {
      await adminDeleteMovie(token, id)
      const data = await fetchMovies()
      setMovies(data)
      setFlash({ type: 'success', message: 'Фильм удален.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить фильм'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminHallSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!token) return
    setLoading(true)
    try {
      if (editingHallId) {
        await adminUpdateHall(token, editingHallId, { name: adminHallForm.name })
      } else {
        await adminCreateHall(token, {
          name: adminHallForm.name,
          rows: adminHallForm.rows,
          cols: adminHallForm.cols,
        })
      }
      const data = await fetchHalls()
      setAdminHalls(data)
      setAdminHallForm({ name: '', rows: 8, cols: 12 })
      setEditingHallId(null)
      setFlash({ type: 'success', message: 'Зал сохранен.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить зал'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminDeleteHall(id: number) {
    if (!token) return
    setLoading(true)
    try {
      await adminDeleteHall(token, id)
      const data = await fetchHalls()
      setAdminHalls(data)
      setFlash({ type: 'success', message: 'Зал удален.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить зал'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminSessionSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!adminSessionForm.start || !adminSessionForm.movieId || !adminSessionForm.hallId) {
      setFlash({ type: 'error', message: 'Заполните фильм, зал и дату сеанса.' })
      return
    }
    setLoading(true)
    try {
      if (editingSessionId) {
        await adminUpdateSession(token, editingSessionId, {
          movie_id: adminSessionForm.movieId,
          hall_id: adminSessionForm.hallId,
          start_time: adminSessionForm.start ? toRFC3339(adminSessionForm.start) : undefined,
          base_price: adminSessionForm.price,
        })
      } else {
        await adminCreateSession(token, {
          movie_id: adminSessionForm.movieId,
          hall_id: adminSessionForm.hallId,
          start_time: toRFC3339(adminSessionForm.start),
          base_price: adminSessionForm.price,
        })
      }
      const data = await fetchSessions()
      setAdminSessions(data)
      setAdminSessionForm({ movieId: 0, hallId: 0, start: '', price: 450 })
      setEditingSessionId(null)
      setFlash({ type: 'success', message: 'Сеанс сохранен.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить сеанс'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminDeleteSession(id: number) {
    if (!token) return
    setLoading(true)
    try {
      await adminDeleteSession(token, id)
      const data = await fetchSessions()
      setAdminSessions(data)
      setFlash({ type: 'success', message: 'Сеанс удален.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить сеанс'
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  function startEditMovie(movie: Movie) {
    setEditingMovieId(movie.id)
    setAdminMovieForm({
      title: movie.title,
      description: movie.description,
      duration: movie.duration_mins,
      poster: movie.poster_url,
    })
  }

  function startEditHall(hall: Hall) {
    setEditingHallId(hall.id)
    setAdminHallForm({ name: hall.name, rows: hall.rows, cols: hall.cols })
  }

  function startEditSession(session: Session) {
    setEditingSessionId(session.id)
    setAdminSessionForm({
      movieId: session.movie_id,
      hallId: session.hall_id,
      start: toLocalInput(session.start_time),
      price: session.base_price,
    })
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__label">KINO</span>
          <span className="brand__sub">FORM</span>
        </div>
        <nav className="topbar__nav">
          <button className="ghost" type="button">Сеансы</button>
          <button className="ghost" type="button">Места</button>
          <button className="ghost" type="button">Бронирования</button>
          {user?.is_admin && <button className="ghost" type="button">Админ</button>}
        </nav>
        <div className="topbar__auth">
          {user ? (
            <div className="user-pill">
              <div>
                <p className="user-pill__name">{user.name}</p>
                <p className="user-pill__email">{user.email}</p>
              </div>
              <button type="button" className="ghost" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          ) : (
            <span className="user-pill__email">Гость</span>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Бронирование билетов в кино</p>
          <h1>Планируйте вечер за пару кликов.</h1>
          <p className="hero__lead">
            Выбирайте фильмы, сравнивайте сеансы и фиксируйте лучшие места в зале. Все данные синхронизируются с
            кассой в реальном времени.
          </p>
          <div className="hero__meta">
            <div>
              <span className="meta__label">Сегодня в афише</span>
              <strong>{movies.length} фильма</strong>
            </div>
            <div>
              <span className="meta__label">Доступно сеансов</span>
              <strong>{sessions.length}</strong>
            </div>
          </div>
        </div>
        <div className="hero__card">
          <h2>Быстрый доступ</h2>
          <p>Сохраните любимые фильмы и получайте напоминания о новых сеансах.</p>
          <div className="hero__stats">
            {nextSessions.map((session) => (
              <div key={session.id} className="session-pill" onClick={() => setSelectedSession(session)}>
                <span>{session.movie?.title ?? 'Сеанс'}</span>
                <strong>{formatTime(session.start_time)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="layout">
        <section className="content">
          <div className="panel">
            <div className="panel__header">
              <h2>Афиша</h2>
              <p>Выберите фильм, чтобы увидеть ближайшие сеансы.</p>
            </div>
            <div className="movie-grid">
              {movies.map((movie) => (
                <button
                  type="button"
                  key={movie.id}
                  className={selectedMovie?.id === movie.id ? 'movie-card is-active' : 'movie-card'}
                  onClick={() => {
                    setSelectedMovie(movie)
                    setSelectedSession(null)
                  }}
                >
                  <img src={movie.poster_url} alt={movie.title} />
                  <div className="movie-card__body">
                    <h3>{movie.title}</h3>
                    <p>{movie.description}</p>
                    <span>{movie.duration_mins} мин</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel__header">
              <h2>Сеансы</h2>
              <p>Сравните время и стоимость.</p>
            </div>
            <div className="session-grid">
              {sessions.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  className={selectedSession?.id === session.id ? 'session-card is-active' : 'session-card'}
                  onClick={() => setSelectedSession(session)}
                >
                  <div>
                    <p className="session-card__title">{session.movie?.title ?? selectedMovie?.title}</p>
                    <span>{formatTime(session.start_time)}</span>
                  </div>
                  <strong>{formatPrice(session.base_price)}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel__header">
              <h2>Выбор мест</h2>
              <p>Нажмите на места, чтобы добавить их в бронь.</p>
            </div>
            {selectedSession ? (
              <div className="seats">
                <div className="screen">Экран</div>
                <div className="seat-grid">
                  {groupedSeats.map(([row, rowSeats]) => (
                    <div key={row} className="seat-row">
                      <span className="seat-row__label">{row}</span>
                      <div className="seat-row__cells">
                        {rowSeats.map((seat) => {
                          const isBooked = bookedSeatIds.includes(seat.id)
                          const isSelected = selectedSeatIds.includes(seat.id)
                          return (
                            <button
                              type="button"
                              key={seat.id}
                              className={
                                isBooked
                                  ? 'seat is-booked'
                                  : isSelected
                                  ? 'seat is-selected'
                                  : 'seat'
                              }
                              onClick={() => toggleSeat(seat.id)}
                              disabled={isBooked}
                            >
                              {seat.number}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">Выберите сеанс, чтобы увидеть схему зала.</p>
            )}
          </div>
        </section>

        <aside className="sidebar">
          {flash && <div className={`flash flash--${flash.type}`}>{flash.message}</div>}

          <div className="panel panel--accent">
            <h2>Бронирование</h2>
            <div className="summary">
              <div>
                <span>Фильм</span>
                <strong>{selectedSession?.movie?.title ?? selectedMovie?.title ?? '—'}</strong>
              </div>
              <div>
                <span>Время</span>
                <strong>{selectedSession ? formatTime(selectedSession.start_time) : '—'}</strong>
              </div>
              <div>
                <span>Места</span>
                <strong>{selectedSeatLabels.length ? selectedSeatLabels.join(', ') : '—'}</strong>
              </div>
              <div>
                <span>Итого</span>
                <strong>{totalPrice ? formatPrice(totalPrice) : '—'}</strong>
              </div>
            </div>
            <button className="primary" type="button" onClick={handleBooking} disabled={loading}>
              Забронировать
            </button>
          </div>

          <div className="panel">
            <div className="panel__header">
              <h2>Профиль</h2>
              <p>Войдите, чтобы видеть свои бронирования.</p>
            </div>
            {!user ? (
              <form className="auth" onSubmit={handleAuthSubmit}>
                <div className="auth__tabs">
                  <button
                    type="button"
                    className={authMode === 'login' ? 'tab is-active' : 'tab'}
                    onClick={() => setAuthMode('login')}
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    className={authMode === 'register' ? 'tab is-active' : 'tab'}
                    onClick={() => setAuthMode('register')}
                  >
                    Регистрация
                  </button>
                </div>
                {authMode === 'register' && (
                  <label>
                    Имя
                    <input value={authName} onChange={(e) => setAuthName(e.target.value)} />
                  </label>
                )}
                <label>
                  Email
                  <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                </label>
                <label>
                  Пароль
                  <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                </label>
                <button className="primary" type="submit" disabled={loading}>
                  {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
                </button>
              </form>
            ) : (
              <div className="bookings">
                {bookings.length === 0 ? (
                  <p className="muted">У вас пока нет бронирований.</p>
                ) : (
                  bookings.map((booking) => (
                    <div key={booking.id} className="booking-card">
                      <div className="booking-card__row">
                        <strong>{booking.session?.movie?.title ?? 'Фильм'}</strong>
                        <span className={`tag ${booking.status === 'cancelled' ? 'tag--muted' : 'tag--accent'}`}>
                          {booking.status === 'cancelled' ? 'Отменено' : 'Подтверждено'}
                        </span>
                      </div>
                      <span>{booking.session ? formatTime(booking.session.start_time) : ''}</span>
                      <span>
                        Места: {booking.seats?.map((seat) => `R${seat.row}-S${seat.number}`).join(', ') ?? '—'}
                      </span>
                      <span>{formatPrice(booking.total_price)}</span>
                      <div className="booking-card__actions">
                        <button type="button" className="ghost" onClick={() => handleShowQr(booking.id)}>
                          QR
                        </button>
                        <button type="button" className="ghost" onClick={() => handleDownloadTicket(booking.id)}>
                          PDF
                        </button>
                        {booking.status !== 'cancelled' && (
                          <button type="button" className="ghost danger" onClick={() => handleCancelBooking(booking.id)}>
                            Отменить
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {user?.is_admin && (
            <div className="panel admin">
              <div className="panel__header">
                <h2>Админ-панель</h2>
                <p>Управляйте фильмами, залами и сеансами.</p>
              </div>

              <div className="admin__section">
                <h3>Фильмы</h3>
                <form className="admin__form" onSubmit={handleAdminMovieSubmit}>
                  <input
                    placeholder="Название"
                    value={adminMovieForm.title}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <input
                    placeholder="Описание"
                    value={adminMovieForm.description}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                  <input
                    placeholder="Длительность (мин)"
                    type="number"
                    value={adminMovieForm.duration}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, duration: Number(e.target.value) }))}
                  />
                  <input
                    placeholder="Постер URL"
                    value={adminMovieForm.poster}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, poster: e.target.value }))}
                  />
                  <button className="primary" type="submit" disabled={loading}>
                    {editingMovieId ? 'Обновить' : 'Добавить'}
                  </button>
                </form>
                <div className="admin__list">
                  {movies.map((movie) => (
                    <div key={movie.id} className="admin__item">
                      <div>
                        <strong>{movie.title}</strong>
                        <span>{movie.duration_mins} мин</span>
                      </div>
                      <div className="admin__actions">
                        <button type="button" className="ghost" onClick={() => startEditMovie(movie)}>
                          Изменить
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleAdminDeleteMovie(movie.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin__section">
                <h3>Залы</h3>
                <form className="admin__form" onSubmit={handleAdminHallSubmit}>
                  <input
                    placeholder="Название"
                    value={adminHallForm.name}
                    onChange={(e) => setAdminHallForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <div className="admin__row">
                    <input
                      placeholder="Ряды"
                      type="number"
                      value={adminHallForm.rows}
                      onChange={(e) => setAdminHallForm((prev) => ({ ...prev, rows: Number(e.target.value) }))}
                      disabled={editingHallId !== null}
                    />
                    <input
                      placeholder="Места"
                      type="number"
                      value={adminHallForm.cols}
                      onChange={(e) => setAdminHallForm((prev) => ({ ...prev, cols: Number(e.target.value) }))}
                      disabled={editingHallId !== null}
                    />
                  </div>
                  <button className="primary" type="submit" disabled={loading}>
                    {editingHallId ? 'Обновить' : 'Добавить'}
                  </button>
                </form>
                <div className="admin__list">
                  {adminHalls.map((hall) => (
                    <div key={hall.id} className="admin__item">
                      <div>
                        <strong>{hall.name}</strong>
                        <span>
                          {hall.rows} x {hall.cols}
                        </span>
                      </div>
                      <div className="admin__actions">
                        <button type="button" className="ghost" onClick={() => startEditHall(hall)}>
                          Изменить
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleAdminDeleteHall(hall.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin__section">
                <h3>Сеансы</h3>
                <form className="admin__form" onSubmit={handleAdminSessionSubmit}>
                  <select
                    value={adminSessionForm.movieId}
                    onChange={(e) => setAdminSessionForm((prev) => ({ ...prev, movieId: Number(e.target.value) }))}
                  >
                    <option value={0}>Выберите фильм</option>
                    {movies.map((movie) => (
                      <option key={movie.id} value={movie.id}>
                        {movie.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={adminSessionForm.hallId}
                    onChange={(e) => setAdminSessionForm((prev) => ({ ...prev, hallId: Number(e.target.value) }))}
                  >
                    <option value={0}>Выберите зал</option>
                    {adminHalls.map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={adminSessionForm.start}
                    onChange={(e) => setAdminSessionForm((prev) => ({ ...prev, start: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="Цена"
                    value={adminSessionForm.price}
                    onChange={(e) => setAdminSessionForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  />
                  <button className="primary" type="submit" disabled={loading}>
                    {editingSessionId ? 'Обновить' : 'Добавить'}
                  </button>
                </form>
                <div className="admin__list">
                  {adminSessions.map((session) => (
                    <div key={session.id} className="admin__item">
                      <div>
                        <strong>{session.movie?.title ?? 'Сеанс'}</strong>
                        <span>{formatTime(session.start_time)}</span>
                      </div>
                      <div className="admin__actions">
                        <button type="button" className="ghost" onClick={() => startEditSession(session)}>
                          Изменить
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleAdminDeleteSession(session.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>

      {qrModal && (
        <div className="modal" onClick={closeQr}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>QR для бронирования #{qrModal.bookingId}</h3>
            <img src={qrModal.url} alt="QR" />
            <button className="primary" type="button" onClick={closeQr}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
