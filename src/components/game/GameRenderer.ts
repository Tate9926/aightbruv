import { Camera, SnakeSegment, Food, MultiplayerSnake } from './types'
import { SEGMENT_SIZE, ARENA_WIDTH, ARENA_HEIGHT, FOOD_RADIUS } from './types'

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
      
      this.ctx.fillStyle = food.color
      this.ctx.beginPath()
      this.ctx.arc(food.x - camera.x, food.y - camera.y, food.radius, 0, Math.PI * 2)
      this.ctx.fill()
    })
  }

  drawSnake(snake: SnakeSegment[], color: string, camera: Camera, showEyes: boolean = false, angle: number = 0, forceShowEyes: boolean = false) {
    if (snake.length === 0) return

    this.ctx.save()
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
    this.ctx.shadowBlur = 6

    // Draw segments
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i]
      
      // Only draw segments that are visible
      if (seg.x < camera.x - SEGMENT_SIZE || seg.x > camera.x + this.viewportWidth + SEGMENT_SIZE ||
          seg.y < camera.y - SEGMENT_SIZE || seg.y > camera.y + this.viewportHeight + SEGMENT_SIZE) {
        continue
      }
      
      const brightness = 1.2 - (i / snake.length) * 0.2
      const screenX = seg.x - camera.x
      const screenY = seg.y - camera.y
      const grad = this.ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, SEGMENT_SIZE / 2)
      grad.addColorStop(0, this.adjustColorBrightness(color, brightness))
      grad.addColorStop(0.5, color)
      grad.addColorStop(1, this.adjustColorBrightness(color, 0.9))
      
      this.ctx.fillStyle = grad
      this.ctx.beginPath()
      this.ctx.arc(screenX, screenY, SEGMENT_SIZE / 2, 0, Math.PI * 2)
      this.ctx.fill()
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      this.ctx.lineWidth = 1.5
      this.ctx.beginPath()
      this.ctx.arc(screenX, screenY, SEGMENT_SIZE / 2 - 2, 0, Math.PI * 2)
      this.ctx.stroke()
    }

    // Always draw eyes for all snakes
    if (snake.length > 0) {
      this.drawEyes(snake[0], camera, angle)
    }

    this.ctx.restore()
  }

  private drawEyes(head: SnakeSegment, camera: Camera, angle: number) {
    const headScreenX = head.x - camera.x
    const headScreenY = head.y - camera.y
    
    // Larger eyes for better visibility on all devices
    const eyeOffset = 10
    const eyeRadius = 8
    const pupilRadius = 4
    const pupilMove = 3
    
    const leftEye = {
      x: headScreenX + Math.sin(angle) * eyeOffset,
      y: headScreenY - Math.cos(angle) * eyeOffset
    }
    const rightEye = {
      x: headScreenX - Math.sin(angle) * eyeOffset,
      y: headScreenY + Math.cos(angle) * eyeOffset
    }

    // Draw eye whites
    this.ctx.fillStyle = 'white'
    this.ctx.beginPath()
    this.ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2)
    this.ctx.fill()

    // Draw pupils
    const pupilPos = (eye: { x: number; y: number }) => {
      const dx = Math.cos(angle) * pupilMove
      const dy = Math.sin(angle) * pupilMove
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scale = Math.min(1, (eyeRadius - pupilRadius) / dist)
      return { x: eye.x + dx * scale, y: eye.y + dy * scale }
    }

    const leftPupil = pupilPos(leftEye)
    const rightPupil = pupilPos(rightEye)

    this.ctx.fillStyle = 'black'
    this.ctx.beginPath()
    this.ctx.arc(leftPupil.x, leftPupil.y, pupilRadius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(rightPupil.x, rightPupil.y, pupilRadius, 0, Math.PI * 2)
    this.ctx.fill()

    // Draw eye highlights
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    this.ctx.beginPath()
    this.ctx.arc(leftPupil.x + 1, leftPupil.y + 1, 1.5, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(rightPupil.x + 1, rightPupil.y + 1, 1.5, 0, Math.PI * 2)
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

  private adjustColorBrightness(hex: string, factor: number): string {
    const r = parseInt(hex.substr(1, 2), 16)
    const g = parseInt(hex.substr(3, 2), 16)
    const b = parseInt(hex.substr(5, 2), 16)
    const newR = Math.min(255, Math.max(0, Math.floor(r * factor)))
    const newG = Math.min(255, Math.max(0, Math.floor(g * factor)))
    const newB = Math.min(255, Math.max(0, Math.floor(b * factor)))
    return `rgb(${newR}, ${newG}, ${newB})`
  }
}