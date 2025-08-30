import { supabase } from '../../lib/supabase'
import { SnakeSegment, MultiplayerSnake } from './types'
import { UPDATE_INTERVAL, BROADCAST_INTERVAL } from './types'

// Retry helper function for handling transient network issues
const retry = async <T>(fn: () => Promise<T>, maxAttempts = 10, delay = 1000): Promise<T> => {
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

export class NetworkManager {
  private serverId: string
  private playerId: string
  private username: string
  private updateInterval: NodeJS.Timeout | null = null
  private broadcastInterval: NodeJS.Timeout | null = null
  private syncChannel: any = null
  private positionChannel: any = null
  private heartbeatChannel: any = null
  private lastUpdateTime = 0
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private heartbeatInterval: NodeJS.Timeout | null = null
  private playerTimeouts = new Map<string, NodeJS.Timeout>()
  private lastBroadcastTime = 0
  private playerUsernames = new Map<string, string>() // Cache usernames to prevent glitching

  constructor(serverId: string, playerId: string, username: string) {
    this.serverId = serverId
    this.playerId = playerId
    this.username = username
  }

  async initialize(
    onSnakeUpdate: (snake: MultiplayerSnake) => void,
    onPlayerLeft: (playerId: string) => void,
    onFoodEaten: (foodIndex: number) => void
  ) {
    try {
      await this.setupRealtimeChannels(onSnakeUpdate, onPlayerLeft, onFoodEaten)
      await this.loadInitialPlayers(onSnakeUpdate)
      this.startHeartbeat(onPlayerLeft)
      this.isConnected = true
      this.reconnectAttempts = 0
    } catch (error) {
      console.error('Failed to initialize network manager:', error)
      this.handleConnectionError()
    }
  }

  private async setupRealtimeChannels(
    onSnakeUpdate: (snake: MultiplayerSnake) => void,
    onPlayerLeft: (playerId: string) => void,
    onFoodEaten: (foodIndex: number) => void
  ) {
    // Ultra-high-frequency position updates via broadcast (60fps)
    this.positionChannel = supabase
      .channel(`server-${this.serverId}-positions`, {
        config: { 
          broadcast: { self: false, ack: false },
          presence: { key: this.playerId }
        }
      })
      .on('broadcast', { event: 'position_update' }, (payload) => {
        if (payload.payload.playerId !== this.playerId) {
          this.handlePositionUpdate(payload.payload, onSnakeUpdate)
        }
      })
      .on('broadcast', { event: 'heartbeat' }, (payload) => {
        if (payload.payload.playerId !== this.playerId) {
          this.handleHeartbeat(payload.payload.playerId, onPlayerLeft)
        }
      })
      .on('broadcast', { event: 'food_eaten' }, (payload) => {
        if (payload.payload.playerId !== this.playerId) {
          onFoodEaten(payload.payload.foodIndex)
        }
      })
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync')
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Player joined:', key)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Player left:', key)
        if (key !== this.playerId) {
          onPlayerLeft(key)
        }
      })
      .subscribe((status) => {
        console.log('Position channel status:', status)
        if (status === 'SUBSCRIBED') {
          this.isConnected = true
          // Send initial presence
          this.positionChannel.track({
            playerId: this.playerId,
            username: this.username,
            online_at: new Date().toISOString()
          })
        }
      })

    // Database sync for persistence and new players
    this.syncChannel = supabase
      .channel(`server-${this.serverId}-sync`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'server_players',
        filter: `server_id=eq.${this.serverId}`
      }, (payload) => {
        if (payload.new && payload.new.player_id !== this.playerId) {
          this.handleDatabaseUpdate(payload.new, onSnakeUpdate)
        } else if (payload.old && payload.old.player_id !== this.playerId) {
          onPlayerLeft(payload.old.player_id)
        }
      })
      .subscribe((status) => {
        console.log('Sync channel status:', status)
      })
  }

  private handlePositionUpdate(payload: any, onSnakeUpdate: (snake: MultiplayerSnake) => void) {
    if (!payload.segments || !Array.isArray(payload.segments)) return

    // Clear any existing timeout for this player
    if (this.playerTimeouts.has(payload.playerId)) {
      clearTimeout(this.playerTimeouts.get(payload.playerId)!)
    }

    // Set new timeout to remove player if no updates received
    const timeout = setTimeout(() => {
      console.log('Player timed out:', payload.playerId)
      // Don't auto-remove, let presence handle it
    }, 3000)
    this.playerTimeouts.set(payload.playerId, timeout)

    // Cache username to prevent glitching
    if (payload.username && payload.username !== 'Unknown') {
      this.playerUsernames.set(payload.playerId, payload.username)
    }

    // Use cached username if current payload doesn't have one
    const username = payload.username && payload.username !== 'Unknown' 
      ? payload.username 
      : this.playerUsernames.get(payload.playerId) || 'Unknown'
       
    // Calculate angle if not provided
    let angle = payload.angle || 0
    if (!payload.angle && payload.segments.length > 1) {
      const head = payload.segments[0]
      const neck = payload.segments[1]
      angle = Math.atan2(head.y - neck.y, head.x - neck.x)
    }
    
    const snake: MultiplayerSnake = {
      playerId: payload.playerId,
      segments: payload.segments,
      targetSegments: [...payload.segments], // Deep copy
      color: payload.color || this.generatePlayerColor(payload.playerId),
      username: username,
      score: payload.score || 0,
      isAlive: payload.isAlive !== false,
      lastUpdate: Date.now(),
      interpolationProgress: 0,
      angle: angle
    }

    onSnakeUpdate(snake)
  }

  private handleDatabaseUpdate(data: any, onSnakeUpdate: (snake: MultiplayerSnake) => void) {
    if (!data.snake_body || !Array.isArray(data.snake_body)) return

    // Cache username from database
    const dbUsername = data.profiles?.username
    if (dbUsername && dbUsername !== 'Unknown') {
      this.playerUsernames.set(data.player_id, dbUsername)
    }

    // Use cached username or database username
    const username = dbUsername || this.playerUsernames.get(data.player_id) || 'Unknown'
    const snake: MultiplayerSnake = {
      playerId: data.player_id,
      segments: data.snake_body,
      targetSegments: [...data.snake_body], // Deep copy
      color: this.generatePlayerColor(data.player_id),
      username: username,
      score: data.score || 0,
      isAlive: data.is_alive !== false,
      lastUpdate: Date.now(),
      interpolationProgress: 0
    }

    onSnakeUpdate(snake)
  }

  private async loadInitialPlayers(onSnakeUpdate: (snake: MultiplayerSnake) => void) {
    try {
      const { data, error } = await retry(() =>
        supabase
          .from('server_players')
          .select(`
            player_id,
            snake_body,
            score,
            is_alive,
            profiles!inner(username)
          `)
          .eq('server_id', this.serverId)
          .neq('player_id', this.playerId)
      )

      if (error) {
        console.error('Error loading initial players:', error)
        return
      }

      if (data) {
        data.forEach(player => {
          if (Array.isArray(player.snake_body)) {
            // Cache username from initial load
            const dbUsername = player.profiles?.username
            if (dbUsername && dbUsername !== 'Unknown') {
              this.playerUsernames.set(player.player_id, dbUsername)
            }

            const username = dbUsername || 'Unknown'

            const snake: MultiplayerSnake = {
              playerId: player.player_id,
              segments: player.snake_body,
              targetSegments: [...player.snake_body], // Deep copy
              color: this.generatePlayerColor(player.player_id),
              username: username,
              score: player.score || 0,
              isAlive: player.is_alive !== false,
              lastUpdate: Date.now(),
              interpolationProgress: 0
            }
            onSnakeUpdate(snake)
          }
        })
      }
    } catch (error) {
      console.error('Error loading initial players after retries:', error)
    }
  }

  startUpdating(getSnakeData: () => { segments: SnakeSegment[], score: number, isAlive: boolean }) {
    // Database updates for persistence (reduced frequency)
    this.updateInterval = setInterval(async () => {
      const data = getSnakeData()
      if (data.segments.length === 0) return

      try {
        await this.updateDatabase(data)
      } catch (error) {
        console.error('Database update failed:', error)
        this.handleConnectionError()
      }
    }, UPDATE_INTERVAL)

    // Ultra-high-frequency broadcast updates (60fps)
    this.broadcastInterval = setInterval(() => {
      const data = getSnakeData()
      if (data.segments.length === 0) return

      this.broadcastPosition(data)
    }, BROADCAST_INTERVAL)
  }

  private async updateDatabase(data: { segments: SnakeSegment[], score: number, isAlive: boolean }) {
    // Remove throttling for more frequent updates
    this.lastUpdateTime = Date.now()

    try {
      await retry(() =>
        supabase
          .from('server_players')
          .update({
            snake_body: data.segments,
            score: data.score,
            is_alive: data.isAlive
          })
          .eq('server_id', this.serverId)
          .eq('player_id', this.playerId)
      )
    } catch (error) {
      console.error('Database update failed after retries:', error)
      this.handleConnectionError()
    }
  }

  private broadcastPosition(data: { segments: SnakeSegment[], score: number, isAlive: boolean }) {
    if (!this.positionChannel || !this.isConnected) return

    // Throttle broadcasts to prevent spam
    const now = Date.now()
    if (now - this.lastBroadcastTime < BROADCAST_INTERVAL) return
    this.lastBroadcastTime = now
    
    // Calculate movement angle for eyes
    let angle = 0
    if (data.segments.length > 1) {
      const head = data.segments[0]
      const neck = data.segments[1]
      angle = Math.atan2(head.y - neck.y, head.x - neck.x)
    }
    
    // Get current snake color from localStorage
    const snakeColor = localStorage.getItem('snakeColor') || '#00ffcc'
    
    this.positionChannel.send({
      type: 'broadcast',
      event: 'position_update',
      payload: {
        playerId: this.playerId,
        username: this.username,
        segments: [...data.segments], // Deep copy to prevent reference issues
        score: data.score,
        isAlive: data.isAlive,
        angle: angle,
        color: snakeColor,
        timestamp: Date.now()
      }
    }).catch((error: any) => {
      console.error('Broadcast failed:', error)
      this.handleConnectionError()
    })
  }

  async broadcastFoodEaten(foodIndex: number) {
    if (!this.positionChannel) return

    try {
      await this.positionChannel.send({
        type: 'broadcast',
        event: 'food_eaten',
        payload: {
          playerId: this.playerId,
          foodIndex,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Failed to broadcast food eaten:', error)
    }
  }

  private startHeartbeat(onPlayerLeft: (playerId: string) => void) {
    // Send heartbeat every 2 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.positionChannel && this.isConnected) {
        this.positionChannel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: {
            playerId: this.playerId,
            timestamp: Date.now()
          }
        }).catch(() => {
          // Ignore heartbeat errors
        })
      }
    }, 2000)
  }

  private handleHeartbeat(playerId: string, onPlayerLeft: (playerId: string) => void) {
    // Reset timeout for this player
    if (this.playerTimeouts.has(playerId)) {
      clearTimeout(this.playerTimeouts.get(playerId)!)
    }

    const timeout = setTimeout(() => {
      console.log('Player heartbeat timeout:', playerId)
      onPlayerLeft(playerId)
      this.playerTimeouts.delete(playerId)
    }, 5000) // 5 second timeout

    this.playerTimeouts.set(playerId, timeout)
  }

  private handleConnectionError() {
    this.isConnected = false
    this.reconnectAttempts++

    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      setTimeout(() => {
        this.reconnect()
      }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000))
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  private async reconnect() {
    try {
      // Recreate channels
      if (this.syncChannel) {
        await this.syncChannel.unsubscribe()
      }
      if (this.positionChannel) {
        await this.positionChannel.unsubscribe()
      }

      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reinitialize would need to be called from the game component
      console.log('Reconnection attempt completed')
    } catch (error) {
      console.error('Reconnection failed:', error)
      this.handleConnectionError()
    }
  }

  async addPlayerToServer(initialSnake: SnakeSegment[]) {
    if (initialSnake.length === 0) return

    try {
      const { data: existingPlayer } = await retry(() =>
        supabase
          .from('server_players')
          .select('id')
          .eq('server_id', this.serverId)
          .eq('player_id', this.playerId)
          .maybeSingle()
      )

      if (existingPlayer) {
        await retry(() =>
          supabase
            .from('server_players')
            .update({
              snake_position: initialSnake[0],
              snake_body: initialSnake,
              score: 0,
              is_alive: true
            })
            .eq('server_id', this.serverId)
            .eq('player_id', this.playerId)
        )
      } else {
        await retry(() =>
          supabase
            .from('server_players')
            .insert({
              server_id: this.serverId,
              player_id: this.playerId,
              snake_position: initialSnake[0],
              snake_body: initialSnake,
              score: 0,
              is_alive: true
            })
        )
      }
    } catch (error) {
      console.error('Error adding player to server after retries:', error)
    }
  }

  async cleanup() {
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Clear all player timeouts
    this.playerTimeouts.forEach(timeout => clearTimeout(timeout))
    this.playerTimeouts.clear()

    // Clear username cache
    this.playerUsernames.clear()
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval)
      this.broadcastInterval = null
    }

    if (this.heartbeatChannel) {
      await this.heartbeatChannel.unsubscribe()
      this.heartbeatChannel = null
    }

    if (this.syncChannel) {
      await this.syncChannel.unsubscribe()
      this.syncChannel = null
    }

    if (this.positionChannel) {
      // Untrack presence before unsubscribing
      try {
        await this.positionChannel.untrack()
      } catch (error) {
        console.log('Error untracking presence:', error)
      }
      await this.positionChannel.unsubscribe()
      this.positionChannel = null
    }

    try {
      await retry(() =>
        supabase
          .from('server_players')
          .delete()
          .eq('player_id', this.playerId)
          .eq('server_id', this.serverId)
      )
    } catch (error) {
      console.error('Error cleaning up player after retries:', error)
    }
  }

  private generatePlayerColor(playerId: string): string {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd']
    const index = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  isConnectionHealthy(): boolean {
    return this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts
  }
}