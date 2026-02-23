
import { useEffect, useMemo, useRef, useState } from 'react'
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
type Lang = 'ru' | 'en' | 'kk'
type Theme = 'light' | 'dark'

type Flash = {
  type: 'success' | 'error'
  message: string
}

const LOCALES: Record<Lang, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  kk: 'kk-KZ',
}

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  ru: {
    nav_sessions: 'Сеансы',
    nav_seats: 'Места',
    nav_bookings: 'Бронирования',
    nav_admin: 'Админ',
    guest: 'Гость',
    logout: 'Выйти',
    theme_light: 'Светлая',
    theme_dark: 'Темная',
    language: 'Язык',
    hero_eyebrow: 'Бронирование билетов в кино',
    hero_title: 'Планируйте вечер за пару кликов.',
    hero_lead:
      'Выбирайте фильмы, сравнивайте сеансы и фиксируйте лучшие места в зале. Все данные синхронизируются с кассой в реальном времени.',
    today_listing: 'Сегодня в афише',
    sessions_available: 'Доступно сеансов',
    quick_access: 'Быстрый доступ',
    quick_access_lead: 'Сохраните любимые фильмы и получайте напоминания о новых сеансах.',
    section_movies: 'Афиша',
    section_movies_lead: 'Выберите фильм, чтобы увидеть ближайшие сеансы.',
    section_sessions: 'Сеансы',
    section_sessions_lead: 'Сравните время и стоимость.',
    section_seats: 'Выбор мест',
    section_seats_lead: 'Нажмите на места, чтобы добавить их в бронь.',
    screen: 'Экран',
    select_session_hint: 'Выберите сеанс, чтобы увидеть схему зала.',
    booking: 'Бронирование',
    booking_movie: 'Фильм',
    booking_time: 'Время',
    booking_seats: 'Места',
    booking_total: 'Итого',
    booking_submit: 'Забронировать',
    profile: 'Профиль',
    profile_lead: 'Войдите, чтобы видеть свои бронирования.',
    auth_login: 'Вход',
    auth_register: 'Регистрация',
    label_name: 'Имя',
    label_email: 'Email',
    label_password: 'Пароль',
    auth_submit_login: 'Войти',
    auth_submit_register: 'Создать аккаунт',
    no_bookings: 'У вас пока нет бронирований.',
    status_cancelled: 'Отменено',
    status_confirmed: 'Подтверждено',
    seats_prefix: 'Места',
    qr: 'QR',
    pdf: 'PDF',
    cancel: 'Отменить',
    admin_title: 'Админ-панель',
    admin_lead: 'Управляйте фильмами, залами и сеансами.',
    admin_movies: 'Фильмы',
    admin_halls: 'Залы',
    admin_sessions: 'Сеансы',
    placeholder_title: 'Название',
    placeholder_description: 'Описание',
    placeholder_duration: 'Длительность (мин)',
    placeholder_poster: 'Постер URL',
    placeholder_rows: 'Ряды',
    placeholder_seats: 'Места',
    placeholder_movie: 'Выберите фильм',
    placeholder_hall: 'Выберите зал',
    placeholder_price: 'Цена',
    button_update: 'Обновить',
    button_add: 'Добавить',
    button_edit: 'Изменить',
    button_delete: 'Удалить',
    session_fallback: 'Сеанс',
    movie_fallback: 'Фильм',
    qr_title: 'QR для бронирования',
    close: 'Закрыть',
    duration_unit: 'мин',
    seat_row_abbr: 'Р',
    seat_seat_abbr: 'М',
    flash_account_created: 'Аккаунт создан.',
    flash_logged_in: 'Вы вошли в профиль.',
    flash_auth_error: 'Ошибка авторизации',
    flash_login_required: 'Войдите, чтобы забронировать места.',
    flash_select_seats: 'Выберите места для бронирования.',
    flash_booking_confirmed: 'Бронирование подтверждено.',
    flash_booking_failed: 'Не удалось забронировать',
    flash_booking_cancelled: 'Бронирование отменено.',
    flash_cancel_failed: 'Не удалось отменить',
    flash_ticket_failed: 'Не удалось скачать билет',
    flash_qr_failed: 'Не удалось получить QR',
    flash_movie_saved: 'Фильм сохранен.',
    flash_movie_save_failed: 'Не удалось сохранить фильм',
    flash_movie_deleted: 'Фильм удален.',
    flash_movie_delete_failed: 'Не удалось удалить фильм',
    flash_hall_saved: 'Зал сохранен.',
    flash_hall_save_failed: 'Не удалось сохранить зал',
    flash_hall_deleted: 'Зал удален.',
    flash_hall_delete_failed: 'Не удалось удалить зал',
    flash_session_missing: 'Заполните фильм, зал и дату сеанса.',
    flash_session_saved: 'Сеанс сохранен.',
    flash_session_save_failed: 'Не удалось сохранить сеанс',
    flash_session_deleted: 'Сеанс удален.',
    flash_session_delete_failed: 'Не удалось удалить сеанс',
  },
  en: {
    nav_sessions: 'Sessions',
    nav_seats: 'Seats',
    nav_bookings: 'Bookings',
    nav_admin: 'Admin',
    guest: 'Guest',
    logout: 'Log out',
    theme_light: 'Light',
    theme_dark: 'Dark',
    language: 'Language',
    hero_eyebrow: 'Movie ticket booking',
    hero_title: 'Plan your night in a few clicks.',
    hero_lead:
      'Pick films, compare sessions, and lock the best seats. Everything syncs with the box office in real time.',
    today_listing: 'Today in listings',
    sessions_available: 'Sessions available',
    quick_access: 'Quick access',
    quick_access_lead: 'Save favorite movies and get reminders about new sessions.',
    section_movies: 'Now showing',
    section_movies_lead: 'Choose a movie to see nearby sessions.',
    section_sessions: 'Sessions',
    section_sessions_lead: 'Compare time and price.',
    section_seats: 'Seat selection',
    section_seats_lead: 'Tap seats to add them to your booking.',
    screen: 'Screen',
    select_session_hint: 'Select a session to see the seating plan.',
    booking: 'Booking',
    booking_movie: 'Movie',
    booking_time: 'Time',
    booking_seats: 'Seats',
    booking_total: 'Total',
    booking_submit: 'Book now',
    profile: 'Profile',
    profile_lead: 'Sign in to see your bookings.',
    auth_login: 'Sign in',
    auth_register: 'Register',
    label_name: 'Name',
    label_email: 'Email',
    label_password: 'Password',
    auth_submit_login: 'Sign in',
    auth_submit_register: 'Create account',
    no_bookings: 'You have no bookings yet.',
    status_cancelled: 'Cancelled',
    status_confirmed: 'Confirmed',
    seats_prefix: 'Seats',
    qr: 'QR',
    pdf: 'PDF',
    cancel: 'Cancel',
    admin_title: 'Admin panel',
    admin_lead: 'Manage movies, halls, and sessions.',
    admin_movies: 'Movies',
    admin_halls: 'Halls',
    admin_sessions: 'Sessions',
    placeholder_title: 'Title',
    placeholder_description: 'Description',
    placeholder_duration: 'Duration (min)',
    placeholder_poster: 'Poster URL',
    placeholder_rows: 'Rows',
    placeholder_seats: 'Seats',
    placeholder_movie: 'Select a movie',
    placeholder_hall: 'Select a hall',
    placeholder_price: 'Price',
    button_update: 'Update',
    button_add: 'Add',
    button_edit: 'Edit',
    button_delete: 'Delete',
    session_fallback: 'Session',
    movie_fallback: 'Movie',
    qr_title: 'QR for booking',
    close: 'Close',
    duration_unit: 'min',
    seat_row_abbr: 'R',
    seat_seat_abbr: 'S',
    flash_account_created: 'Account created.',
    flash_logged_in: 'Signed in.',
    flash_auth_error: 'Authorization error',
    flash_login_required: 'Sign in to book seats.',
    flash_select_seats: 'Choose seats to book.',
    flash_booking_confirmed: 'Booking confirmed.',
    flash_booking_failed: 'Unable to book',
    flash_booking_cancelled: 'Booking cancelled.',
    flash_cancel_failed: 'Unable to cancel',
    flash_ticket_failed: 'Unable to download ticket',
    flash_qr_failed: 'Unable to get QR',
    flash_movie_saved: 'Movie saved.',
    flash_movie_save_failed: 'Unable to save movie',
    flash_movie_deleted: 'Movie deleted.',
    flash_movie_delete_failed: 'Unable to delete movie',
    flash_hall_saved: 'Hall saved.',
    flash_hall_save_failed: 'Unable to save hall',
    flash_hall_deleted: 'Hall deleted.',
    flash_hall_delete_failed: 'Unable to delete hall',
    flash_session_missing: 'Fill movie, hall, and session date.',
    flash_session_saved: 'Session saved.',
    flash_session_save_failed: 'Unable to save session',
    flash_session_deleted: 'Session deleted.',
    flash_session_delete_failed: 'Unable to delete session',
  },
  kk: {
    nav_sessions: 'Сеанстар',
    nav_seats: 'Орындар',
    nav_bookings: 'Брондаулар',
    nav_admin: 'Админ',
    guest: 'Қонақ',
    logout: 'Шығу',
    theme_light: 'Жарық',
    theme_dark: 'Қараңғы',
    language: 'Тіл',
    hero_eyebrow: 'Кино билеттерін брондау',
    hero_title: 'Кешті бірнеше рет басып жоспарлаңыз.',
    hero_lead:
      'Фильмдерді таңдаңыз, сеанстарды салыстырыңыз және залдағы ең жақсы орындарды бекітіңіз. Барлығы кассамен нақты уақытта синхрондалады.',
    today_listing: 'Бүгінгі афиша',
    sessions_available: 'Қолжетімді сеанс',
    quick_access: 'Жылдам қолжетім',
    quick_access_lead: 'Таңдаулы фильмдерді сақтап, жаңа сеанстар туралы еске салу алыңыз.',
    section_movies: 'Афиша',
    section_movies_lead: 'Жақын сеанстарды көру үшін фильм таңдаңыз.',
    section_sessions: 'Сеанстар',
    section_sessions_lead: 'Уақыты мен бағасын салыстырыңыз.',
    section_seats: 'Орын таңдау',
    section_seats_lead: 'Брондауға қосу үшін орындарды басыңыз.',
    screen: 'Экран',
    select_session_hint: 'Зал сызбасын көру үшін сеанс таңдаңыз.',
    booking: 'Брондау',
    booking_movie: 'Фильм',
    booking_time: 'Уақыты',
    booking_seats: 'Орындар',
    booking_total: 'Барлығы',
    booking_submit: 'Брондау',
    profile: 'Профиль',
    profile_lead: 'Брондауларыңызды көру үшін кіріңіз.',
    auth_login: 'Кіру',
    auth_register: 'Тіркелу',
    label_name: 'Аты',
    label_email: 'Email',
    label_password: 'Құпиясөз',
    auth_submit_login: 'Кіру',
    auth_submit_register: 'Тіркелу',
    no_bookings: 'Сізде әзірге брондау жоқ.',
    status_cancelled: 'Бас тартылды',
    status_confirmed: 'Расталды',
    seats_prefix: 'Орындар',
    qr: 'QR',
    pdf: 'PDF',
    cancel: 'Бас тарту',
    admin_title: 'Админ панель',
    admin_lead: 'Фильмдер, залдар және сеанстарды басқарыңыз.',
    admin_movies: 'Фильмдер',
    admin_halls: 'Залдар',
    admin_sessions: 'Сеанстар',
    placeholder_title: 'Атауы',
    placeholder_description: 'Сипаттама',
    placeholder_duration: 'Ұзақтығы (мин)',
    placeholder_poster: 'Постер URL',
    placeholder_rows: 'Қатарлар',
    placeholder_seats: 'Орындар',
    placeholder_movie: 'Фильмді таңдаңыз',
    placeholder_hall: 'Залды таңдаңыз',
    placeholder_price: 'Бағасы',
    button_update: 'Жаңарту',
    button_add: 'Қосу',
    button_edit: 'Өзгерту',
    button_delete: 'Жою',
    session_fallback: 'Сеанс',
    movie_fallback: 'Фильм',
    qr_title: 'Брондауға арналған QR',
    close: 'Жабу',
    duration_unit: 'мин',
    seat_row_abbr: 'Қ',
    seat_seat_abbr: 'О',
    flash_account_created: 'Аккаунт құрылды.',
    flash_logged_in: 'Профильге кірдіңіз.',
    flash_auth_error: 'Авторизация қатесі',
    flash_login_required: 'Орындарды брондау үшін кіріңіз.',
    flash_select_seats: 'Брондау үшін орындарды таңдаңыз.',
    flash_booking_confirmed: 'Брондау расталды.',
    flash_booking_failed: 'Брондау мүмкін емес',
    flash_booking_cancelled: 'Брондау тоқтатылды.',
    flash_cancel_failed: 'Бас тарту мүмкін емес',
    flash_ticket_failed: 'Билетті жүктеу мүмкін емес',
    flash_qr_failed: 'QR алу мүмкін емес',
    flash_movie_saved: 'Фильм сақталды.',
    flash_movie_save_failed: 'Фильмді сақтау мүмкін емес',
    flash_movie_deleted: 'Фильм жойылды.',
    flash_movie_delete_failed: 'Фильмді жою мүмкін емес',
    flash_hall_saved: 'Зал сақталды.',
    flash_hall_save_failed: 'Залды сақтау мүмкін емес',
    flash_hall_deleted: 'Зал жойылды.',
    flash_hall_delete_failed: 'Залды жою мүмкін емес',
    flash_session_missing: 'Фильм, зал және сеанс күнін толтырыңыз.',
    flash_session_saved: 'Сеанс сақталды.',
    flash_session_save_failed: 'Сеансты сақтау мүмкін емес',
    flash_session_deleted: 'Сеанс жойылды.',
    flash_session_delete_failed: 'Сеансты жою мүмкін емес',
  },
}

