import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { GameRenderer } from './GameRenderer'
import { NetworkManager } from './NetworkManager'
import { GameLogic } from './GameLogic'
import { 
  SnakeSegment, Food, Camera, MultiplayerSnake, GameState,
  SEGMENT_SIZE, ARENA_WIDTH, ARENA_HEIGHT
} from './types'

interface SnakeGameProps {
  serverId: string
  playerId: string
  initialSnakeColor: string
  onGameEnd: (score: number) => void
}

export function SnakeGame({ serverId, playerId, initialSnakeColor, onGameEnd }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const joystickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Game managers
  const rendererRef = useRef<GameRenderer | null>(null)
  const networkManagerRef = useRef<NetworkManager | null>(null)
  const gameLogicRef = useRef<GameLogic>(new GameLogic())
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    mySnake: [],
    otherSnakes: [],
    foods: [],
    angle: 0,
    snakeColor: localStorage.getItem('snakeColor') || initialSnakeColor,
    boostActive: false,
    score: 0,
    isAlive: true,
    camera: { x: 0, y: 0, targetX: 0, targetY: 0 },
    isInitialized: false
  })
  
  // UI state
  const [isDragging, setIsDragging] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth)
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight)
  const [username, setUsername] = useState('')
  const [gameStartTime] = useState(Date.now())
  const [isMobile, setIsMobile] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  // Mobile orientation state
  const [isLandscape, setIsLandscape] = useState(false)
  const [showRotationPrompt, setShowRotationPrompt] = useState(false)

  // Cash out state
  const [cashOutProgress, setCashOutProgress] = useState(0)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const cashOutTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Add ref to access current game state in callbacks
  const gameStateRef = useRef(gameState)
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  // Listen for snake color changes from localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'snakeColor' && e.newValue) {
        setGameState(prev => ({ ...prev, snakeColor: e.newValue! }))
      }
    }

    // Listen for storage changes from other tabs
    window.addEventListener('storage', handleStorageChange)

    // Also check for changes periodically (for same-tab updates)
    const interval = setInterval(() => {
      const savedColor = localStorage.getItem('snakeColor')
      if (savedColor && savedColor !== gameState.snakeColor) {
        setGameState(prev => ({ ...prev, snakeColor: savedColor }))
      }
    }, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [gameState.snakeColor])

  // Keyboard controls for boost (K key)
  useEffect(() => {
    if (isMobile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && !e.repeat) {
        setGameState(prev => ({ ...prev, boostActive: true }))
      }
      
      // Cash out with Q key
      if (e.key.toLowerCase() === 'q' && !e.repeat && !isCashingOut && gameStateRef.current.isAlive) {
        setIsCashingOut(true)
        setCashOutProgress(0)
        
        let progress = 0
        cashOutTimerRef.current = setInterval(() => {
          progress += 100 / 30 // 30 intervals over 3 seconds
          setCashOutProgress(progress)
          
          if (progress >= 100) {
            // Cash out complete
            if (cashOutTimerRef.current) {
              clearInterval(cashOutTimerRef.current)
              cashOutTimerRef.current = null
            }
            setIsCashingOut(false)
            setCashOutProgress(0)
            onGameEnd(gameStateRef.current.score)
          }
        }, 100)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k') {
        setGameState(prev => ({ ...prev, boostActive: false }))
      }
      
      // Cancel cash out if Q key is released
      if (e.key.toLowerCase() === 'q') {
        if (cashOutTimerRef.current) {
          clearInterval(cashOutTimerRef.current)
          cashOutTimerRef.current = null
        }
        if (isCashingOut) {
          setIsCashingOut(false)
          setCashOutProgress(0)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (cashOutTimerRef.current) {
        clearInterval(cashOutTimerRef.current)
        cashOutTimerRef.current = null
      }
    }
  }, [isMobile, onGameEnd])

  // Mobile detection and resize handling
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           window.innerWidth <= 768 ||
                           ('ontouchstart' in window)
      setIsMobile(isMobileDevice)
      
      // Check orientation for mobile
      if (isMobileDevice) {
        const isCurrentlyLandscape = window.innerWidth > window.innerHeight
        setIsLandscape(isCurrentlyLandscape)
        setShowRotationPrompt(!isCurrentlyLandscape)
      }
    }
    
    checkMobile()
    
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
      checkMobile()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Get username from profile
  useEffect(() => {
    const fetchUsername = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', playerId)
        .single()
      
      if (data) {
        setUsername(data.username)
      }
    }
    
    fetchUsername()
  }, [playerId])

  // Initialize game
  useEffect(() => {
    const initializeGame = async () => {
      if (!username) return

      // Initialize snake
      const initialSnake = gameLogicRef.current.initializeSnake()
      const initialFoods = gameLogicRef.current.spawnFood()
      
      setGameState(prev => ({
        ...prev,
        mySnake: initialSnake,
        foods: initialFoods,
        isInitialized: true
      }))

      // Initialize network manager
      const networkManager = new NetworkManager(serverId, playerId, username)
      networkManagerRef.current = networkManager

      try {
        await networkManager.initialize(
          handleSnakeUpdate,
          handlePlayerLeft,
          handleFoodEaten
        )
        
        await networkManager.addPlayerToServer(initialSnake)
        networkManager.startUpdating(() => ({
          segments: gameStateRef.current.mySnake,
          score: gameStateRef.current.score,
          isAlive: gameStateRef.current.isAlive
        }))

        setConnectionStatus('connected')
      } catch (error) {
        console.error('Failed to initialize network:', error)
        setConnectionStatus('disconnected')
      }

      // Start interpolation
      gameLogicRef.current.startInterpolation(updateOtherSnakes)
    }

    initializeGame()

    return () => {
      gameLogicRef.current.stopInterpolation()
      if (networkManagerRef.current) {
        networkManagerRef.current.cleanup()
      }
    }
  }, [username, serverId, playerId])

  // Network event handlers
  const handleSnakeUpdate = useCallback((snake: MultiplayerSnake) => {
    setGameState(prev => ({
      ...prev,
      otherSnakes: prev.otherSnakes.some(s => s.playerId === snake.playerId)
        ? prev.otherSnakes.map(s => s.playerId === snake.playerId ? {
            ...snake,
            // Preserve interpolation state for smoother movement
            segments: s.segments.length === snake.segments.length ? s.segments : snake.segments,
            targetSegments: snake.segments,
            // Preserve username if the new one is Unknown but we had a real name
            username: snake.username === 'Unknown' && s.username !== 'Unknown' ? s.username : snake.username
          } : s)
        : [...prev.otherSnakes, snake]
    }))
  }, [])

  const handlePlayerLeft = useCallback((playerId: string) => {
    setGameState(prev => ({
      ...prev,
      otherSnakes: prev.otherSnakes.filter(s => s.playerId !== playerId)
    }))
  }, [])

  const handleFoodEaten = useCallback((foodIndex: number) => {
    setGameState(prev => ({
      ...prev,
      foods: prev.foods.filter((_, index) => index !== foodIndex)
    }))
  }, [])

  const updateOtherSnakes = useCallback((updater: (snakes: MultiplayerSnake[]) => MultiplayerSnake[]) => {
    setGameState(prev => ({
      ...prev,
      otherSnakes: updater(prev.otherSnakes)
    }))
  }, [])

  // Mouse/touch movement handlers
  useEffect(() => {
    if (isMobile) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas || gameState.mySnake.length === 0 || !gameState.isAlive) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const canvasX = (mouseX / rect.width) * viewportWidth + gameState.camera.x
      const canvasY = (mouseY / rect.height) * viewportHeight + gameState.camera.y
      
      const head = gameState.mySnake[0]
      const dx = canvasX - head.x
      const dy = canvasY - head.y
      
      if (dx !== 0 || dy !== 0) {
        setGameState(prev => ({ ...prev, angle: Math.atan2(dy, dx) }))
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [gameState.mySnake, viewportWidth, viewportHeight, gameState.isAlive, isMobile, gameState.camera])

  // Touch controls for mobile
  useEffect(() => {
    if (!isMobile) return

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas || gameState.mySnake.length === 0 || !gameState.isAlive) return

      const touch = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      const touchX = touch.clientX - rect.left
      const touchY = touch.clientY - rect.top
      
      const canvasX = (touchX / rect.width) * viewportWidth + gameState.camera.x
      const canvasY = (touchY / rect.height) * viewportHeight + gameState.camera.y
      
      const head = gameState.mySnake[0]
      const dx = canvasX - head.x
      const dy = canvasY - head.y
      
      if (dx !== 0 || dy !== 0) {
        setGameState(prev => ({ ...prev, angle: Math.atan2(dy, dx) }))
      }
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
      return () => canvas.removeEventListener('touchmove', handleTouchMove)
    }
  }, [gameState.mySnake, viewportWidth, viewportHeight, gameState.isAlive, isMobile, gameState.camera])

  // Joystick movement for mobile
  useEffect(() => {
    if (!isMobile) return

    const handleJoystickTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      e.preventDefault()
      
      const touch = e.touches[0]
      if (touch && joystickRef.current) {
        const rect = joystickRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        
        const dx = touch.clientX - centerX
        const dy = touch.clientY - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const maxDistance = rect.width / 2 - 15 // Account for knob size
        
        // Constrain to circle
        const constrainedDistance = Math.min(distance, maxDistance)
        const angle = Math.atan2(dy, dx)
        
        const knobX = Math.cos(angle) * constrainedDistance
        const knobY = Math.sin(angle) * constrainedDistance
        
        if (knobRef.current) {
          knobRef.current.style.left = `${rect.width / 2 + knobX - 15}px`
          knobRef.current.style.top = `${rect.height / 2 + knobY - 15}px`
        }
        
        // Update snake angle if significant movement
        if (constrainedDistance > 10) {
          setGameState(prev => ({ ...prev, angle }))
        }
      }
    }

    document.addEventListener('touchmove', handleJoystickTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', handleJoystickTouchMove)
  }, [isMobile, isDragging])

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameStateRef.current.isInitialized) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize renderer if needed
    if (!rendererRef.current) {
      rendererRef.current = new GameRenderer(ctx, viewportWidth, viewportHeight)
    } else {
      rendererRef.current.updateViewport(viewportWidth, viewportHeight)
    }

    // Update game state
    setGameState(prev => {
      if (!prev.isAlive) return prev // Don't update if dead
      
      const newSnake = gameLogicRef.current.updateSnake(
        prev.mySnake, 
        prev.angle, 
        prev.boostActive, 
        prev.isAlive
      )
      
      const newCamera = gameLogicRef.current.updateCamera(
        prev.camera,
        newSnake[0] || null,
        viewportWidth,
        viewportHeight
      )

      // Check food collision
      if (newSnake.length > 0) {
        const foodCollision = gameLogicRef.current.checkFoodCollision(newSnake[0], prev.foods)
        if (foodCollision) {
          // Broadcast food eaten
          if (networkManagerRef.current) {
            networkManagerRef.current.broadcastFoodEaten(foodCollision.collisionIndex)
          }

          return {
            ...prev,
            mySnake: gameLogicRef.current.addSnakeSegment(newSnake),
            camera: newCamera,
            foods: [
              ...prev.foods.filter((_, index) => index !== foodCollision.collisionIndex),
              foodCollision.newFood
            ],
            score: prev.score + 10
          }
        }

        // Check snake collision
        const collision = gameLogicRef.current.checkSnakeCollision(
          newSnake[0],
          prev.otherSnakes,
          gameStartTime
        )

        if (collision) {
          onGameEnd(prev.score)
          return { ...prev, isAlive: false }
        }
      }

      return {
        ...prev,
        mySnake: newSnake,
        camera: newCamera
      }
    })

    // Render
    const currentState = gameStateRef.current
    const renderer = rendererRef.current
    if (renderer) {
      renderer.clear()
      renderer.drawArena(currentState.camera)
      renderer.drawFood(currentState.foods, currentState.camera)
      
      // Draw other snakes
      currentState.otherSnakes.forEach(snake => {
        if (snake.isAlive && snake.segments.length > 0) {
          // Use the angle from network data or calculate from segments
          const snakeAngle = snake.angle || (snake.segments.length > 1 ? 
            Math.atan2(snake.segments[0].y - snake.segments[1].y, snake.segments[0].x - snake.segments[1].x) : 0)
          renderer.drawSnake(snake.segments, snake.color, currentState.camera, true, snakeAngle, true)
        }
      })
      
      // Draw own snake
      if (currentState.isAlive && currentState.mySnake.length > 0) {
        renderer.drawSnake(currentState.mySnake, currentState.snakeColor, currentState.camera, true, currentState.angle, true)
      }
      
      renderer.drawPlayerNames(currentState.mySnake, currentState.otherSnakes, username, currentState.camera)
    }

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [viewportWidth, viewportHeight, username, gameStartTime, onGameEnd])

  // Start game loop
  useEffect(() => {
    if (gameStateRef.current.mySnake.length > 0 && gameStateRef.current.isInitialized) {
      animationRef.current = requestAnimationFrame(gameLoop)
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameLoop, gameState.mySnake.length, gameState.isInitialized])

  // High DPI support
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scale = window.devicePixelRatio || 1
    canvas.width = viewportWidth * scale
    canvas.height = viewportHeight * scale
    canvas.style.width = `${viewportWidth}px`
    canvas.style.height = `${viewportHeight}px`
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(scale, scale)
    }
  }, [viewportWidth, viewportHeight])

  // Joystick handlers
  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickRef.current || !knobRef.current) return

    const rect = joystickRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const dx = clientX - (rect.left + centerX)
    const dy = clientY - (rect.top + centerY)
    const distance = Math.sqrt(dx * dx + dy * dy)
    const maxDistance = Math.min(centerX, centerY) - 15 // Account for knob size
    const constrainedDistance = Math.min(distance, maxDistance)
    
    if (distance > 0) {
      const angle = Math.atan2(dy, dx)
      const knobX = Math.cos(angle) * constrainedDistance
      const knobY = Math.sin(angle) * constrainedDistance
      
      knobRef.current.style.left = `${centerX + knobX - 15}px`
      knobRef.current.style.top = `${centerY + knobY - 15}px`
      
      // Only update angle if significant movement
      if (constrainedDistance > 10) {
        setGameState(prev => ({ ...prev, angle }))
      }
    }
  }

  const handleJoystickStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    updateJoystick(clientX, clientY)
  }

  const handleJoystickMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDragging) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    updateJoystick(clientX, clientY)
  }

  const handleJoystickEnd = () => {
    setIsDragging(false)
    if (knobRef.current && joystickRef.current) {
      const rect = joystickRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      knobRef.current.style.left = `${centerX - 15}px`
      knobRef.current.style.top = `${centerY - 15}px`
    }
  }

  // Show rotation prompt for mobile users
  if (isMobile && showRotationPrompt) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-2xl font-bold text-yellow-400">Rotate Your Device</h1>
          <p className="text-lg text-gray-300 max-w-md">
            Please rotate your device to landscape mode for the best gaming experience.
          </p>
          <div className="flex items-center justify-center space-x-4 text-4xl">
            <span>📱</span>
            <span className="text-yellow-400">→</span>
            <span className="transform rotate-90">📱</span>
          </div>
          <button
            onClick={() => setShowRotationPrompt(false)}
            className="mt-6 px-6 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen min-h-[100dvh] text-white relative overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundImage: 'url(https://i.postimg.cc/wxsFwXjh/backgroud-V3.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark Overlay */}
      <div className="fixed inset-0 z-0 bg-black/60 w-full h-full"></div>
      
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Connection Status - moved below mini-map */}
        <div className={`absolute top-64 left-4 z-20 space-y-2 ${isMobile ? 'top-4' : ''}`}>
          <p className="text-white font-medium">
            Players: {gameState.otherSnakes.filter(s => s.isAlive).length + (gameState.isAlive ? 1 : 0)}
          </p>
          <div className={`flex items-center gap-2 text-sm ${
            connectionStatus === 'connected' ? 'text-green-400' : 
            connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' : 
              connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`}></div>
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </div>
          {!gameState.isAlive && (
            <p className="text-red-400 font-bold text-lg">GAME OVER</p>
          )}
        </div>

        {/* Mini-map - moved to top left */}
        <div className={`absolute top-4 left-4 z-20 bg-black/70 rounded-lg p-2 ${isMobile ? 'hidden' : ''}`}>
          <div 
            className="relative bg-gray-800 rounded-full overflow-hidden"
            style={{ width: isMobile ? '150px' : '200px', height: isMobile ? '150px' : '200px' }}
          >
            <div className="absolute inset-1 bg-gray-700 rounded-full"></div>
            
            <div 
              className="absolute border-2 border-yellow-400 rounded-full"
              style={{
                left: `${(gameState.camera.x / ARENA_WIDTH) * (isMobile ? 148 : 198) + 1}px`,
                top: `${(gameState.camera.y / ARENA_HEIGHT) * (isMobile ? 148 : 198) + 1}px`,
                width: `${(viewportWidth / ARENA_WIDTH) * (isMobile ? 148 : 198)}px`,
                height: `${(viewportHeight / ARENA_HEIGHT) * (isMobile ? 148 : 198)}px`
              }}
            ></div>
            
            {gameState.mySnake.length > 0 && (
              <div 
                className="absolute w-2 h-2 bg-cyan-400 rounded-full"
                style={{
                  left: `${(gameState.mySnake[0].x / ARENA_WIDTH) * (isMobile ? 148 : 198) - 3}px`,
                  top: `${(gameState.mySnake[0].y / ARENA_HEIGHT) * (isMobile ? 148 : 198) - 3}px`
                }}
              ></div>
            )}
            
            {gameState.otherSnakes.map(snake => (
              snake.segments.length > 0 && snake.isAlive && (
                <div 
                  key={snake.playerId}
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: snake.color,
                    left: `${(snake.segments[0].x / ARENA_WIDTH) * (isMobile ? 148 : 198) - 2}px`,
                    top: `${(snake.segments[0].y / ARENA_HEIGHT) * (isMobile ? 148 : 198) - 2}px`
                  }}
                ></div>
              )
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className={`absolute top-4 right-4 z-20 bg-black/50 rounded-lg p-4 min-w-[200px] ${isMobile ? 'hidden' : ''}`}>
          <h3 className="text-white font-bold mb-2">Live Leaderboard</h3>
          <div className="space-y-1">
            {[...gameState.otherSnakes.filter(s => s.isAlive), 
              { 
                playerId, 
                username: username || 'You', 
                score: gameState.score, 
                isAlive: gameState.isAlive, 
                segments: gameState.mySnake, 
                color: gameState.snakeColor 
              }]
              .filter(s => s.isAlive)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map((snake, index) => (
                <div key={snake.playerId} className="flex justify-between text-sm">
                  <span className={snake.playerId === playerId ? 'text-yellow-400 font-bold' : 'text-white'}>
                    {index + 1}. {snake.username || 'Unknown Player'}
                  </span>
                  <span className="text-gray-300">{snake.score}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          width={viewportWidth}
          height={viewportHeight}
        />


        {/* Controls */}
        <div className={`absolute bottom-4 z-20 ${isMobile ? 'w-full px-4' : 'left-1/2 transform -translate-x-1/2'} flex items-center gap-6 ${isMobile ? 'justify-between' : 'justify-center'}`}>

          {isMobile ? (
            <>
              {/* Joystick - Bottom Left */}
              <div
                ref={joystickRef}
                className="relative bg-white/10 border-2 border-gray-600 rounded-full cursor-pointer select-none touch-none w-20 h-20"
                onTouchStart={handleJoystickStart}
                onTouchMove={handleJoystickMove}
                onTouchEnd={handleJoystickEnd}
              >
                <div
                  ref={knobRef}
                  className="absolute bg-cyan-400 rounded-full pointer-events-none w-6 h-6"
                  style={{ 
                    left: '28px', 
                    top: '28px',
                    transition: isDragging ? 'none' : 'all 0.2s ease-out'
                  }}
                />
              </div>

              {/* Mobile Controls - Bottom Right */}
              <div className="flex flex-col gap-2">
                {/* Boost Button */}
                <button
                  className={`font-bold rounded-lg text-white select-none transition-colors touch-none px-4 py-2 text-sm ${
                    gameState.boostActive 
                      ? 'bg-red-600 active:bg-red-700' 
                      : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                  }`}
                  onTouchStart={() => setGameState(prev => ({ ...prev, boostActive: true }))}
                  onTouchEnd={() => setGameState(prev => ({ ...prev, boostActive: false }))}
                  disabled={!gameState.isAlive}
                >
                  BOOST
                </button>
                
                {/* Cash Out Button */}
                <button
                  className={`font-bold rounded-lg text-white select-none transition-colors touch-none px-4 py-2 text-sm relative overflow-hidden ${
                    isCashingOut 
                      ? 'bg-yellow-600 active:bg-yellow-700' 
                      : 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700'
                  }`}
                  onTouchStart={() => {
                    if (!isCashingOut) {
                      setIsCashingOut(true)
                      setCashOutProgress(0)
                      
                      let progress = 0
                      cashOutTimerRef.current = setInterval(() => {
                        progress += 100 / 30
                        setCashOutProgress(progress)
                        
                        if (progress >= 100) {
                          if (cashOutTimerRef.current) {
                            clearInterval(cashOutTimerRef.current)
                            cashOutTimerRef.current = null
                          }
                          setIsCashingOut(false)
                          setCashOutProgress(0)
                          onGameEnd(gameStateRef.current.score)
                        }
                      }, 100)
                    }
                  }}
                  onTouchEnd={() => {
                    if (isCashingOut) {
                      if (cashOutTimerRef.current) {
                        clearInterval(cashOutTimerRef.current)
                        cashOutTimerRef.current = null
                      }
                      setIsCashingOut(false)
                      setCashOutProgress(0)
                    }
                  }}
                  disabled={!gameState.isAlive}
                >
                  {isCashingOut && (
                    <div 
                      className="absolute inset-0 bg-yellow-300/30 transition-all duration-100"
                      style={{ width: `${cashOutProgress}%` }}
                    />
                  )}
                  <span className="relative z-10">CASH OUT</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Desktop Controls */}
              <div className="flex items-center gap-4">
                {/* Boost indicator */}
                <div className={`font-bold rounded-lg text-white select-none px-6 py-3 text-center transition-colors ${
                  gameState.boostActive 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {gameState.boostActive ? 'BOOSTING!' : 'Hold K to BOOST'}
                </div>
                
                {/* Cash out indicator */}
                <div className={`font-bold rounded-lg text-white select-none px-6 py-3 text-center transition-colors relative overflow-hidden ${
                  isCashingOut 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {isCashingOut && (
                    <div 
                      className="absolute inset-0 bg-yellow-300/30 transition-all duration-100"
                      style={{ width: `${cashOutProgress}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {isCashingOut ? `CASHING OUT... ${Math.floor(cashOutProgress)}%` : 'Hold Q to CASH OUT'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}