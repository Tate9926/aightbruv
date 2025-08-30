import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Profile {
  id: string
  username: string
  total_winnings: number
  games_played: number
  games_won: number
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface GameServer {
  id: string
  server_name: string
  current_players: number
  max_players: number
  status: 'waiting' | 'playing' | 'finished'
  bet_amount: number
  prize_pool: number
  created_at: string
  started_at?: string
  finished_at?: string
}

export interface ServerPlayer {
  id: string
  server_id: string
  player_id: string
  snake_position: { x: number; y: number }
  snake_body: { x: number; y: number }[]
  score: number
  is_alive: boolean
  joined_at: string
  profiles?: Profile
}

export interface LeaderboardEntry {
  id: string
  username: string
  total_winnings: number
  games_played: number
  games_won: number
  win_rate: number
}

export interface CryptoAddress {
  id: string
  address: string
  network: 'ethereum' | 'tron' | 'solana'
  is_assigned: boolean
  created_at: string
}

export interface UserWallet {
  id: string
  user_id: string
  crypto_address_id: string
  created_at: string
  updated_at: string
}