import { SnakeSegment, Food, Camera, MultiplayerSnake } from './types'
import { 
  SEGMENT_SIZE, INITIAL_SEGMENTS, SEGMENT_SPACING, LERP_FACTOR, SPEED, 
  FOOD_COUNT, FOOD_RADIUS, ARENA_WIDTH, ARENA_HEIGHT, CAMERA_LERP,
  INTERPOLATION_INTERVAL, MAX_INTERPOLATION_TIME
} from './types'

export class GameLogic {
  private interpolationInterval: NodeJS.Timeout | null = null

  initializeSnake(): SnakeSegment[] {
    const initialSnake: SnakeSegment[] = []
    const startX = Math.random() * (ARENA_WIDTH - 400) + 200
    const startY = Math.random() * (ARENA_HEIGHT - 400) + 200
    
    for (let i = 0; i < INITIAL_SEGMENTS; i++) {
      initialSnake.push({
        x: startX - i * (SEGMENT_SPACING + 5),
        y: startY
      })
    }
    
    return initialSnake
  }

  spawnFood(): Food[] {
    const foods: Food[] = []
    for (let i = 0; i < FOOD_COUNT; i++) {
      foods.push({
        x: Math.random() * (ARENA_WIDTH - 2 * FOOD_RADIUS) + FOOD_RADIUS,
        y: Math.random() * (ARENA_HEIGHT - 2 * FOOD_RADIUS) + FOOD_RADIUS,
        radius: FOOD_RADIUS,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`
      })
    }
    return foods
  }

  updateSnake(
    currentSnake: SnakeSegment[], 
    angle: number, 
    boostActive: boolean, 
    isAlive: boolean
  ): SnakeSegment[] {
    if (!isAlive || currentSnake.length === 0) return currentSnake

    const newSnake = [...currentSnake]
    const currentSpeed = boostActive ? SPEED * 2.0 : SPEED
    const head = newSnake[0]

    // Move head
    head.x += Math.cos(angle) * currentSpeed
    head.y += Math.sin(angle) * currentSpeed

    // Keep snake in bounds
    head.x = Math.max(SEGMENT_SIZE / 2, Math.min(ARENA_WIDTH - SEGMENT_SIZE / 2, head.x))
    head.y = Math.max(SEGMENT_SIZE / 2, Math.min(ARENA_HEIGHT - SEGMENT_SIZE / 2, head.y))

    // Move body segments with improved following
    for (let i = 1; i < newSnake.length; i++) {
      const prev = newSnake[i - 1]
      const curr = newSnake[i]
      const dx = prev.x - curr.x
      const dy = prev.y - curr.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist > 0) {
        const moveAmount = (dist - SEGMENT_SPACING) * LERP_FACTOR * (boostActive ? 2.0 : 1)
        curr.x += (dx / dist) * moveAmount
        curr.y += (dy / dist) * moveAmount
      }
    }

    return newSnake
  }

  updateCamera(
    currentCamera: Camera, 
    snakeHead: SnakeSegment | null, 
    viewportWidth: number, 
    viewportHeight: number
  ): Camera {
    if (!snakeHead) return currentCamera
    
    const targetX = snakeHead.x - viewportWidth / 2
    const targetY = snakeHead.y - viewportHeight / 2
    
    const clampedTargetX = Math.max(0, Math.min(ARENA_WIDTH - viewportWidth, targetX))
    const clampedTargetY = Math.max(0, Math.min(ARENA_HEIGHT - viewportHeight, targetY))
    
    return {
      ...currentCamera,
      targetX: clampedTargetX,
      targetY: clampedTargetY,
      x: currentCamera.x + (clampedTargetX - currentCamera.x) * CAMERA_LERP,
      y: currentCamera.y + (clampedTargetY - currentCamera.y) * CAMERA_LERP
    }
  }

  checkFoodCollision(
    snakeHead: SnakeSegment, 
    foods: Food[]
  ): { collisionIndex: number; newFood: Food } | null {
    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i]
      const dx = snakeHead.x - food.x
      const dy = snakeHead.y - food.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < SEGMENT_SIZE / 2 + food.radius) {
        const newFood: Food = {
          x: Math.random() * (ARENA_WIDTH - 2 * FOOD_RADIUS) + FOOD_RADIUS,
          y: Math.random() * (ARENA_HEIGHT - 2 * FOOD_RADIUS) + FOOD_RADIUS,
          radius: FOOD_RADIUS,
          color: `hsl(${Math.random() * 360}, 80%, 60%)`
        }
        
        return { collisionIndex: i, newFood }
      }
    }
    
    return null
  }

  checkSnakeCollision(
    mySnakeHead: SnakeSegment, 
    otherSnakes: MultiplayerSnake[], 
    gameStartTime: number
  ): boolean {
    const timeSinceStart = Date.now() - gameStartTime
    if (timeSinceStart < 5000) return false // Grace period

    return otherSnakes.some(otherSnake => {
      if (!otherSnake.isAlive) return false

      return otherSnake.segments.some(segment => {
        const dx = mySnakeHead.x - segment.x
        const dy = mySnakeHead.y - segment.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance < SEGMENT_SIZE * 0.4
      })
    })
  }

  addSnakeSegment(currentSnake: SnakeSegment[]): SnakeSegment[] {
    if (currentSnake.length === 0) return currentSnake
    
    const tail = currentSnake[currentSnake.length - 1]
    return [...currentSnake, { x: tail.x, y: tail.y }]
  }

  startInterpolation(
    updateOtherSnakes: (updater: (snakes: MultiplayerSnake[]) => MultiplayerSnake[]) => void
  ) {
    this.interpolationInterval = setInterval(() => {
      updateOtherSnakes(snakes => 
        snakes.map(snake => {
          if (!snake.isAlive || !snake.targetSegments || snake.segments.length !== snake.targetSegments.length) {
            return snake
          }

          // Check if interpolation is needed
          const timeSinceUpdate = Date.now() - snake.lastUpdate
          if (timeSinceUpdate > 100) { // Reduced from 200ms to 100ms
            // Snap to target if too much time has passed
            return {
              ...snake,
              segments: [...snake.targetSegments],
              interpolationProgress: 1
            }
          }

          // Much smoother and faster interpolation
          const interpolationFactor = Math.min(0.8, timeSinceUpdate / 50) // Increased from 0.3 to 0.8
          const interpolatedSegments = snake.segments.map((segment, index) => {
            const target = snake.targetSegments[index]
            if (!target) return segment

            return {
              x: segment.x + (target.x - segment.x) * interpolationFactor,
              y: segment.y + (target.y - segment.y) * interpolationFactor
            }
          })

          return {
            ...snake,
            segments: interpolatedSegments,
            interpolationProgress: Math.min(1, snake.interpolationProgress + interpolationFactor)
          }
        })
      )
    }, INTERPOLATION_INTERVAL)
  }

  stopInterpolation() {
    if (this.interpolationInterval) {
      clearInterval(this.interpolationInterval)
      this.interpolationInterval = null
    }
  }

  cleanupStaleSnakes(
    snakes: MultiplayerSnake[], 
    maxAge: number = 3000 // Reduced from 5000ms to 3000ms
  ): MultiplayerSnake[] {
    const now = Date.now()
    return snakes.filter(snake => now - snake.lastUpdate < maxAge)
  }
}