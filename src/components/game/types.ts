export interface Position {
  x: number
  y: number
}

export interface Food {
  x: number
  y: number
  radius: number
  color: string
}

export interface SnakeSegment {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  targetX: number
  targetY: number
}

export interface MultiplayerSnake {
  playerId: string
  segments: SnakeSegment[]
  targetSegments: SnakeSegment[]
  color: string
  username: string
  score: number
  isAlive: boolean
  lastUpdate: number
  interpolationProgress: number
  angle?: number
}

export interface GameState {
  mySnake: SnakeSegment[]
  otherSnakes: MultiplayerSnake[]
  foods: Food[]
  angle: number
  snakeColor: string
  boostActive: boolean
  score: number
  isAlive: boolean
  camera: Camera
  isInitialized: boolean
}

// Game constants
export const SEGMENT_SIZE = 34 // Exact match from HTML example
export const INITIAL_SEGMENTS = 7
export const SEGMENT_SPACING = 2 // Exact match from HTML
export const LERP_FACTOR = 0.2
export const SPEED = 2.0 // Exact match from HTML (speed = 2)
export const FOOD_COUNT = 50
export const FOOD_RADIUS = 6 // Exact match from HTML (foodRadius = 6)
export const ARENA_WIDTH = 4000
export const ARENA_HEIGHT = 3000
export const CAMERA_LERP = 0.08

// Real-time sync constants
export const UPDATE_INTERVAL = 50 // Send updates every 50ms
export const BROADCAST_INTERVAL = 16 // Broadcast position every 16ms (60fps)
export const INTERPOLATION_INTERVAL = 16 // 60fps interpolation
