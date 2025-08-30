import { useState, useEffect } from 'react'
import { supabase, LeaderboardEntry } from '../lib/supabase'

// Retry helper function for handling transient network issues
const retry = async <T>(fn: () => Promise<T>, maxAttempts = 3, delay = 1000): Promise<T> => {
  let lastError: any
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      console.warn(`Attempt ${attempt} failed:`, error)
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }
  }
  
  throw lastError
}

export function useGameData() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [playersInGame, setPlayersInGame] = useState(0)
  const [globalWinnings, setGlobalWinnings] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGameData()
    
    // Set up real-time subscriptions for leaderboard changes
    const leaderboardSubscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('Profile changed:', payload)
          fetchLeaderboard()
          fetchGlobalWinnings()
        }
      )
      .subscribe()

    // Set up real-time subscriptions for server player changes
    const serverSubscription = supabase
      .channel('server-players-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'server_players' },
        (payload) => {
          console.log('Server players changed:', payload)
          fetchPlayersInGame()
        }
      )
      .subscribe()

    // Set up real-time subscriptions for game session changes
    const gameSessionSubscription = supabase
      .channel('game-sessions-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions' },
        (payload) => {
          console.log('Game session changed:', payload)
          fetchLeaderboard()
          fetchGlobalWinnings()
        }
      )
      .subscribe()

    return () => {
      leaderboardSubscription.unsubscribe()
      serverSubscription.unsubscribe()
      gameSessionSubscription.unsubscribe()
    }
  }, [])

  const fetchGameData = async () => {
    await Promise.all([
      fetchLeaderboard(),
      fetchPlayersInGame(),
      fetchGlobalWinnings()
    ])
    setLoading(false)
  }

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await retry(() => 
        supabase
          .from('profiles')
          .select('id, username, total_winnings, games_played, games_won')
          .order('total_winnings', { ascending: false })
          .limit(10)
      )

      if (error) {
        console.error('Error fetching leaderboard:', error)
        return
      }

      // Calculate win rate for each profile
      const leaderboardData = (data || []).map(profile => ({
        ...profile,
        win_rate: profile.games_played > 0 ? (profile.games_won / profile.games_played) * 100 : 0
      }))

      setLeaderboard(leaderboardData)
    } catch (error) {
      console.error('Error fetching leaderboard after retries:', error)
    }
  }

  const fetchPlayersInGame = async () => {
    try {
      const { count, error } = await retry(() =>
        supabase
          .from('server_players')
          .select('*', { count: 'exact', head: true })
      )

      if (error) {
        console.error('Error fetching players in game:', error)
        return
      }

      setPlayersInGame(count || 0)
    } catch (error) {
      console.error('Error fetching players in game after retries:', error)
    }
  }

  const fetchGlobalWinnings = async () => {
    try {
      const { data, error } = await retry(() =>
        supabase
          .from('profiles')
          .select('total_winnings')
      )

      if (error) {
        console.error('Error fetching global winnings:', error)
        return
      }

      const total = data?.reduce((sum, profile) => sum + (profile.total_winnings || 0), 0) || 0
      setGlobalWinnings(total)
    } catch (error) {
      console.error('Error fetching global winnings after retries:', error)
    }
  }

  const joinGame = async (betAmount: number, userId: string) => {
    try {
      // First, check if this is the user's first game and process affiliate commission
      const { data: existingGames } = await retry(() =>
        supabase
          .from('game_sessions')
          .select('id')
          .eq('player_id', userId)
          .limit(1)
      )

      const isFirstGame = !existingGames || existingGames.length === 0

      if (isFirstGame) {
        // Process affiliate commission for first-time players
        await retry(() =>
          supabase.rpc('process_affiliate_commission', {
            p_referred_user_id: userId,
            p_bet_amount: betAmount
          })
        )
      }

      // Use the PostgreSQL function to get or create a server
      const { data: serverData, error: serverError } = await retry(() =>
        supabase
          .rpc('get_or_create_server', {
            bet_amount_param: betAmount
          })
      )

      if (serverError) {
        console.error('Error getting/creating server:', serverError)
        throw serverError
      }

      const serverId = serverData
      console.log('Got server:', serverId)

      // Add player to server
      const { error: joinError } = await retry(() =>
        supabase
          .from('server_players')
          .insert({
            server_id: serverId,
            player_id: userId,
            snake_position: { x: Math.floor(Math.random() * 20) + 5, y: Math.floor(Math.random() * 20) + 5 },
            snake_body: [{ x: Math.floor(Math.random() * 20) + 5, y: Math.floor(Math.random() * 20) + 5 }]
          })
      )

      if (joinError) throw joinError

      console.log('Successfully joined server:', serverId)

      // Refresh players in game count
      fetchPlayersInGame()

      return { success: true, serverId }
    } catch (error) {
      console.error('Error joining game:', error)
      return { success: false, error }
    }
  }

  return {
    leaderboard,
    playersInGame,
    globalWinnings,
    loading,
    joinGame
  }
}