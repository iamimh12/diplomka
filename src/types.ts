export type User = {
  id: number
  name: string
  email: string
  is_admin: boolean
  avatar_url?: string
}

export type Movie = {
  id: number
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

export type Hall = {
  id: number
  name: string
  rows: number
  cols: number
}

export type Session = {
  id: number
  movie_id: number
  hall_id: number
  start_time: string
  base_price: number
  movie?: Movie
  hall?: Hall
}

export type Seat = {
  id: number
  hall_id: number
  row: number
  number: number
}

export type Booking = {
  id: number
  session_id: number
  status: string
  total_price: number
  payment_method?: string
  created_at: string
  session?: Session
  seats?: Seat[]
}

