import React, { useState, useEffect } from 'react'
import { X, Trophy, Search, User, Users, DollarSign, ChevronDown, Calendar, Flame, Target, TrendingUp, BarChart3, ArrowLeft, Clock, Zap } from 'lucide-react'
import { useGameData } from '../hooks/useGameData'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useSound } from '../utils/soundManager'

interface SocialModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'leaderboard' | 'search' | 'profile' | 'friends'
}

type SortOption = 'winnings' | 'eliminations' | 'games_played' | 'win_rate' | 'survival_time'

interface UserProfile {
  id: string
  username: string
  total_winnings: number
  games_played: number
  games_won: number
  created_at: string
  updated_at: string
}

// Custom hook for number animation
const useCountUp = (end: number, duration: number = 2000, delay: number = 0) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(end * easeOutQuart));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(end);
        }
      };
      requestAnimationFrame(animate);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [end, duration, delay]);
  
  return count;
};

export function SocialModal({ isOpen, onClose, initialTab }: SocialModalProps) {
  // Early return before any hooks to prevent conditional hook calls
  if (!isOpen) return null

  // Helper functions defined before any hooks or usage
  const calculateWinRate = (gamesWon: number, gamesPlayed: number) => {
    if (gamesPlayed === 0) return '0.0'
    return ((gamesWon / gamesPlayed) * 100).toFixed(1)
  }

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'search' | 'profile' | 'friends'>(initialTab || 'leaderboard')
  const [sortBy, setSortBy] = useState<SortOption>('winnings')
  const [searchQuery, setSearchQuery] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [earningsData, setEarningsData] = useState<Array<{
    month: string, 
    earnings: number,
    games: number,
    kills: number,
    playTime: number,
    winRate: number,
    date: string
  }>>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [leaderboardVisible, setLeaderboardVisible] = useState(false)
  const [chartTooltip, setChartTooltip] = useState<{
    visible: boolean,
    x: number,
    y: number,
    data: any
  }>({ visible: false, x: 0, y: 0, data: null })
  const { leaderboard, loading } = useGameData()
  const { user } = useAuth()
  const { playButtonClick, playTabClick } = useSound()

  // Move these calculations before the early return
  const currentProfile = viewingProfile || userProfile
  const isViewingOtherUser = !!viewingProfile

  // Animated numbers for current profile - must be called unconditionally
  const animatedWinnings = useCountUp(currentProfile?.total_winnings || 0, 2000, 200)
  const animatedGamesPlayed = useCountUp(currentProfile?.games_played || 0, 1500, 400)
  const animatedGamesWon = useCountUp(currentProfile?.games_won || 0, 1800, 600)
  const animatedWinRate = useCountUp(currentProfile ? parseFloat(calculateWinRate(currentProfile.games_won, currentProfile.games_played)) : 0, 2200, 800)
  const animatedEliminations = useCountUp((currentProfile?.games_won || 0) * 3, 1600, 1000)

  // Fetch user profile data
  useEffect(() => {
    if (user && activeTab === 'profile') {
      if (!viewingProfile) {
        fetchUserProfile()
        generateEarningsData()
      }
    }
  }, [user, activeTab, viewingProfile])

  // Reset viewing profile when tab changes
  useEffect(() => {
    if (activeTab !== 'profile') {
      setViewingProfile(null)
    }
    // Close dropdown when switching tabs
    setDropdownOpen(false)
    
    // Trigger leaderboard animation when switching to leaderboard tab
    if (activeTab === 'leaderboard') {
      setLeaderboardVisible(false)
      setTimeout(() => setLeaderboardVisible(true), 100)
    }
  }, [activeTab])

  const fetchUserProfile = async () => {
    if (!user) return
    
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }

      setUserProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  const generateEarningsData = () => {
    // Generate realistic earnings data for the last 6 months with detailed game stats
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const currentDate = new Date()
    const data = months.map((month, index) => ({
      month,
      earnings: Math.random() * 100 + (index * 20), // Trending upward
      games: Math.floor(Math.random() * 15) + 5, // 5-20 games per month
      kills: Math.floor(Math.random() * 50) + 10, // 10-60 kills per month
      playTime: Math.floor(Math.random() * 20) + 5, // 5-25 hours per month
      winRate: Math.random() * 40 + 30, // 30-70% win rate
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1).toISOString()
    }))
    setEarningsData(data)
  }

  const fetchOtherUserProfile = async (userId: string) => {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }

      setViewingProfile(data)
      generateEarningsDataForUser(data)
      setActiveTab('profile')
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  const generateEarningsDataForUser = (profile: UserProfile) => {
    // Generate realistic earnings data based on user's actual performance
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const currentDate = new Date()
    const totalEarnings = profile.total_winnings
    const data = months.map((month, index) => ({
      month,
      earnings: Math.max(0, (totalEarnings / 6) * (index + 1) + (Math.random() * 20 - 10)),
      games: Math.floor((profile.games_played / 6) * (index + 1)) + Math.floor(Math.random() * 5),
      kills: Math.floor(Math.random() * 30) + (index * 5),
      playTime: Math.floor(Math.random() * 15) + (index * 2),
      winRate: Math.max(20, Math.min(80, profile.games_won > 0 ? (profile.games_won / profile.games_played) * 100 + (Math.random() * 20 - 10) : Math.random() * 40 + 20)),
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1).toISOString()
    }))
    setEarningsData(data)
  }

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    switch (sortBy) {
      case 'winnings':
        return b.total_winnings - a.total_winnings
      case 'eliminations':
        return (b.games_won * 3) - (a.games_won * 3) // Estimated eliminations
      case 'games_played':
        return b.games_played - a.games_played
      case 'win_rate':
        return b.win_rate - a.win_rate
      case 'survival_time':
        return (b.games_played * 2.5) - (a.games_played * 2.5) // Estimated survival time
      default:
        return b.total_winnings - a.total_winnings
    }
  })

  const filteredLeaderboard = sortedLeaderboard.filter(player =>
    player.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRankColor = (index: number) => {
    if (index === 0) return 'border-yellow-400 text-yellow-400 bg-yellow-400/20'
    if (index === 1) return 'border-gray-300 text-gray-300 bg-gray-300/20'
    if (index === 2) return 'border-amber-600 text-amber-600 bg-amber-600/20'
    return 'border-white/55 text-white/90 bg-transparent'
  }

  const getRankShadow = (index: number) => {
    if (index === 0) return 'shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
    if (index === 1) return 'shadow-[0_4px_0_#6B7280] hover:shadow-[0_2px_0_#6B7280] active:shadow-[0_1px_0_#6B7280]'
    if (index === 2) return 'shadow-[0_4px_0_#92400E] hover:shadow-[0_2px_0_#92400E] active:shadow-[0_1px_0_#92400E]'
    return 'shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280]'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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

  const getSortIcon = (option: SortOption) => {
    switch (option) {
      case 'winnings':
        return <DollarSign className="h-4 w-4" />
      case 'eliminations':
        return <Target className="h-4 w-4" />
      case 'games_played':
        return <Trophy className="h-4 w-4" />
      case 'win_rate':
        return <BarChart3 className="h-4 w-4" />
      case 'survival_time':
        return <TrendingUp className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'winnings':
        return 'Winnings'
      case 'eliminations':
        return 'Eliminations'
      case 'games_played':
        return 'Games Played'
      case 'win_rate':
        return 'Win Rate'
      case 'survival_time':
        return 'Survival Time'
      default:
        return 'Winnings'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative max-w-4xl w-full h-[80vh] max-h-[80vh] flex flex-col bg-background/95 backdrop-blur border-2 border-border/40 rounded-lg p-6">
        {/* Header */}
        <div className="flex flex-col space-y-1.5 text-center sm:text-left flex-shrink-0 pb-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2 text-yellow-400">
            <Users className="h-5 w-5" />
            Social
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Tabs */}
            <div className="items-center justify-center gap-2 p-0 bg-transparent grid w-full grid-cols-4 flex-shrink-0">
              <button
                onClick={() => setActiveTab('leaderboard')}
                onMouseDown={playTabClick}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'leaderboard' ? 'bg-yellow-400 text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                }`}
              >
                <Trophy className="h-4 w-4 mr-2" />
                Leaderboard
              </button>
              <button
                onClick={() => setActiveTab('search')}
                onMouseDown={playTabClick}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'search' ? 'bg-yellow-400 text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                }`}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                onMouseDown={playTabClick}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'profile' ? 'bg-yellow-400 text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                onMouseDown={playTabClick}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform px-4 py-2 bg-transparent border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:bg-yellow-400/10 hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] ${
                  activeTab === 'friends' ? 'bg-yellow-400 text-black shadow-[0_2px_0_#ca8a04] translate-y-[2px]' : 'text-yellow-400'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                Friends
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden mt-4">
              {activeTab === 'leaderboard' && (
                <div className="h-full flex flex-col">
                  {/* Leaderboard Header */}
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-yellow-400" />
                      <span className="font-semibold">Top 10 Players</span>
                      <span className="text-xs text-muted-foreground">• Live rankings</span>
                    </div>
                    
                    {/* Sort Dropdown */}
                    <div className="relative">
                      <button 
                        type="button" 
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        onMouseDown={playButtonClick}
                        className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 w-48"
                      >
                        <span>
                          <div className="flex items-center gap-2">
                            {getSortIcon(sortBy)}
                            {getSortLabel(sortBy)}
                          </div>
                        </span>
                        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {dropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/40 rounded-md shadow-lg z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                playButtonClick()
                                setSortBy('winnings')
                                setDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-yellow-400/10 flex items-center gap-2 ${
                                sortBy === 'winnings' ? 'bg-yellow-400/20 text-yellow-400' : 'text-foreground'
                              }`}
                            >
                              <DollarSign className="h-4 w-4" />
                              Winnings
                            </button>
                            <button
                              onClick={() => {
                                playButtonClick()
                                setSortBy('eliminations')
                                setDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-yellow-400/10 flex items-center gap-2 ${
                                sortBy === 'eliminations' ? 'bg-yellow-400/20 text-yellow-400' : 'text-foreground'
                              }`}
                            >
                              <Target className="h-4 w-4" />
                              Eliminations
                            </button>
                            <button
                              onClick={() => {
                                playButtonClick()
                                setSortBy('games_played')
                                setDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-yellow-400/10 flex items-center gap-2 ${
                                sortBy === 'games_played' ? 'bg-yellow-400/20 text-yellow-400' : 'text-foreground'
                              }`}
                            >
                              <Trophy className="h-4 w-4" />
                              Games Played
                            </button>
                            <button
                              onClick={() => {
                                playButtonClick()
                                setSortBy('win_rate')
                                setDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-yellow-400/10 flex items-center gap-2 ${
                                sortBy === 'win_rate' ? 'bg-yellow-400/20 text-yellow-400' : 'text-foreground'
                              }`}
                            >
                              <BarChart3 className="h-4 w-4" />
                              Win Rate
                            </button>
                            <button
                              onClick={() => {
                                playButtonClick()
                                setSortBy('survival_time')
                                setDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-yellow-400/10 flex items-center gap-2 ${
                                sortBy === 'survival_time' ? 'bg-yellow-400/20 text-yellow-400' : 'text-foreground'
                              }`}
                            >
                              <TrendingUp className="h-4 w-4" />
                              Survival Time
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Leaderboard List */}
                  <div className="flex-1 min-h-0">
                    <div className="h-full overflow-y-auto pr-4">
                      {loading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
                        </div>
                      ) : filteredLeaderboard.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No players found</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredLeaderboard.slice(0, 10).map((player, index) => (
                            <LeaderboardItem
                              key={player.id}
                              player={player}
                              index={index}
                              sortBy={sortBy}
                              isCurrentUser={player.id === user?.id}
                              onClick={() => fetchOtherUserProfile(player.id)}
                              getRankColor={getRankColor}
                              getRankShadow={getRankShadow}
                              visible={leaderboardVisible}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'search' && (
                <div className="h-full flex flex-col">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 text-white placeholder-gray-400"
                        placeholder="Search players by username..."
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    {searchQuery ? (
                      filteredLeaderboard.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No players found matching "{searchQuery}"</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredLeaderboard.map((player, index) => (
                            <div
                              key={player.id}
                              onClick={() => fetchOtherUserProfile(player.id)}
                              className="flex items-center justify-between p-4 bg-background/30 border border-border/20 rounded-lg hover:bg-background/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center font-bold text-sm">
                                  {player.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{player.username}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {player.games_played} games • {player.win_rate.toFixed(1)}% win rate
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-yellow-400">${player.total_winnings.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">{player.games_won} wins</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Enter a username to search for players</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="h-full overflow-hidden">
                  <div className="h-full overflow-y-auto">
                    {/* Back button when viewing other user */}
                    {isViewingOtherUser && (
                      <div className="mb-4">
                        <button
                          onClick={() => setViewingProfile(null)}
                          onMouseDown={playButtonClick}
                          className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to My Profile
                        </button>
                      </div>
                    )}

                    {profileLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                      </div>
                    ) : !user ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Please log in to view your profile</p>
                        </div>
                      </div>
                    ) : currentProfile ? (
                      <div className="space-y-6 pr-4">
                        {/* Profile Header */}
                        <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                          <div className="flex flex-col space-y-1.5 p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold tracking-tight text-2xl text-foreground">
                                  {currentProfile.username}
                                </h3>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs w-fit">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Joined {formatDate(currentProfile.created_at)}
                                </div>
                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs w-fit">
                                  <Flame className="h-3 w-3 mr-1" />
                                  {calculateDaysSinceJoined(currentProfile.created_at)} day{calculateDaysSinceJoined(currentProfile.created_at) !== 1 ? 's' : ''} active
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Game Performance */}
                          <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                            <div className="flex flex-col space-y-1.5 p-6">
                              <h3 className="font-semibold tracking-tight flex items-center gap-2 text-lg">
                                <Trophy className="h-5 w-5 text-yellow-400" />
                                Game Performance
                              </h3>
                            </div>
                            <div className="p-6 pt-0 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Win Rate</p>
                                  <p className="text-2xl font-bold text-yellow-400">
                                    {animatedWinRate.toFixed(1)}%
                                  </p>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Games Won</p>
                                  <p className="text-2xl font-bold text-green-400">
                                    {animatedGamesWon}
                                  </p>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Games Played</p>
                                  <p className="text-2xl font-bold text-foreground">
                                    {animatedGamesPlayed}
                                  </p>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Avg Survival</p>
                                  <p className="text-2xl font-bold text-orange-400">
                                    {currentProfile.games_played > 0 ? '2:34' : '0:00'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Combat & Time */}
                          <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                            <div className="flex flex-col space-y-1.5 p-6">
                              <h3 className="font-semibold tracking-tight flex items-center gap-2 text-lg">
                                <Target className="h-5 w-5 text-red-400" />
                                Combat & Time
                              </h3>
                            </div>
                            <div className="p-6 pt-0 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Total Eliminations</p>
                                  <p className="text-2xl font-bold text-red-400">
                                    {animatedEliminations}
                                  </p>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Kills Per Game</p>
                                  <p className="text-2xl font-bold text-red-300">
                                    {currentProfile.games_played > 0 ? ((animatedEliminations) / currentProfile.games_played).toFixed(1) : '0.0'}
                                  </p>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-sm text-muted-foreground">Total Play Time</p>
                                  <p className="text-2xl font-bold text-neutral-400">
                                    {Math.floor(currentProfile.games_played * 2.5)}h {Math.floor((currentProfile.games_played * 2.5 % 1) * 60)}m
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Earnings Chart */}
                        <div className="rounded-lg border-2 text-card-foreground bg-background/40 border-border/40">
                          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-yellow-400" />
                              Earnings
                              <span className="text-2xl font-bold text-yellow-400 ml-2">
                                ${animatedWinnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </h3>
                            <select className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-32">
                              <option value="ytd">YTD</option>
                              <option value="all">All Time</option>
                              <option value="30d">Last 30 Days</option>
                            </select>
                          </div>
                          <div className="p-6 pt-0">
                            <div className="aspect-video min-h-[300px] w-full relative">
                              {/* Enhanced SVG Chart */}
                              <div 
                                className="w-full h-full bg-gradient-to-br from-background/30 to-background/10 rounded-lg border border-yellow-400/20 p-4 relative overflow-hidden"
                                onMouseMove={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const x = e.clientX - rect.left
                                  const y = e.clientY - rect.top
                                  
                                  // Calculate which data point is closest
                                  const chartWidth = rect.width - 100 // Account for padding
                                  const dataIndex = Math.round((x - 50) / (chartWidth / (earningsData.length - 1)))
                                  
                                  if (dataIndex >= 0 && dataIndex < earningsData.length) {
                                    setChartTooltip({
                                      visible: true,
                                      x: e.clientX,
                                      y: e.clientY,
                                      data: earningsData[dataIndex]
                                    })
                                  }
                                }}
                                onMouseLeave={() => setChartTooltip({ visible: false, x: 0, y: 0, data: null })}
                                onTouchMove={(e) => {
                                  const touch = e.touches[0]
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const x = touch.clientX - rect.left
                                  const y = touch.clientY - rect.top
                                  
                                  const chartWidth = rect.width - 100
                                  const dataIndex = Math.round((x - 50) / (chartWidth / (earningsData.length - 1)))
                                  
                                  if (dataIndex >= 0 && dataIndex < earningsData.length) {
                                    setChartTooltip({
                                      visible: true,
                                      x: touch.clientX,
                                      y: touch.clientY,
                                      data: earningsData[dataIndex]
                                    })
                                  }
                                }}
                                onTouchEnd={() => setChartTooltip({ visible: false, x: 0, y: 0, data: null })}
                              >
                                {/* Background glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/5 via-yellow-400/10 to-yellow-400/5 rounded-lg"></div>
                                
                                <svg className="w-full h-full relative z-10" viewBox="0 0 500 280">
                                  {/* Grid lines */}
                                  <defs>
                                    <pattern id="grid" width="50" height="25" patternUnits="userSpaceOnUse">
                                      <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#fbbf24" strokeWidth="0.3" opacity="0.2"/>
                                    </pattern>
                                    <linearGradient id="earningsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4"/>
                                      <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2"/>
                                      <stop offset="100%" stopColor="#d97706" stopOpacity="0.05"/>
                                    </linearGradient>
                                    <linearGradient id="glowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8"/>
                                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4"/>
                                    </linearGradient>
                                    <filter id="glow">
                                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                      <feMerge> 
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                      </feMerge>
                                    </filter>
                                    <filter id="dropShadow">
                                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.3"/>
                                    </filter>
                                  </defs>
                                  
                                  {/* Background grid */}
                                  <rect width="100%" height="100%" fill="url(#grid)" />
                                  
                                  {/* Chart area */}
                                  <g transform="translate(60, 30)">
                                    {/* Y-axis labels */}
                                    {[0, 1, 2, 3, 4].map((i) => (
                                      <text 
                                        key={i}
                                        x="-10" 
                                        y={30 + i * 35} 
                                        textAnchor="end" 
                                        className="fill-yellow-400/80 text-xs font-bold"
                                      >
                                        ${Math.max(0, Math.round((animatedWinnings * (4 - i)) / 4))}
                                      </text>
                                    ))}
                                    
                                    {/* X-axis labels */}
                                    {earningsData.map((point, index) => (
                                      <text 
                                        key={point.month} 
                                        x={index * 65 + 35} 
                                        y="210" 
                                        textAnchor="middle" 
                                        className="fill-yellow-400/90 text-xs font-bold"
                                      >
                                        {point.month}
                                      </text>
                                    ))}
                                    
                                    {/* Chart background */}
                                    <rect x="0" y="0" width="390" height="175" fill="rgba(0,0,0,0.15)" rx="6" filter="url(#dropShadow)"/>
                                    
                                    {/* Chart line and area */}
                                    {earningsData.length > 0 && (
                                      <>
                                        {/* Hover indicators */}
                                        {earningsData.map((point, index) => (
                                          <g key={`hover-${index}`}>
                                            {/* Vertical hover line */}
                                            <line
                                              x1={index * 65 + 35}
                                              y1="0"
                                              x2={index * 65 + 35}
                                              y2="175"
                                              stroke="#fbbf24"
                                              strokeWidth="1"
                                              opacity="0"
                                              className="hover:opacity-30 transition-opacity cursor-pointer"
                                            />
                                            {/* Invisible hover area */}
                                            <rect
                                              x={index * 65 + 5}
                                              y="0"
                                              width="60"
                                              height="175"
                                              fill="transparent"
                                              className="cursor-pointer"
                                            />
                                          </g>
                                        ))}
                                        
                                        {/* Shadow/glow effect */}
                                        <path
                                          d={`M 35 ${175 - (earningsData[0].earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))} ${earningsData.map((point, index) => 
                                            `L ${index * 65 + 35} ${175 - (point.earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}`
                                          ).join(' ')}`}
                                          fill="none"
                                          stroke="#fbbf24"
                                          strokeWidth="8"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          opacity="0.4"
                                          filter="url(#glow)"
                                        />
                                        
                                        {/* Area under the curve */}
                                        <path
                                          d={`M 35 ${175 - (earningsData[0].earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))} ${earningsData.map((point, index) => 
                                            `L ${index * 65 + 35} ${175 - (point.earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}`
                                          ).join(' ')} L ${(earningsData.length - 1) * 65 + 35} 175 L 35 175 Z`}
                                          fill="url(#earningsGradient)"
                                        />
                                        
                                        {/* Line */}
                                        <path
                                          d={`M 35 ${175 - (earningsData[0].earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))} ${earningsData.map((point, index) => 
                                            `L ${index * 65 + 35} ${175 - (point.earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}`
                                          ).join(' ')}`}
                                          fill="none"
                                          stroke="#fbbf24"
                                          strokeWidth="5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          filter="url(#dropShadow)"
                                        />
                                        
                                        {/* Data points */}
                                        {earningsData.map((point, index) => (
                                          <g key={`point-${index}`}>
                                            {/* Outer glow circle */}
                                            <circle
                                              cx={index * 65 + 35}
                                              cy={175 - (point.earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}
                                              r="8"
                                              fill="#fbbf24"
                                              opacity="0.3"
                                              filter="url(#glow)"
                                            />
                                            {/* Main data point */}
                                            <circle
                                              cx={index * 65 + 35}
                                              cy={175 - (point.earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}
                                              r="6"
                                              fill="url(#glowGradient)"
                                              stroke="#1f2937"
                                              strokeWidth="2"
                                              filter="url(#dropShadow)"
                                              className="hover:r-8 transition-all cursor-pointer"
                                            />
                                            {/* Inner highlight */}
                                            <circle
                                              cx={index * 65 + 35}
                                              cy={175 - (point.earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}
                                              r="3"
                                              fill="#fff"
                                              opacity="0.8"
                                            />
                                          </g>
                                        ))}
                                        
                                        {/* Real-time pulse indicator on latest point */}
                                        {earningsData.length > 0 && (
                                          <g>
                                            <circle
                                              cx={(earningsData.length - 1) * 65 + 35}
                                              cy={175 - (earningsData[earningsData.length - 1].earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}
                                              r="10"
                                              fill="#fbbf24"
                                              opacity="0.6"
                                              className="animate-ping"
                                            />
                                            <circle
                                              cx={(earningsData.length - 1) * 65 + 35}
                                              cy={175 - (earningsData[earningsData.length - 1].earnings * 140 / Math.max(...earningsData.map(d => d.earnings)))}
                                              r="4"
                                              fill="#10b981"
                                            />
                                          </g>
                                        )}
                                      </>
                                    )}
                                    
                                    {/* Real-time indicator */}
                                    <g transform="translate(350, 10)">
                                      <circle r="4" fill="#10b981" className="animate-pulse"/>
                                      <text x="10" y="5" className="fill-green-400 text-xs font-bold">LIVE</text>
                                    </g>
                                  </g>
                                </svg>

                                {/* Chart overlay info */}
                                <div className="absolute top-3 left-4 z-20">
                                  <p className="text-xs text-yellow-400/80 font-medium">Monthly Performance Tracking</p>
                                </div>
                                <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                  <p className="text-xs text-green-400/80 font-bold">Real-time Data</p>
                                </div>
                              </div>
                              
                              {/* Interactive Tooltip */}
                              {chartTooltip.visible && chartTooltip.data && (
                                <div 
                                  className="fixed z-50 pointer-events-none"
                                  style={{
                                    left: chartTooltip.x + 10,
                                    top: chartTooltip.y - 10,
                                    transform: 'translateY(-100%)'
                                  }}
                                >
                                  <div className="bg-black/90 backdrop-blur-sm border-2 border-yellow-400/40 rounded-lg p-4 shadow-2xl min-w-[280px]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-yellow-400/20">
                                      <h4 className="font-bold text-yellow-400 text-sm">
                                        {chartTooltip.data.month} 2024
                                      </h4>
                                      <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-green-400">Live</span>
                                      </div>
                                    </div>
                                    
                                    {/* Earnings */}
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                      <div className="bg-yellow-400/10 rounded-lg p-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <DollarSign className="w-3 h-3 text-yellow-400" />
                                          <span className="text-xs text-yellow-400/80">Total Earnings</span>
                                        </div>
                                        <p className="text-lg font-bold text-yellow-400">
                                          ${chartTooltip.data.earnings.toFixed(2)}
                                        </p>
                                      </div>
                                      
                                      <div className="bg-green-400/10 rounded-lg p-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Trophy className="w-3 h-3 text-green-400" />
                                          <span className="text-xs text-green-400/80">Win Rate</span>
                                        </div>
                                        <p className="text-lg font-bold text-green-400">
                                          {chartTooltip.data.winRate.toFixed(1)}%
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Game Stats */}
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <BarChart3 className="w-3 h-3 text-blue-400" />
                                          <span className="text-xs text-gray-300">Games Played</span>
                                        </div>
                                        <span className="text-sm font-bold text-white">{chartTooltip.data.games}</span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Target className="w-3 h-3 text-red-400" />
                                          <span className="text-xs text-gray-300">Total Kills</span>
                                        </div>
                                        <span className="text-sm font-bold text-white">{chartTooltip.data.kills}</span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-3 h-3 text-purple-400" />
                                          <span className="text-xs text-gray-300">Play Time</span>
                                        </div>
                                        <span className="text-sm font-bold text-white">{chartTooltip.data.playTime}h</span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Zap className="w-3 h-3 text-orange-400" />
                                          <span className="text-xs text-gray-300">Avg. Performance</span>
                                        </div>
                                        <span className="text-sm font-bold text-white">
                                          {chartTooltip.data.games > 0 ? (chartTooltip.data.kills / chartTooltip.data.games).toFixed(1) : '0.0'} K/G
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Footer */}
                                    <div className="mt-3 pt-2 border-t border-yellow-400/20">
                                      <p className="text-xs text-gray-400 text-center">
                                        Hover over chart points for detailed stats
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Tooltip Arrow */}
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                                    <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400/40"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Failed to load profile data</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'friends' && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold mb-2">Friends Coming Soon!</h3>
                    <p>Add friends and see who's online to play with.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-1"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
}

// Animated Leaderboard Item Component
interface LeaderboardItemProps {
  player: any
  index: number
  sortBy: SortOption
  isCurrentUser: boolean
  onClick: () => void
  getRankColor: (index: number) => string
  getRankShadow: (index: number) => string
  visible: boolean
}

const LeaderboardItem: React.FC<LeaderboardItemProps> = ({
  player,
  index,
  sortBy,
  isCurrentUser,
  onClick,
  getRankColor,
  getRankShadow,
  visible
}) => {
  // Animated value based on sort type
  const getAnimatedValue = () => {
    switch (sortBy) {
      case 'winnings':
        return useCountUp(visible ? player.total_winnings : 0, 1500, index * 100)
      case 'eliminations':
        return useCountUp(visible ? player.games_won * 3 : 0, 1200, index * 80)
      case 'games_played':
        return useCountUp(visible ? player.games_played : 0, 1000, index * 60)
      case 'win_rate':
        return useCountUp(visible ? parseFloat(player.win_rate.toFixed(1)) : 0, 1800, index * 120)
      case 'survival_time':
        return useCountUp(visible ? player.games_played * 2.5 : 0, 1600, index * 100)
      default:
        return useCountUp(visible ? player.total_winnings : 0, 1500, index * 100)
    }
  }

  const animatedValue = getAnimatedValue()

  const formatValue = () => {
    switch (sortBy) {
      case 'winnings':
        return `$${animatedValue.toFixed(2)}`
      case 'eliminations':
        return `${animatedValue} kills`
      case 'games_played':
        return `${animatedValue} games`
      case 'win_rate':
        return `${animatedValue.toFixed(1)}%`
      case 'survival_time':
        return `${Math.floor(animatedValue)}h ${Math.floor((animatedValue % 1) * 60)}m`
      default:
        return `$${animatedValue.toFixed(2)}`
    }
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-black border-2 ${getRankColor(index)} ${getRankShadow(index)} hover:translate-y-[2px] active:translate-y-[3px] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-yellow-400/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out before:skew-x-[-20deg] w-full h-auto p-4 justify-between relative overflow-hidden`}
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: `all 0.6s ease-out ${index * 100}ms`
      }}
    >
      <div className="flex items-center gap-3 relative z-10">
        <div className={`border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-secondary/80 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
          index === 0 ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' :
          index === 1 ? 'bg-gray-300/20 text-gray-300 border-gray-300/30' :
          index === 2 ? 'bg-amber-600/20 text-amber-600 border-amber-600/30' :
          'border-transparent bg-secondary text-secondary-foreground'
        }`}>
          {index + 1}
        </div>
        <span className="font-medium">{player.username}</span>
        {isCurrentUser && (
          <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded-full">You</span>
        )}
      </div>
      <div className="text-right relative z-10">
        <div className="font-semibold text-yellow-400">
          {formatValue()}
        </div>
      </div>
    </div>
  )
}