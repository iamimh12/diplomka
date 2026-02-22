export type User = {
  id: number
  name: string
  email: string
  is_admin: boolean
}

export type Movie = {
  id: number
  title: string
  description: string
  duration_mins: number
  poster_url: string
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
  created_at: string
  session?: Session
  seats?: Seat[]
}
