import { Camera, SnakeSegment, Food, MultiplayerSnake } from './types'
import { ARENA_WIDTH, ARENA_HEIGHT, FOOD_RADIUS } from './types'

// Visual constants matching the HTML example exactly
const SEGMENT_SIZE = 34 // Exact match from HTML
const EYE_RADIUS = 8
const PUPIL_RADIUS = 4
const EYE_OFFSET = 10
const PUPIL_MOVE = 2

export class GameRenderer {
  private ctx: CanvasRenderingContext2D
  private viewportWidth: number
  private viewportHeight: number

  constructor(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number) {
    this.ctx = ctx
    this.viewportWidth = viewportWidth
    this.viewportHeight = viewportHeight
  }

  updateViewport(width: number, height: number) {
    this.viewportWidth = width
    this.viewportHeight = height
  }

  clear() {
    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)
  }

  drawArena(camera: Camera) {
    this.ctx.fillStyle = '#111'
    this.ctx.fillRect(-camera.x, -camera.y, ARENA_WIDTH, ARENA_HEIGHT)
    
    const gridSize = 50
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    this.ctx.lineWidth = 1
    
    // Only draw grid lines that are visible
    const startX = Math.floor(camera.x / gridSize) * gridSize
    const endX = Math.ceil((camera.x + this.viewportWidth) / gridSize) * gridSize
    const startY = Math.floor(camera.y / gridSize) * gridSize
    const endY = Math.ceil((camera.y + this.viewportHeight) / gridSize) * gridSize
    
    for (let x = startX; x <= Math.min(endX, ARENA_WIDTH); x += gridSize) {
      this.ctx.beginPath()
      this.ctx.moveTo(x - camera.x, -camera.y)
      this.ctx.lineTo(x - camera.x, ARENA_HEIGHT - camera.y)
      this.ctx.stroke()
    }
    
    for (let y = startY; y <= Math.min(endY, ARENA_HEIGHT); y += gridSize) {
      this.ctx.beginPath()
      this.ctx.moveTo(-camera.x, y - camera.y)
      this.ctx.lineTo(ARENA_WIDTH - camera.x, y - camera.y)
      this.ctx.stroke()
    }
    
    // Draw arena boundaries
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    this.ctx.lineWidth = 3
    this.ctx.strokeRect(-camera.x, -camera.y, ARENA_WIDTH, ARENA_HEIGHT)
  }

  drawFood(foods: Food[], camera: Camera) {
    foods.forEach(food => {
      // Only draw food that's visible
      if (food.x < camera.x - food.radius || food.x > camera.x + this.viewportWidth + food.radius ||
          food.y < camera.y - food.radius || food.y > camera.y + this.viewportHeight + food.radius) {
        return
      }
      
      // Simple flat food circles - exactly like HTML example
      this.ctx.fillStyle = food.color
      this.ctx.beginPath()
      this.ctx.arc(food.x - camera.x, food.y - camera.y, food.radius, 0, Math.PI * 2)
      this.ctx.fill()
    })
  }

  drawSnake(snake: SnakeSegment[], color: string, camera: Camera, showEyes: boolean = false, angle: number = 0, forceShowEyes: boolean = false) {
    if (snake.length === 0) return

    // Draw segments exactly like the HTML example
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i]
      
      // Only draw segments that are visible
      if (seg.x < camera.x - SEGMENT_SIZE || seg.x > camera.x + this.viewportWidth + SEGMENT_SIZE ||
          seg.y < camera.y - SEGMENT_SIZE || seg.y > camera.y + this.viewportHeight + SEGMENT_SIZE) {
        continue
      }
      
      const screenX = seg.x - camera.x
      const screenY = seg.y - camera.y
      
      // EXACT MATCH: Flat color body with soft outline
      this.ctx.fillStyle = color || '#66d9ff'  // flat light blue body
      this.ctx.strokeStyle = this.getDarkerShade(color || '#66d9ff') // softer, darker outline
      this.ctx.lineWidth = 0.4  // thinner outline - exactly like HTML
      
      this.ctx.beginPath()
      this.ctx.arc(screenX, screenY, SEGMENT_SIZE / 2, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.stroke()
    }

    // Draw eyes only on head (first segment) - exactly like HTML
    if (snake.length > 0) {
      this.drawEyes(snake[0], camera, angle)
    }
  }

  private drawEyes(head: SnakeSegment, camera: Camera, angle: number) {
    const headScreenX = head.x - camera.x
    const headScreenY = head.y - camera.y
    
    // EXACT MATCH: Eye positioning from HTML example
    const leftEye = {
      x: headScreenX + Math.sin(angle) * EYE_OFFSET,
      y: headScreenY - Math.cos(angle) * EYE_OFFSET
    }
    const rightEye = {
      x: headScreenX - Math.sin(angle) * EYE_OFFSET,
      y: headScreenY + Math.cos(angle) * EYE_OFFSET
    }

    // EXACT MATCH: Simple white eyes
    this.ctx.fillStyle = 'white'
    this.ctx.beginPath()
    this.ctx.arc(leftEye.x, leftEye.y, EYE_RADIUS, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(rightEye.x, rightEye.y, EYE_RADIUS, 0, Math.PI * 2)
    this.ctx.fill()

    // EXACT MATCH: Pupil positioning and movement
    const leftPupil = {
      x: leftEye.x + Math.cos(angle) * PUPIL_MOVE,
      y: leftEye.y + Math.sin(angle) * PUPIL_MOVE
    }
    const rightPupil = {
      x: rightEye.x + Math.cos(angle) * PUPIL_MOVE,
      y: rightEye.y + Math.sin(angle) * PUPIL_MOVE
    }

    // EXACT MATCH: Simple black pupils
    this.ctx.fillStyle = 'black'
    this.ctx.beginPath()
    this.ctx.arc(leftPupil.x, leftPupil.y, PUPIL_RADIUS, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(rightPupil.x, rightPupil.y, PUPIL_RADIUS, 0, Math.PI * 2)
    this.ctx.fill()
  }

  drawPlayerNames(mySnake: SnakeSegment[], otherSnakes: MultiplayerSnake[], username: string, camera: Camera) {
    this.ctx.font = 'bold 16px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.fillStyle = 'yellow'
    this.ctx.strokeStyle = 'black'
    this.ctx.lineWidth = 2

    // Draw own score
    if (mySnake.length > 0) {
      const head = mySnake[0]
      // Calculate score based on snake length (simple scoring)
      const score = (mySnake.length - 7) * 10 // Starting with 7 segments, 10 points per additional segment
      const displayScore = Math.max(0, score).toString()
      this.ctx.strokeText(displayScore, head.x - camera.x, head.y - camera.y - 25)
      this.ctx.fillText(displayScore, head.x - camera.x, head.y - camera.y - 25)
    }

    // Draw other players' scores
    otherSnakes.forEach(snake => {
      if (snake.segments.length > 0 && snake.isAlive) {
        const head = snake.segments[0]
        const displayScore = snake.score.toString()
        this.ctx.strokeText(displayScore, head.x - camera.x, head.y - camera.y - 25)
        this.ctx.fillText(displayScore, head.x - camera.x, head.y - camera.y - 25)
      }
    })
  }

  // Helper function to get darker shade for outline - matches HTML logic
  private getDarkerShade(color: string): string {
    if (color === '#66d9ff') {
      return '#3399cc' // Exact match from HTML
    }
    
    // For other colors, create a darker version
    if (color.startsWith('#')) {
      const r = parseInt(color.substr(1, 2), 16)
      const g = parseInt(color.substr(3, 2), 16)
      const b = parseInt(color.substr(5, 2), 16)
      
      // Make it darker by reducing each component by 30%
      const newR = Math.floor(r * 0.7)
      const newG = Math.floor(g * 0.7)
      const newB = Math.floor(b * 0.7)
      
      return `rgb(${newR}, ${newG}, ${newB})`
    }
    
    return color
  }
}
