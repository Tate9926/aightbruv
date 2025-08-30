import React, { useState, useEffect } from 'react'
import { X, User, Gamepad2, FileText, Calendar, Flame, Wallet, Copy, Save, LogOut, Volume2, Eye, Zap, Palette, ChevronDown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSound, soundManager } from '../utils/soundManager'
import { supabase } from '../lib/supabase'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UserWallet {
  ethereum_address: string
  tron_address: string
  solana_address: string
}
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'game' | 'legal'>('account')
  const [username, setUsername] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null)
  const [loading, setLoading] = useState(false)
  const [walletLoading, setWalletLoading] = useState(false)
  const { user, signOut } = useAuth()
  const { playButtonClick, playTabClick, playToggleClick, playSuccessSound } = useSound()
  
  // Audio settings state
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [masterVolume, setMasterVolume] = useState(100)
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(100)
  const [musicVolume, setMusicVolume] = useState(100)

  // Update sound manager when settings change
  useEffect(() => {
    soundManager.setEnabled(audioEnabled)
    soundManager.setMasterVolume(masterVolume)
    soundManager.setSoundEffectsVolume(soundEffectsVolume)
  }, [audioEnabled, masterVolume, soundEffectsVolume])

  useEffect(() => {
    if (user && isOpen) {
      fetchUserProfile()
      fetchUserWallet()
    }
  }, [user, isOpen])

  const fetchUserProfile = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setUserProfile(data)
        setUsername(data.username)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchUserWallet = async () => {
    if (!user) return
    
    setWalletLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('get_user_crypto_addresses', { 
          target_user_id: user.id
        })
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user wallet:', error)
        return
      }

      if (data) {
        setUserWallet(data)
      }
    } catch (error) {
      console.error('Error fetching user wallet:', error)
    } finally {
      setWalletLoading(false)
    }
  }
  const handleUpdateUsername = async () => {
    if (!user || !username.trim()) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', user.id)

      if (!error) {
        setUserProfile({ ...userProfile, username: username.trim() })
        playSuccessSound()
        // You could add a success toast here
      }
    } catch (error) {
      console.error('Error updating username:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    onClose()
  }

  const copyWalletAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    playSuccessSound()
  }

  const formatAddress = (address: string) => {
    if (!address || address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const calculateDaysSinceJoined = (joinDate: string) => {
    const joined = new Date(joinDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - joined.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 sm:rounded-lg max-w-4xl h-[80vh] bg-background/95 backdrop-blur-sm border-border/40">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="tracking-tight text-2xl font-bold text-yellow-400">Settings</h2>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Tabs */}
            <div className="items-center justify-center gap-2 p-0 bg-transparent grid w-full grid-cols-3 flex-shrink-0">
              <button
                onClick={() => {
                  playTabClick()
                  setActiveTab('account')
                }}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'account' ? '!bg-yellow-400 !text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : ''
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                Account
              </button>
              <button
                onClick={() => {
                  playTabClick()
                  setActiveTab('game')
                }}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'game' ? '!bg-yellow-400 !text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : ''
                }`}
              >
                <Gamepad2 className="h-4 w-4 mr-2" />
                Game
              </button>
              <button
                onClick={() => {
                  playTabClick()
                  setActiveTab('legal')
                }}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 text-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'legal' ? '!bg-yellow-400 !text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : ''
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Legal
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden mt-4">
              {activeTab === 'account' && (
                <div className="h-full overflow-y-auto">
                  <div className="space-y-6 pr-4">
                    {/* Username Section */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground">Username</h3>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="flex gap-2">
                          <input
                            placeholder="Enter your username"
                            className="flex-1 px-4 py-2 bg-background/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 border-border/40"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                          />
                          <button
                            onClick={handleUpdateUsername}
                            disabled={loading}
                            onMouseDown={playButtonClick}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-[0_4px_0_#15803D] hover:shadow-[0_2px_0_#15803D] active:shadow-[0_1px_0_#15803D] hover:translate-y-[2px] active:translate-y-[3px] h-10 px-4 py-2"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? 'Updating...' : 'Update'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Wallet Information */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground">Wallet Information</h3>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        {walletLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                          </div>
                        ) : userWallet ? (
                          <div className="space-y-3">
                            {/* Ethereum Address */}
                            <div className="flex items-center gap-2 bg-background/50 border border-border/40 rounded-lg px-3 py-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                ETH
                              </div>
                              <span className="text-sm font-mono flex-1">{formatAddress(userWallet.ethereum_address)}</span>
                              <button
                                onClick={() => copyWalletAddress(userWallet.ethereum_address)}
                                onMouseDown={playButtonClick}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] text-xs h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Tron Address */}
                            <div className="flex items-center gap-2 bg-background/50 border border-border/40 rounded-lg px-3 py-2">
                              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                                TRX
                              </div>
                              <span className="text-sm font-mono flex-1">{formatAddress(userWallet.tron_address)}</span>
                              <button
                                onClick={() => copyWalletAddress(userWallet.tron_address)}
                                onMouseDown={playButtonClick}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] text-xs h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Solana Address */}
                            <div className="flex items-center gap-2 bg-background/50 border border-border/40 rounded-lg px-3 py-2">
                              <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                SOL
                              </div>
                              <span className="text-sm font-mono flex-1">{formatAddress(userWallet.solana_address)}</span>
                              <button
                                onClick={() => copyWalletAddress(userWallet.solana_address)}
                                onMouseDown={playButtonClick}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] text-xs h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No wallet addresses assigned</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Account Information */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground">Account Information</h3>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Member Since</p>
                              <p className="font-medium">
                                {userProfile?.created_at ? formatDate(userProfile.created_at) : 'August 15, 2025'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Flame className="h-5 w-5 text-orange-400" />
                            <div>
                              <p className="text-sm text-muted-foreground">Login Streak</p>
                              <p className="font-medium">
                                {userProfile?.created_at ? calculateDaysSinceJoined(userProfile.created_at) : 0} days
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Account Actions */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground">Account Actions</h3>
                      </div>
                      <div className="p-6 pt-0">
                        <button
                          onClick={handleLogout}
                          onMouseDown={playButtonClick}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-[0_4px_0_#B91C1C] hover:shadow-[0_2px_0_#B91C1C] active:shadow-[0_1px_0_#B91C1C] hover:translate-y-[2px] active:translate-y-[3px] h-10 px-4 py-2 w-full"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'game' && (
                <div className="h-full overflow-y-auto">
                  <div className="space-y-6 pr-4">
                    {/* Game Settings Header */}
                    <div className="rounded-lg border-2 bg-card text-card-foreground bg-gradient-to-r from-gold/10 to-yellow-500/10 border-gold/30">
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <Gamepad2 className="h-6 w-6 text-yellow-400" />
                          <div>
                            <h3 className="font-semibold text-yellow-400">Game Settings</h3>
                            <p className="text-sm text-muted-foreground">Audio settings are now available! Other features are still in development.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Audio Settings - Active */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold tracking-tight text-lg text-foreground flex items-center gap-2">
                            <Volume2 className="h-5 w-5" />
                            Audio Settings
                          </h3>
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-primary-foreground hover:bg-primary/80 text-xs bg-green-600">
                            Active
                          </div>
                        </div>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        {/* Enable Audio Toggle */}
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-sm font-medium">Enable Audio</label>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={audioEnabled}
                            onClick={() => {
                              playToggleClick()
                              setAudioEnabled(!audioEnabled)
                            }}
                            className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                              audioEnabled ? 'bg-white' : 'bg-gray-600'
                            }`}
                          >
                            <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                              audioEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}></span>
                          </button>
                        </div>

                        {/* Master Volume */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Master Volume</label>
                            <span className="text-sm text-muted-foreground">{masterVolume}%</span>
                          </div>
                          <div className="relative flex items-center w-full">
                            <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-600">
                              <div 
                                className="absolute h-full bg-white transition-all duration-200" 
                                style={{ width: `${masterVolume}%` }}
                              ></div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={masterVolume}
                              onChange={(e) => {
                                setMasterVolume(parseInt(e.target.value))
                              }}
                              onMouseDown={playButtonClick}
                              className="absolute w-full h-2 opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Sound Effects Volume */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Sound Effects</label>
                            <span className="text-sm text-muted-foreground">{soundEffectsVolume}%</span>
                          </div>
                          <div className="relative flex items-center w-full">
                            <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-600">
                              <div 
                                className="absolute h-full bg-white transition-all duration-200" 
                                style={{ width: `${soundEffectsVolume}%` }}
                              ></div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={soundEffectsVolume}
                              onChange={(e) => {
                                setSoundEffectsVolume(parseInt(e.target.value))
                              }}
                              onMouseDown={playButtonClick}
                              className="absolute w-full h-2 opacity-0 cursor-pointer"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Controls button clicks, hover sounds, and UI audio</p>
                        </div>

                        {/* Music Volume */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Music Volume</label>
                            <span className="text-sm text-muted-foreground">{musicVolume}%</span>
                          </div>
                          <div className="relative flex items-center w-full">
                            <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-600">
                              <div 
                                className="absolute h-full bg-white transition-all duration-200" 
                                style={{ width: `${musicVolume}%` }}
                              ></div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={musicVolume}
                              onChange={(e) => {
                                setMusicVolume(parseInt(e.target.value))
                              }}
                              onMouseDown={playButtonClick}
                              className="absolute w-full h-2 opacity-0 cursor-pointer"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Background music (when available)</p>
                        </div>
                      </div>
                    </div>

                    {/* Visual Settings - Coming Soon */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40 opacity-60">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold tracking-tight text-lg text-foreground flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Visual Settings
                          </h3>
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs">
                            Coming Soon
                          </div>
                        </div>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Graphics Quality</label>
                          <button
                            type="button"
                            disabled
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>High</span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Show FPS Counter</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gray-600"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-0"></span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Smooth Camera</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-white"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-5"></span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Screen Shake</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-white"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-5"></span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Performance Settings - Coming Soon */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40 opacity-60">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold tracking-tight text-lg text-foreground flex items-center gap-2">
                            <Zap className="h-5 w-5" />
                            Performance Settings
                          </h3>
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs">
                            Coming Soon
                          </div>
                        </div>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Frame Rate Limit</label>
                          <button
                            type="button"
                            disabled
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>60 FPS</span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">V-Sync</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gray-600"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-0"></span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Reduce Motion</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gray-600"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-0"></span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Gameplay Settings - Coming Soon */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40 opacity-60">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold tracking-tight text-lg text-foreground flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Gameplay Settings
                          </h3>
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs">
                            Coming Soon
                          </div>
                        </div>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Mouse Sensitivity</label>
                            <span className="text-sm text-muted-foreground">50%</span>
                          </div>
                          <div className="relative flex items-center w-full">
                            <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-600">
                              <div className="absolute h-full bg-white" style={{ width: '50%' }}></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Auto-Zoom</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-white"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-5"></span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Show Grid</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gray-600"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-0"></span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Show Player Names</label>
                          <button
                            type="button"
                            disabled
                            className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-white"
                          >
                            <span className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-5"></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'legal' && (
                <div className="h-full overflow-y-auto">
                  <div className="space-y-6 pr-4">
                    {/* Legal Documents */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Legal Documents
                        </h3>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-3">
                          <button 
                            onMouseDown={playButtonClick}
                            className="inline-flex items-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-10 px-4 py-2 w-full justify-between">
                            <span>Privacy Policy</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link h-4 w-4">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" x2="21" y1="14" y2="3"></line>
                            </svg>
                          </button>
                          <button 
                            onMouseDown={playButtonClick}
                            className="inline-flex items-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-10 px-4 py-2 w-full justify-between">
                            <span>Terms & Conditions</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link h-4 w-4">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" x2="21" y1="14" y2="3"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail h-5 w-5">
                            <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                          </svg>
                          Contact Information
                        </h3>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Email Support</label>
                            <div className="flex items-center gap-2 bg-background/50 border border-border/40 rounded-lg px-3 py-2 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail h-4 w-4 text-muted-foreground">
                                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                              </svg>
                              <span className="text-sm flex-1 font-mono">playdamnbruh@gmail.com</span>
                              <button 
                                onClick={() => navigator.clipboard.writeText('playdamnbruh@gmail.com')}
                                onMouseDown={playButtonClick}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] text-xs h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Community</label>
                            <button 
                              onMouseDown={playButtonClick}
                              className="inline-flex items-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white shadow-[0_4px_0_#3C45A5] hover:shadow-[0_2px_0_#3C45A5] active:shadow-[0_1px_0_#3C45A5] hover:translate-y-[2px] active:translate-y-[3px] h-10 px-4 py-2 w-full justify-between mt-1">
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle h-4 w-4">
                                  <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                                </svg>
                                <span>Join our Discord</span>
                              </div>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link h-4 w-4">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" x2="21" y1="14" y2="3"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
                    <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                      <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold tracking-tight text-lg text-foreground">Additional Information</h3>
                      </div>
                      <div className="p-6 pt-0 space-y-4">
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p><strong>Game Support:</strong> For technical issues, gameplay questions, or account problems, please contact us via email or Discord.</p>
                          <p><strong>Business Inquiries:</strong> For partnerships, sponsorships, or other business-related matters, please use the email contact above.</p>
                          <p><strong>Community Guidelines:</strong> Please review our Terms & Conditions and follow our community guidelines when participating in the game and Discord server.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          onMouseDown={playButtonClick}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
}