function getLocale(lang: Lang) {
  return LOCALES[lang] ?? LOCALES.ru
}

function t(lang: Lang, key: string) {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.ru[key] ?? key
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function formatMovieCount(value: number, lang: Lang) {
  if (lang === 'en') {
    return `${value} ${value === 1 ? 'movie' : 'movies'}`
  }
  if (lang === 'kk') {
    return `${value} ${value === 1 ? 'фильм' : 'фильмдер'}`
  }
  return `${value} ${pluralRu(value, 'фильм', 'фильма', 'фильмов')}`
}

function formatSessionCount(value: number, lang: Lang) {
  if (lang === 'en') {
    return `${value} ${value === 1 ? 'session' : 'sessions'}`
  }
  if (lang === 'kk') {
    return `${value} ${value === 1 ? 'сеанс' : 'сеанстар'}`
  }
  return `${value} ${pluralRu(value, 'сеанс', 'сеанса', 'сеансов')}`
}

function formatDuration(value: number, lang: Lang) {
  const unit = t(lang, 'duration_unit')
  return `${value} ${unit}`
}

function formatTime(value: string, locale: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
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
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem('kino_lang')
    if (stored === 'ru' || stored === 'en' || stored === 'kk') return stored
    return 'ru'
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('kino_theme')
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

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
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminTab, setAdminTab] = useState<'movies' | 'halls' | 'sessions'>('movies')
  const [activeNav, setActiveNav] = useState<'sessions' | 'seats' | 'bookings' | null>(null)

  const [qrModal, setQrModal] = useState<{ url: string; bookingId: number | null } | null>(null)
  const locale = useMemo(() => getLocale(lang), [lang])
  const seatRowAbbr = t(lang, 'seat_row_abbr')
  const seatSeatAbbr = t(lang, 'seat_seat_abbr')
  const sessionsRef = useRef<HTMLDivElement | null>(null)
  const seatsRef = useRef<HTMLDivElement | null>(null)
  const bookingsRef = useRef<HTMLDivElement | null>(null)

  const totalPrice = useMemo(() => {
    if (!selectedSession) return 0
    return selectedSession.base_price * selectedSeatIds.length
  }, [selectedSeatIds, selectedSession])

  const seatLabelMap = useMemo(() => {
    const map = new Map<number, string>()
    seats.forEach((seat) => {
      map.set(seat.id, `${seatRowAbbr}${seat.row}-${seatSeatAbbr}${seat.number}`)
    })
    return map
  }, [seats, seatRowAbbr, seatSeatAbbr])

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
    localStorage.setItem('kino_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    localStorage.setItem('kino_theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

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
    if (!user?.is_admin) {
      setShowAdmin(false)
    }
  }, [user?.is_admin])

  useEffect(() => {
    const entries = [
      { key: 'sessions' as const, ref: sessionsRef },
      { key: 'seats' as const, ref: seatsRef },
      { key: 'bookings' as const, ref: bookingsRef },
    ]

    const observer = new IntersectionObserver(
      (items) => {
        const visible = items
          .filter((item) => item.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const match = entries.find((entry) => entry.ref.current === visible?.target)
        if (match) {
          setActiveNav(match.key)
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.3, 0.6] }
    )

    entries.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (showAdmin) {
      setAdminTab('movies')
    }
  }, [showAdmin])

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
        setFlash({ type: 'success', message: t(lang, 'flash_account_created') })
      } else {
        const result = await loginUser({ email: authEmail, password: authPassword })
        setToken(result.token)
        setUser(result.user)
        setFlash({ type: 'success', message: t(lang, 'flash_logged_in') })
      }
      setAuthPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_auth_error')
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleBooking() {
    if (!token || !selectedSession) {
      setFlash({ type: 'error', message: t(lang, 'flash_login_required') })
      return
    }
    if (selectedSeatIds.length === 0) {
      setFlash({ type: 'error', message: t(lang, 'flash_select_seats') })
      return
    }
    setLoading(true)
    setFlash(null)
    try {
      await createBooking(token, { session_id: selectedSession.id, seat_ids: selectedSeatIds })
      setFlash({ type: 'success', message: t(lang, 'flash_booking_confirmed') })
      const availability = await fetchAvailability(selectedSession.id)
      setBookedSeatIds(availability.booked_seat_ids)
      setSelectedSeatIds([])
      const myBookings = await fetchMyBookings(token)
      setBookings(myBookings)
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_booking_failed')
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
      setFlash({ type: 'success', message: t(lang, 'flash_booking_cancelled') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_cancel_failed')
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
      const message = err instanceof Error ? err.message : t(lang, 'flash_ticket_failed')
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
      const message = err instanceof Error ? err.message : t(lang, 'flash_qr_failed')
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
    setShowAdmin(false)
    localStorage.removeItem('kino_token')
  }

  function scrollToSection(target: 'sessions' | 'seats' | 'bookings') {
    setActiveNav(target)
    const map = {
      sessions: sessionsRef,
      seats: seatsRef,
      bookings: bookingsRef,
    }
    map[target].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      setFlash({ type: 'success', message: t(lang, 'flash_movie_saved') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_movie_save_failed')
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
      setFlash({ type: 'success', message: t(lang, 'flash_movie_deleted') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_movie_delete_failed')
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
      setFlash({ type: 'success', message: t(lang, 'flash_hall_saved') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_hall_save_failed')
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
      setFlash({ type: 'success', message: t(lang, 'flash_hall_deleted') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_hall_delete_failed')
      setFlash({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminSessionSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!token) return
    if (!adminSessionForm.start || !adminSessionForm.movieId || !adminSessionForm.hallId) {
      setFlash({ type: 'error', message: t(lang, 'flash_session_missing') })
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
      setFlash({ type: 'success', message: t(lang, 'flash_session_saved') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_session_save_failed')
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
      setFlash({ type: 'success', message: t(lang, 'flash_session_deleted') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t(lang, 'flash_session_delete_failed')
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
          <button
            className={activeNav === 'sessions' ? 'ghost is-active' : 'ghost'}
            type="button"
            onClick={() => scrollToSection('sessions')}
          >
            {t(lang, 'nav_sessions')}
          </button>
          <button
            className={activeNav === 'seats' ? 'ghost is-active' : 'ghost'}
            type="button"
            onClick={() => scrollToSection('seats')}
          >
            {t(lang, 'nav_seats')}
          </button>
          <button
            className={activeNav === 'bookings' ? 'ghost is-active' : 'ghost'}
            type="button"
            onClick={() => scrollToSection('bookings')}
          >
            {t(lang, 'nav_bookings')}
          </button>
          {user?.is_admin && (
            <button
              className={showAdmin ? 'ghost is-active' : 'ghost'}
              type="button"
              onClick={() => setShowAdmin((prev) => !prev)}
            >
              {t(lang, 'nav_admin')}
            </button>
          )}
        </nav>
        <div className="topbar__controls">
          <label className="control">
            <span>{t(lang, 'language')}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="ru">Рус</option>
              <option value="en">Eng</option>
              <option value="kk">Қаз</option>
            </select>
          </label>
          <button
            className="ghost"
            type="button"
            onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? t(lang, 'theme_dark') : t(lang, 'theme_light')}
          </button>
        </div>
        <div className="topbar__auth">
          {user ? (
            <div className="user-pill">
              <div>
                <p className="user-pill__name">{user.name}</p>
                <p className="user-pill__email">{user.email}</p>
              </div>
              <button type="button" className="ghost" onClick={handleLogout}>
                {t(lang, 'logout')}
              </button>
            </div>
          ) : (
            <span className="user-pill__email">{t(lang, 'guest')}</span>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">{t(lang, 'hero_eyebrow')}</p>
          <h1>{t(lang, 'hero_title')}</h1>
          <p className="hero__lead">{t(lang, 'hero_lead')}</p>
          <div className="hero__meta">
            <div>
              <span className="meta__label">{t(lang, 'today_listing')}</span>
              <strong>{formatMovieCount(movies.length, lang)}</strong>
            </div>
            <div>
              <span className="meta__label">{t(lang, 'sessions_available')}</span>
              <strong>{formatSessionCount(sessions.length, lang)}</strong>
            </div>
          </div>
        </div>
        <div className="hero__card">
          <h2>{t(lang, 'quick_access')}</h2>
          <p>{t(lang, 'quick_access_lead')}</p>
          <div className="hero__stats">
            {nextSessions.map((session) => (
              <div key={session.id} className="session-pill" onClick={() => setSelectedSession(session)}>
                <span>{session.movie?.title ?? t(lang, 'session_fallback')}</span>
                <strong>{formatTime(session.start_time, locale)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="layout">
        <section className="content">
          <div className="panel">
            <div className="panel__header">
              <h2>{t(lang, 'section_movies')}</h2>
              <p>{t(lang, 'section_movies_lead')}</p>
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
                    <span>{formatDuration(movie.duration_mins, lang)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel" ref={sessionsRef}>
            <div className="panel__header">
              <h2>{t(lang, 'section_sessions')}</h2>
              <p>{t(lang, 'section_sessions_lead')}</p>
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
                    <span>{formatTime(session.start_time, locale)}</span>
                  </div>
                  <strong>{formatPrice(session.base_price, locale)}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="panel" ref={seatsRef}>
            <div className="panel__header">
              <h2>{t(lang, 'section_seats')}</h2>
              <p>{t(lang, 'section_seats_lead')}</p>
            </div>
            {selectedSession ? (
              <div className="seats">
                <div className="screen">{t(lang, 'screen')}</div>
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
              <p className="muted">{t(lang, 'select_session_hint')}</p>
            )}
          </div>
        </section>

        <aside className="sidebar">
          {flash && <div className={`flash flash--${flash.type}`}>{flash.message}</div>}

          <div className="panel panel--accent" ref={bookingsRef}>
            <h2>{t(lang, 'booking')}</h2>
            <div className="summary">
              <div>
                <span>{t(lang, 'booking_movie')}</span>
                <strong>{selectedSession?.movie?.title ?? selectedMovie?.title ?? '—'}</strong>
              </div>
              <div>
                <span>{t(lang, 'booking_time')}</span>
                <strong>{selectedSession ? formatTime(selectedSession.start_time, locale) : '—'}</strong>
              </div>
              <div>
                <span>{t(lang, 'booking_seats')}</span>
                <strong>{selectedSeatLabels.length ? selectedSeatLabels.join(', ') : '—'}</strong>
              </div>
              <div>
                <span>{t(lang, 'booking_total')}</span>
                <strong>{totalPrice ? formatPrice(totalPrice, locale) : '—'}</strong>
              </div>
            </div>
            <button className="primary" type="button" onClick={handleBooking} disabled={loading}>
              {t(lang, 'booking_submit')}
            </button>
          </div>

          <div className="panel">
            <div className="panel__header">
              <h2>{t(lang, 'profile')}</h2>
              <p>{t(lang, 'profile_lead')}</p>
            </div>
            {!user ? (
              <form className="auth" onSubmit={handleAuthSubmit}>
                <div className="auth__tabs">
                  <button
                    type="button"
                    className={authMode === 'login' ? 'tab is-active' : 'tab'}
                    onClick={() => setAuthMode('login')}
                  >
                    {t(lang, 'auth_login')}
                  </button>
                  <button
                    type="button"
                    className={authMode === 'register' ? 'tab is-active' : 'tab'}
                    onClick={() => setAuthMode('register')}
                  >
                    {t(lang, 'auth_register')}
                  </button>
                </div>
                {authMode === 'register' && (
                  <label>
                    {t(lang, 'label_name')}
                    <input value={authName} onChange={(e) => setAuthName(e.target.value)} />
                  </label>
                )}
                <label>
                  {t(lang, 'label_email')}
                  <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                </label>
                <label>
                  {t(lang, 'label_password')}
                  <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                </label>
                <button className="primary" type="submit" disabled={loading}>
                  {authMode === 'login' ? t(lang, 'auth_submit_login') : t(lang, 'auth_submit_register')}
                </button>
              </form>
            ) : (
              <div className="bookings">
                {bookings.length === 0 ? (
                  <p className="muted">{t(lang, 'no_bookings')}</p>
                ) : (
                  bookings.map((booking) => (
                    <div key={booking.id} className="booking-card">
                      <div className="booking-card__row">
                        <strong>{booking.session?.movie?.title ?? t(lang, 'movie_fallback')}</strong>
                        <span className={`tag ${booking.status === 'cancelled' ? 'tag--muted' : 'tag--accent'}`}>
                          {booking.status === 'cancelled' ? t(lang, 'status_cancelled') : t(lang, 'status_confirmed')}
                        </span>
                      </div>
                      <span>{booking.session ? formatTime(booking.session.start_time, locale) : ''}</span>
                      <span>
                        {t(lang, 'seats_prefix')}:{' '}
                        {booking.seats?.map((seat) => `${seatRowAbbr}${seat.row}-${seatSeatAbbr}${seat.number}`).join(', ') ?? '—'}
                      </span>
                      <span>{formatPrice(booking.total_price, locale)}</span>
                      <div className="booking-card__actions">
                        <button type="button" className="ghost" onClick={() => handleShowQr(booking.id)}>
                          {t(lang, 'qr')}
                        </button>
                        <button type="button" className="ghost" onClick={() => handleDownloadTicket(booking.id)}>
                          {t(lang, 'pdf')}
                        </button>
                        {booking.status !== 'cancelled' && (
                          <button type="button" className="ghost danger" onClick={() => handleCancelBooking(booking.id)}>
                            {t(lang, 'cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {user?.is_admin && showAdmin && (
        <div className="modal modal--admin" onClick={() => setShowAdmin(false)}>
          <div className="modal__card modal__card--admin" onClick={(e) => e.stopPropagation()}>
            <div className="admin__header">
              <div>
                <h2>{t(lang, 'admin_title')}</h2>
                <p>{t(lang, 'admin_lead')}</p>
              </div>
              <button className="ghost" type="button" onClick={() => setShowAdmin(false)}>
                {t(lang, 'close')}
              </button>
            </div>

            <div className="admin__tabs">
              <button
                type="button"
                className={adminTab === 'movies' ? 'tab is-active' : 'tab'}
                onClick={() => setAdminTab('movies')}
              >
                {t(lang, 'admin_movies')}
              </button>
              <button
                type="button"
                className={adminTab === 'halls' ? 'tab is-active' : 'tab'}
                onClick={() => setAdminTab('halls')}
              >
                {t(lang, 'admin_halls')}
              </button>
              <button
                type="button"
                className={adminTab === 'sessions' ? 'tab is-active' : 'tab'}
                onClick={() => setAdminTab('sessions')}
              >
                {t(lang, 'admin_sessions')}
              </button>
            </div>

            {adminTab === 'movies' && (
              <div className="admin__section">
                <h3>{t(lang, 'admin_movies')}</h3>
                <form className="admin__form" onSubmit={handleAdminMovieSubmit}>
                  <input
                    placeholder={t(lang, 'placeholder_title')}
                    value={adminMovieForm.title}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <input
                    placeholder={t(lang, 'placeholder_description')}
                    value={adminMovieForm.description}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                  <input
                    placeholder={t(lang, 'placeholder_duration')}
                    type="number"
                    value={adminMovieForm.duration}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, duration: Number(e.target.value) }))}
                  />
                  <input
                    placeholder={t(lang, 'placeholder_poster')}
                    value={adminMovieForm.poster}
                    onChange={(e) => setAdminMovieForm((prev) => ({ ...prev, poster: e.target.value }))}
                  />
                  <button className="primary" type="submit" disabled={loading}>
                    {editingMovieId ? t(lang, 'button_update') : t(lang, 'button_add')}
                  </button>
                </form>
                <div className="admin__list">
                  {movies.map((movie) => (
                    <div key={movie.id} className="admin__item">
                      <div>
                        <strong>{movie.title}</strong>
                        <span>{formatDuration(movie.duration_mins, lang)}</span>
                      </div>
                      <div className="admin__actions">
                        <button type="button" className="ghost" onClick={() => startEditMovie(movie)}>
                          {t(lang, 'button_edit')}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleAdminDeleteMovie(movie.id)}>
                          {t(lang, 'button_delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminTab === 'halls' && (
              <div className="admin__section">
                <h3>{t(lang, 'admin_halls')}</h3>
                <form className="admin__form" onSubmit={handleAdminHallSubmit}>
                  <input
                    placeholder={t(lang, 'placeholder_title')}
                    value={adminHallForm.name}
                    onChange={(e) => setAdminHallForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <div className="admin__row">
                    <input
                      placeholder={t(lang, 'placeholder_rows')}
                      type="number"
                      value={adminHallForm.rows}
                      onChange={(e) => setAdminHallForm((prev) => ({ ...prev, rows: Number(e.target.value) }))}
                      disabled={editingHallId !== null}
                    />
                    <input
                      placeholder={t(lang, 'placeholder_seats')}
                      type="number"
                      value={adminHallForm.cols}
                      onChange={(e) => setAdminHallForm((prev) => ({ ...prev, cols: Number(e.target.value) }))}
                      disabled={editingHallId !== null}
                    />
                  </div>
                  <button className="primary" type="submit" disabled={loading}>
                    {editingHallId ? t(lang, 'button_update') : t(lang, 'button_add')}
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
                          {t(lang, 'button_edit')}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleAdminDeleteHall(hall.id)}>
                          {t(lang, 'button_delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminTab === 'sessions' && (
              <div className="admin__section">
                <h3>{t(lang, 'admin_sessions')}</h3>
                <form className="admin__form" onSubmit={handleAdminSessionSubmit}>
                  <select
                    value={adminSessionForm.movieId}
                    onChange={(e) => setAdminSessionForm((prev) => ({ ...prev, movieId: Number(e.target.value) }))}
                  >
                    <option value={0}>{t(lang, 'placeholder_movie')}</option>
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
                    <option value={0}>{t(lang, 'placeholder_hall')}</option>
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
                    placeholder={t(lang, 'placeholder_price')}
                    value={adminSessionForm.price}
                    onChange={(e) => setAdminSessionForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  />
                  <button className="primary" type="submit" disabled={loading}>
                    {editingSessionId ? t(lang, 'button_update') : t(lang, 'button_add')}
                  </button>
                </form>
                <div className="admin__list">
                  {adminSessions.map((session) => (
                    <div key={session.id} className="admin__item">
                      <div>
                        <strong>{session.movie?.title ?? t(lang, 'session_fallback')}</strong>
                        <span>{formatTime(session.start_time, locale)}</span>
                      </div>
                      <div className="admin__actions">
                        <button type="button" className="ghost" onClick={() => startEditSession(session)}>
                          {t(lang, 'button_edit')}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => handleAdminDeleteSession(session.id)}>
                          {t(lang, 'button_delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {qrModal && (
        <div className="modal" onClick={closeQr}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {t(lang, 'qr_title')} #{qrModal.bookingId}
            </h3>
            <img src={qrModal.url} alt="QR" />
            <button className="primary" type="button" onClick={closeQr}>
              {t(lang, 'close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
