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
  '#ff6b6b', '#45b7d1', '#feca57', '#ff9ff3', 
  '#5f27cd', '#00d2d3', '#10ac84', '#ee5a24', '#0984e3'
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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Snake setup for preview - adjusted for mobile
    const isMobile = canvas.width < 500
    const segments = isMobile ? 6 : 10
    const segmentSize = isMobile ? 20 : 30
    const segmentSpacing = 6
    const lerpFactor = 0.2
    
    // Initialize snake segments
    const snake = []
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    for (let i = 0; i < segments; i++) {
      snake.push({
        x: centerX - i * (segmentSpacing + 5),
        y: centerY
      })
    }
    
    // Static render function
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw snake with Slither.io style
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 6
      
      // Draw segments
      for (let i = 0; i < snake.length; i++) {
        const seg = snake[i]
        const brightness = 1.2 - (i / snake.length) * 0.2
        
        // Create radial gradient for 3D effect
        const grad = ctx.createRadialGradient(seg.x, seg.y, 2, seg.x, seg.y, segmentSize / 2)
        grad.addColorStop(0, adjustColorBrightness(currentColor, brightness))
        grad.addColorStop(0.5, currentColor)
        grad.addColorStop(1, adjustColorBrightness(currentColor, 0.9))
        
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(seg.x, seg.y, segmentSize / 2, 0, Math.PI * 2)
        ctx.fill()
        
        // Add subtle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(seg.x, seg.y, segmentSize / 2 - 2, 0, Math.PI * 2)
        ctx.stroke()
      }
      
      // Draw eyes on head
      const headSeg = snake[0]
      const eyeOffset = isMobile ? 6 : 10
      const eyeRadius = isMobile ? 5 : 8
      const pupilRadius = 4
      const pupilMove = 3
      
      // Eye positions like in the game
      const leftEye = {
        x: headSeg.x + Math.sin(0) * eyeOffset,
        y: headSeg.y - Math.cos(0) * eyeOffset
      }
      const rightEye = {
        x: headSeg.x - Math.sin(0) * eyeOffset,
        y: headSeg.y + Math.cos(0) * eyeOffset
      }
      
      // Draw eye whites
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw pupils with slight forward direction
      const pupilPos = (eye: { x: number; y: number }) => {
        const dx = Math.cos(0) * pupilMove
        const dy = Math.sin(0) * pupilMove
        const dist = Math.sqrt(dx * dx + dy * dy)
        const scale = Math.min(1, (eyeRadius - pupilRadius) / dist)
        return { x: eye.x + dx * scale, y: eye.y + dy * scale }
      }

      const leftPupil = pupilPos(leftEye)
      const rightPupil = pupilPos(rightEye)
      
      ctx.fillStyle = 'black'
      ctx.beginPath()
      ctx.arc(leftPupil.x, leftPupil.y, pupilRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(rightPupil.x, rightPupil.y, pupilRadius, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.beginPath()
      ctx.arc(leftPupil.x + 1, leftPupil.y + 1, 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(rightPupil.x + 1, rightPupil.y + 1, 1.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()
    }
    
    // Render once
    render()
  }, [currentColor])

  const adjustColorBrightness = (hex: string, factor: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return hex
    
    const r = Math.min(255, Math.floor(parseInt(result[1], 16) * factor))
    const g = Math.min(255, Math.floor(parseInt(result[2], 16) * factor))
    const b = Math.min(255, Math.floor(parseInt(result[3], 16) * factor))
    
    return `rgb(${r}, ${g}, ${b})`
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
                    <div className="h-20 sm:h-32 bg-gradient-to-br from-yellow-400/5 to-yellow-600/10 border border-yellow-400/20 rounded-lg overflow-hidden">
                      <canvas 
                        ref={canvasRef}
                        className="w-full h-full"
                        width={400}
                        height={80}
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
                               onMouseDown={playButtonClick}
                                className={`aspect-square transition-all rounded-md sm:rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer hover:ring-gold/50 touch-manipulation ${
                                  selectedSkin === 'random' ? 'ring-2 ring-yellow-400' : 'ring-1 ring-border/20'
                                }`}
                                style={{ backgroundColor: 'transparent' }}
                              >
                                <Shuffle className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" />
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
                                  className={`aspect-square transition-all rounded-md sm:rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer hover:ring-gold/50 touch-manipulation ${
                                    selectedSkin === color ? 'ring-2 ring-yellow-400' : 'ring-1 ring-border/20'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}

                              {/* Locked Skins */}
                              {lockedSkins.map((skin, index) => (
                                <div
                                  key={index}
                                  className="aspect-square transition-all ring-1 ring-border/20 rounded-md sm:rounded-lg flex items-center justify-center relative overflow-hidden cursor-not-allowed opacity-50 grayscale"
                                  style={{ backgroundColor: skin.color }}
                                >
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
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
                                    backgroundColor: selectedSkin === 'random' ? 'transparent' : selectedSkin,
                                    boxShadow: 'rgba(255, 255, 255, 0.1) 0px 0px 20px'
                                  }}
                                >
                                  {selectedSkin === 'random' && (
                                    <>
                                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl"></div>
                                      <Shuffle className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground relative z-10" />
                                    </>
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
                                backgroundColor: selectedSkin === 'random' ? 'transparent' : selectedSkin,
                              }}
                            >
                              {selectedSkin === 'random' && (
                                <>
                                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg"></div>
                                  <Shuffle className="w-6 h-6 text-muted-foreground relative z-10" />
                                </>
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