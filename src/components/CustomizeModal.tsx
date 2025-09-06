import React, { useState, useRef, useEffect } from 'react'
import { X, Shirt, Package, ShoppingCart, Crown, Zap, Shuffle, Lock, ChevronRight } from 'lucide-react'
import { useSound } from '../utils/soundManager'

interface CustomizeModalProps {
  isOpen: boolean
  onClose: () => void
  currentColor: string
  onColorChange: (color: string) => void
}

const predefinedColors = [
  '#66d9ff', // Blue (default)
  '#ff6b47', // Orange
  '#feca57', // Yellow
  '#00d084', // Green
  '#6c5ce7'  // Purple
]

const lockedSkins = [
  { name: 'Blue Skin', color: '#333333', locked: true },
  { name: 'Cyan Skin', color: '#333333', locked: true },
  { name: 'Green Skin', color: '#333333', locked: true },
  { name: 'Pink Skin', color: '#333333', locked: true },
  { name: 'Purple Skin', color: '#333333', locked: true },
  { name: 'Red Skin', color: '#333333', locked: true },
  { name: 'Yellow Skin', color: '#333333', locked: true }
]

export function CustomizeModal({ isOpen, onClose, currentColor, onColorChange }: CustomizeModalProps) {
  const [mainTab, setMainTab] = useState<'inventory' | 'shop'>('inventory')
  const [subTab, setSubTab] = useState<'skins' | 'hats' | 'boosts'>('skins')
  const [selectedSkin, setSelectedSkin] = useState<'random' | string>(() => {
    // Load saved selection from localStorage or use current color
    const savedSelection = localStorage.getItem('selectedSkin');
    return savedSelection || currentColor;
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const { playButtonClick, playTabClick } = useSound()

  // Save selected skin to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('selectedSkin', selectedSkin);
  }, [selectedSkin])

  // Slither.io style snake preview with animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0
    
    const animate = () => {
      // Clear canvas with subtle background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      time += 0.02
      
      // Snake setup for preview - adjusted for mobile
      const isMobile = canvas.width < 500
      // Use exact game values for realistic preview
      const segments = 8 // Smaller snake for preview
      const segmentSize = 30 // Smaller segments for preview
      const segmentSpacing = 2 // Slightly more spacing for smoother look
      
      // Animated snake movement
      const snake = []
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const waveAmplitude = 8 // Smaller wave for smoother movement
      const waveFrequency = 0.15 // Slower frequency for less jerky movement
      
      for (let i = 0; i < segments; i++) {
        const baseX = centerX - i * (segmentSpacing + 8) // More spacing between segments
        const waveOffset = Math.sin(time + i * waveFrequency) * waveAmplitude * (1 - i / segments)
        
        snake.push({
          x: baseX + Math.cos(time * 0.3) * 15, // Slower horizontal movement
          y: centerY + waveOffset + Math.sin(time * 0.2) * 8 // Slower vertical movement
        })
      }
      
      // Enhanced rendering with glow effects
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      // Remove shadows for flat style
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // Draw segments with enhanced visuals
      for (let i = 0; i < snake.length; i++) {
        const seg = snake[i]
        const brightness = 1.3 - (i / snake.length) * 0.3
        const segmentRadius = segmentSize / 2 // Consistent size for all segments
        
        // EXACT MATCH: Flat color body with soft outline - like HTML
        ctx.fillStyle = currentColor === 'random' ? getRandomColor() : currentColor
        ctx.strokeStyle = getDarkerShade(currentColor === 'random' ? getRandomColor() : currentColor)
        ctx.lineWidth = 0.4 // Exact match from HTML
        
        ctx.beginPath()
        ctx.arc(seg.x, seg.y, segmentRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      
      // Draw eyes exactly like HTML example
      if (snake.length > 0) {
        const head = snake[0]
        const eyeOffset = 10 // Exact match from HTML
        const eyeRadius = 8 // Exact match from HTML
        const pupilRadius = 4 // Exact match from HTML
        const pupilMove = 2 // Exact match from HTML
        
        const headAngle = Math.atan2(
          snake.length > 1 ? head.y - snake[1].y : Math.sin(time),
          snake.length > 1 ? head.x - snake[1].x : Math.cos(time)
        )
        
        // EXACT MATCH: Eye positioning from HTML
        const leftEye = {
          x: head.x + Math.sin(headAngle) * eyeOffset,
          y: head.y - Math.cos(headAngle) * eyeOffset
        }
        const rightEye = {
          x: head.x - Math.sin(headAngle) * eyeOffset,
          y: head.y + Math.cos(headAngle) * eyeOffset
        }
        
        // EXACT MATCH: Simple white eyes from HTML
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2)
        ctx.fill()
        
        // EXACT MATCH: Pupil positioning and movement from HTML
        const leftPupil = {
          x: leftEye.x + Math.cos(headAngle) * pupilMove,
          y: leftEye.y + Math.sin(headAngle) * pupilMove
        }
        const rightPupil = {
          x: rightEye.x + Math.cos(headAngle) * pupilMove,
          y: rightEye.y + Math.sin(headAngle) * pupilMove
        }
        
        // EXACT MATCH: Simple black pupils from HTML
        ctx.fillStyle = 'black'
        ctx.beginPath()
        ctx.arc(leftPupil.x, leftPupil.y, pupilRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(rightPupil.x, rightPupil.y, pupilRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      
      ctx.restore()
      
      animationId = requestAnimationFrame(animate)
    }
    
    // Start animation
    animate()
    
    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [currentColor])

  // Helper function for random color cycling
  const getRandomColor = () => {
    const colorIndex = Math.floor(Date.now() / 1000) % predefinedColors.length
    return predefinedColors[colorIndex]
  }

  // Helper function to get darker shade - exact match from HTML
  const getDarkerShade = (color: string): string => {
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
      
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }
    
    return color
  }

  const adjustColorBrightness = (hex: string, factor: number): string => {
    // Handle both hex and rgb formats
    if (hex.startsWith('rgb')) {
      const match = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (match) {
        const r = Math.min(255, Math.max(0, Math.floor(parseInt(match[1]) * factor)))
        const g = Math.min(255, Math.max(0, Math.floor(parseInt(match[2]) * factor)))
        const b = Math.min(255, Math.max(0, Math.floor(parseInt(match[3]) * factor)))
        return `rgb(${r}, ${g}, ${b})`
      }
    }
    
    const cleanHex = hex.replace('#', '')
    const r = parseInt(cleanHex.substr(0, 2), 16)
    const g = parseInt(cleanHex.substr(2, 2), 16)
    const b = parseInt(cleanHex.substr(4, 2), 16)
    const newR = Math.min(255, Math.max(0, Math.floor(r * factor)))
    const newG = Math.min(255, Math.max(0, Math.floor(g * factor)))
    const newB = Math.min(255, Math.max(0, Math.floor(b * factor)))
    return `rgb(${newR}, ${newG}, ${newB})`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative max-w-4xl w-full h-[90vh] sm:h-[80vh] max-h-[90vh] sm:max-h-[80vh] flex flex-col bg-background/95 backdrop-blur border-2 border-border/40 rounded-lg p-3 sm:p-6">
        {/* Header */}
        <div className="flex flex-col space-y-1.5 text-center sm:text-left flex-shrink-0 pb-3 sm:pb-4 bg-gradient-to-r from-yellow-400/10 to-gold/10 -m-3 sm:-m-6 mb-0 p-3 sm:p-6 rounded-t-lg border-b border-yellow-400/20">
          <h2 className="text-base sm:text-lg font-semibold leading-none tracking-tight flex items-center justify-center sm:justify-start gap-2 text-yellow-400">
            <Shirt className="h-5 w-5" />
            Customize Appearance
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden pt-2 sm:pt-4">
          <div className="h-full flex flex-col">
            {/* Main Tabs */}
            <div className="items-center justify-center gap-1 sm:gap-2 p-0 bg-transparent grid w-full grid-cols-2 flex-shrink-0 mb-2 sm:mb-4">
              <button
                onClick={() => setMainTab('inventory')}
                onMouseDown={playTabClick}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-2 sm:px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  mainTab === 'inventory' ? 'bg-yellow-400 text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                }`}
              >
                <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Inventory
              </button>
              <button
                onClick={() => setMainTab('shop')}
                onMouseDown={playTabClick}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-2 sm:px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  mainTab === 'shop' ? 'bg-yellow-400 text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                }`}
              >
                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Shop
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden mt-2 sm:mt-4">
              {mainTab === 'inventory' && (
                <div className="h-full flex flex-col">
                  {/* Snake Preview */}
                  <div className="flex-shrink-0 mb-2 sm:mb-4">
                    <div className="h-24 sm:h-36 bg-gradient-to-br from-yellow-400/5 to-yellow-600/10 border border-yellow-400/20 rounded-lg overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/5 to-transparent"></div>
                      <canvas 
                        ref={canvasRef}
                        className="w-full h-full relative z-10"
                        width={400}
                        height={120}
                      />
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-2 sm:gap-4">
                    {/* Left Side - Items Grid */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      {/* Sub Tabs */}
                      <div className="items-center justify-center gap-1 sm:gap-2 p-0 bg-transparent grid w-full grid-cols-3 flex-shrink-0 mb-2 sm:mb-4">
                        <button
                          onClick={() => setSubTab('skins')}
                          onMouseDown={playTabClick}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-2 sm:px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                            subTab === 'skins' ? '!bg-yellow-400 !text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                          }`}
                        >
                          <Shirt className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Skins
                        </button>
                        <button
                          onClick={() => setSubTab('hats')}
                          onMouseDown={playTabClick}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-2 sm:px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                            subTab === 'hats' ? '!bg-yellow-400 !text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                          }`}
                        >
                          <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Hats
                        </button>
                        <button
                          onClick={() => setSubTab('boosts')}
                          onMouseDown={playTabClick}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-2 sm:px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                            subTab === 'boosts' ? '!bg-yellow-400 !text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                          }`}
                        >
                          <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Boosts
                        </button>
                      </div>

                      {/* Items Grid */}
                      <div className="flex-1 overflow-hidden">
                        {subTab === 'skins' && (
                          <div className="h-full overflow-y-auto">
                            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-8 gap-1 sm:gap-2 p-1">
                              {/* Random Option */}
                              <div
                                onClick={() => setSelectedSkin('random')}
                                className={`aspect-square transition-all rounded-md sm:rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer hover:ring-gold/50 touch-manipulation hover:scale-105 ${
                                  selectedSkin === 'random' ? 'ring-2 ring-yellow-400 scale-105' : 'ring-1 ring-border/20'
                                }`}
                                style={{
                                  backgroundColor: selectedSkin === 'random' 
                                    ? '#9333ea'
                                    : selectedSkin,
                                  border: selectedSkin === 'random' 
                                    ? '1px solid #7c3aed'
                                    : `1px solid ${adjustColorBrightness(selectedSkin, 0.7)}`
                                }}
                              >
                                <Shuffle className="w-4 h-4 sm:w-6 sm:h-6 text-purple-300" />
                              </div>

                              {/* Color Options */}
                              {predefinedColors.map((color, index) => (
                                <div
                                  key={index}
                                  onClick={() => {
                                    playButtonClick()
                                    setSelectedSkin(color)
                                    onColorChange(color)
                                  }}
                                  className={`aspect-square transition-all rounded-md sm:rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer hover:ring-gold/50 touch-manipulation hover:scale-105 ${
                                    selectedSkin === color ? 'ring-2 ring-yellow-400 scale-105' : 'ring-1 ring-border/20'
                                  }`}
                                  style={{ 
                                    backgroundColor: color, // Flat color instead of gradient
                                    border: `1px solid ${adjustColorBrightness(color, 0.7)}` // Subtle border
                                  }}
                                >
                                  {selectedSkin === color && (
                                    <div className="absolute inset-0 bg-white/10 rounded-md sm:rounded-lg"></div>
                                  )}
                                </div>
                              ))}

                              {/* Locked Skins */}
                              {lockedSkins.map((skin, index) => (
                                <div
                                  key={index}
                                  className="aspect-square transition-all ring-1 ring-border/20 rounded-md sm:rounded-lg flex items-center justify-center relative overflow-hidden cursor-not-allowed opacity-50 grayscale hover:opacity-60"
                                  style={{ backgroundColor: skin.color }}
                                >
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                    <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-lg" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {subTab === 'hats' && (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                              <Crown className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-4 opacity-50" />
                              <p className="text-sm sm:text-base">No hats available yet!</p>
                            </div>
                          </div>
                        )}

                        {subTab === 'boosts' && (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                              <Zap className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-4 opacity-50" />
                              <p className="text-sm sm:text-base">No boosts available yet!</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Sidebar - Item Details */}
                    <div className={`transition-all duration-300 relative hidden lg:block ${sidebarCollapsed ? 'w-8' : 'w-64'}`}>
                      <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        onMouseDown={playButtonClick}
                        className="absolute left-0 top-0 h-8 w-8 bg-background/80 backdrop-blur-sm border border-border/40 rounded-l-lg flex items-center justify-center hover:bg-background/90 transition-colors z-10"
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
                      </button>

                      <div className={`transition-opacity duration-300 bg-gradient-to-b from-background/60 to-background/40 backdrop-blur-sm border border-border/40 rounded-lg h-full ml-8 flex flex-col ${
                        sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                      }`}>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                          <div className="space-y-6">
                            {/* Selected Item Preview */}
                            <div className="text-center">
                              <div className="relative mx-auto mb-4">
                                <div 
                                  className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-xl flex items-center justify-center mb-3 border-2 border-border/30 shadow-lg relative overflow-hidden"
                                  style={{ 
                                    background: selectedSkin === 'random' 
                                      ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)'
                                      : `linear-gradient(135deg, ${selectedSkin} 0%, ${adjustColorBrightness(selectedSkin, 0.8)} 100%)`,
                                    boxShadow: selectedSkin === 'random' 
                                      ? 'rgba(147, 51, 234, 0.3) 0px 0px 20px'
                                      : `${selectedSkin}40 0px 0px 20px`
                                  }}
                                >
                                  {selectedSkin === 'random' && (
                                    <Shuffle className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300 relative z-10" />
                                  )}
                                </div>
                              </div>
                              <h4 className="text-sm sm:text-base font-bold text-foreground mb-1">
                                {selectedSkin === 'random' ? 'Random' : 'Custom Color'}
                              </h4>
                              <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                                <span className="text-xs font-medium text-green-400">Equipped</span>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wide mb-2 sm:mb-3">Details</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 rounded-lg bg-background/30 border border-border/20">
                                  <span className="text-xs font-medium text-muted-foreground">Type</span>
                                  <span className="text-xs font-bold text-foreground capitalize">
                                    {selectedSkin === 'random' ? 'random' : 'color'}
                                  </span>
                                </div>
                              </div>

                              {selectedSkin === 'random' && (
                                <div className="mt-4 p-3 bg-gradient-to-r from-yellow-400/10 to-yellow-600/10 border border-yellow-400/20 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <Shuffle className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-medium text-yellow-300 mb-1">Random Mode</p>
                                      <p className="text-xs text-yellow-200/80 leading-relaxed hidden sm:block">
                                        Your snake will display a random color from your available skins each time you play. This adds variety and excitement!
                                      </p>
                                      <p className="text-xs text-yellow-200/80 leading-relaxed sm:hidden">
                                        Random color each game!
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Item Details - Bottom Sheet Style */}
                    <div className="lg:hidden">
                      {selectedSkin && (
                        <div className="mt-4 p-3 bg-gradient-to-b from-background/60 to-background/40 backdrop-blur-sm border border-border/40 rounded-lg">
                          <div className="text-center mb-3">
                            <div 
                              className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-2 border border-border/30 shadow-lg relative overflow-hidden"
                              style={{ 
                                backgroundColor: selectedSkin === 'random' 
                                  ? '#9333ea'
                                  : selectedSkin,
                                border: selectedSkin === 'random' 
                                  ? '1px solid #7c3aed'
                                  : `1px solid ${adjustColorBrightness(selectedSkin, 0.7)}`
                              }}
                            >
                              {selectedSkin === 'random' && (
                                <Shuffle className="w-6 h-6 text-purple-300 relative z-10" />
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-foreground mb-1">
                              {selectedSkin === 'random' ? 'Random' : 'Custom Color'}
                            </h4>
                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                              <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                              <span className="text-xs font-medium text-green-400">Equipped</span>
                            </div>
                          </div>
                          
                          {selectedSkin === 'random' && (
                            <div className="p-2 bg-gradient-to-r from-yellow-400/10 to-yellow-600/10 border border-yellow-400/20 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Shuffle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                                <p className="text-xs text-yellow-200/80">Random color each game!</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mainTab === 'shop' && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 opacity-50" />
                    <h3 className="text-base sm:text-lg font-bold mb-2">Shop Coming Soon!</h3>
                    <p className="text-sm sm:text-base px-4">Purchase new skins, hats, and boosts to customize your snake.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-2 sm:right-4 top-2 sm:top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-1 touch-manipulation"
        >
          <X className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
}
