import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Wallet, Trophy, Users, Settings, Volume2, User, Play, Edit, Globe, Menu, List, PenSquare } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useGameData } from './hooks/useGameData';
import { useSound, soundManager } from './utils/soundManager';
import { AuthModal } from './components/AuthModal';
import { CustomizeModal } from './components/CustomizeModal';
import { SocialModal } from './components/SocialModal';
import { SettingsModal } from './components/SettingsModal';
import { WalletModal } from './components/WalletModal';
import { AffiliateModal } from './components/AffiliateModal';
import { SnakeGame } from './components/SnakeGame';
import { supabase } from './lib/supabase';

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

// Snake preview component for the main customize section
const SnakePreview = ({ color }: { color: string }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get actual canvas dimensions
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    // Set canvas resolution to match display size
    const scale = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    ctx.scale(scale, scale);

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Snake setup for preview - responsive sizing
    const isMobile = canvasWidth < 300;
    const segments = isMobile ? 6 : 8;
    const segmentSize = isMobile ? 16 : 20;
    const segmentSpacing = 7;
    
    // Initialize snake segments (horizontal)
    const snake = [];
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    for (let i = 0; i < segments; i++) {
      snake.push({
        x: centerX - i * (segmentSpacing + 2) + (isMobile ? 20 : 30),
        y: centerY
      });
    }
    
    // Draw snake with game-style rendering
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = isMobile ? 2 : 4;
    
    // Draw segments
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const brightness = 1.2 - (i / snake.length) * 0.2;
      
      // Create radial gradient for 3D effect
      const grad = ctx.createRadialGradient(seg.x, seg.y, 1, seg.x, seg.y, segmentSize / 2);
      grad.addColorStop(0, adjustColorBrightness(color, brightness));
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, adjustColorBrightness(color, 0.9));
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segmentSize / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Add subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = isMobile ? 0.5 : 1;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segmentSize / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw eyes on head (game-style)
    const headSeg = snake[0];
    const eyeOffset = isMobile ? 5 : 7;
    const eyeRadius = isMobile ? 4 : 5;
    const pupilRadius = isMobile ? 2 : 3;
    
    // Eye positions (diagonal like in game)
    const leftEye = {
      x: headSeg.x + Math.sin(0) * eyeOffset,
      y: headSeg.y - Math.cos(0) * eyeOffset
    };
    const rightEye = {
      x: headSeg.x - Math.sin(0) * eyeOffset,
      y: headSeg.y + Math.cos(0) * eyeOffset
    };
    
    // Draw eye whites
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw pupils (centered)
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEye.x, rightEye.y, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw eye highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const highlightSize = isMobile ? 0.8 : 1;
    ctx.beginPath();
    ctx.arc(leftEye.x + 1, leftEye.y + 1, highlightSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEye.x + 1, rightEye.y + 1, highlightSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }, [color]);

  const adjustColorBrightness = (hex: string, factor: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    
    const r = Math.min(255, Math.floor(parseInt(result[1], 16) * factor));
    const g = Math.min(255, Math.floor(parseInt(result[2], 16) * factor));
    const b = Math.min(255, Math.floor(parseInt(result[3], 16) * factor));
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <canvas 
      ref={canvasRef}
      className="w-full h-full object-contain"
      style={{ 
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
        aspectRatio: '3/1'
      }}
    />
  );
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { leaderboard, playersInGame, globalWinnings, loading: gameLoading, joinGame } = useGameData();
  const { playButtonClick, playToggleClick, playSuccessSound } = useSound();
  
  const [balance, setBalance] = useState(0.00);
  const [playerName, setPlayerName] = useState('');
  const [selectedBet, setSelectedBet] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [initialSocialTab, setInitialSocialTab] = useState<'leaderboard' | 'search' | 'profile' | 'friends'>('leaderboard');
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [showGame, setShowGame] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [snakeColor, setSnakeColor] = useState(() => {
    // Load saved color from localStorage or use default
    const savedColor = localStorage.getItem('snakeColor');
    // Validate that the saved color is a valid hex color
    const isValidHexColor = (color: string) => {
      return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    };
    
    if (savedColor && isValidHexColor(savedColor)) {
      return savedColor;
    }
    
    // Clear invalid color from localStorage and return default
    if (savedColor) {
      localStorage.removeItem('snakeColor');
    }
    
    return '#00ffcc';
  });

  // Save snake color to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('snakeColor', snakeColor);
  }, [snakeColor]);

  // Initialize sound manager with settings
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Animated numbers
  const animatedPlayersInGame = useCountUp(playersInGame, 1500, 300);
  const animatedGlobalWinnings = useCountUp(globalWinnings, 2500, 600);
  const animatedLeaderboard1 = useCountUp(leaderboard[0]?.total_winnings || 0, 2000, 200);
  const animatedLeaderboard2 = useCountUp(leaderboard[1]?.total_winnings || 0, 2200, 400);
  const animatedLeaderboard3 = useCountUp(leaderboard[2]?.total_winnings || 0, 2400, 600);

  // Fetch user profile
  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setUserProfile(data);
      setPlayerName(data.username);
      setBalance(data.balance || 0);
    } else if (!error || error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log('Profile not found, creating new profile for user:', user.id);
      const username = user.user_metadata?.username || `player_${user.id.slice(0, 8)}`;
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username,
          balance: 0,
          total_winnings: 0,
          games_played: 0,
          games_won: 0
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
      } else if (newProfile) {
        console.log('Successfully created new profile:', newProfile);
        setUserProfile(newProfile);
        setPlayerName(newProfile.username);
        setBalance(newProfile.balance || 0);
      }
    } else {
      console.error('Error fetching profile:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setPlayerName('');
    setUserProfile(null);
    setBalance(0);
    setShowGame(false);
    setCurrentServerId(null);
  };

  const handleJoinGame = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    const result = await joinGame(selectedBet, user.id);
    if (result.success) {
      setCurrentServerId(result.serverId);
      setShowGame(true);
    } else {
      alert('Failed to join game. Please try again.');
    }
  };

  const handleGameEnd = async (score: number) => {
    // Update user stats and winnings based on game performance - this will trigger real-time updates
    if (user && userProfile) {
      const winnings = score * 0.1; // Example: 10 cents per point
      const isWinner = score > 100; // Simple win condition
      
      // Update profile with new stats
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          balance: userProfile.balance + winnings, // Add winnings to spendable balance
          total_winnings: userProfile.total_winnings + winnings,
          games_played: userProfile.games_played + 1,
          games_won: userProfile.games_won + (isWinner ? 1 : 0)
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Create game session record
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          server_id: currentServerId,
          player_id: user.id,
          position: isWinner ? 1 : Math.floor(Math.random() * 10) + 2,
          winnings: winnings,
          snake_data: { final_score: score, final_length: Math.floor(score / 10) + 1 },
          finished_at: new Date().toISOString()
        });

      if (sessionError) {
        console.error('Error creating game session:', sessionError);
      }
      
      // Remove from server
      const { error: removeError } = await supabase
        .from('server_players')
        .delete()
        .eq('player_id', user.id)
        .eq('server_id', currentServerId);

      if (removeError) {
        console.error('Error removing from server:', removeError);
      }
      
      setShowGame(false);
      setCurrentServerId(null);
      
      // Refresh user profile to get updated data
      setTimeout(() => {
        fetchUserProfile();
      }, 500); // Small delay to ensure database updates are processed
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (showGame && currentServerId && user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <SnakeGame 
          serverId={currentServerId}
          playerId={user.id}
          initialSnakeColor={snakeColor}
          onGameEnd={handleGameEnd}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] text-white relative overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 animated-bg-pan w-full h-full"></div>
      
      {/* Dark Overlay for Better Text Readability */}
      <div className="fixed inset-0 z-0 bg-black/40 lg:bg-black/20 w-full h-full"></div>
      
      {/* Top Header */}
      <div className="flex justify-between items-center py-3 px-4 sm:py-4 sm:px-6 relative z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
            <img 
              src="https://i.postimg.cc/nL1Wk60T/iconV1.png" 
              alt="AIGHTBRUV Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-base sm:text-lg font-semibold truncate transition-all duration-500 ease-in-out">
            {user && playerName ? (
              <>
                <span className="block sm:inline">Welcome,</span> <span className="text-yellow-400 font-extrabold transition-all duration-500 ease-in-out block sm:inline">
                  {playerName}!
                </span>
              </>
            ) : (
              <>
                Welcome, <span className="text-yellow-400 font-extrabold">bruv</span>!
              </>
            )}
          </h1>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-4 flex-shrink-0">
          <div className={`flex items-center gap-4 sm:gap-4 transition-all duration-500 ease-in-out ${
            user ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
          }`}>
            <div 
              onClick={() => setSoundEnabled(!soundEnabled)}
              onMouseDown={playToggleClick}
              className={`relative w-6 h-6 sm:w-5 sm:h-5 cursor-pointer transition-all duration-300 ${
                soundEnabled 
                  ? 'text-white hover:text-yellow-400' 
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <Volume2 
                className={`w-6 h-6 sm:w-5 sm:h-5 transition-all duration-300 ${
                  soundEnabled 
                    ? 'scale-100 opacity-100' 
                    : 'scale-90 opacity-60'
                }`} 
              />
              {!soundEnabled && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-0.5 sm:w-6 bg-red-500 rotate-45 rounded-full shadow-lg"></div>
                </div>
              )}
            </div>
            <User 
              className="w-6 h-6 sm:w-5 sm:h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" 
              onClick={() => {
                playButtonClick();
                setInitialSocialTab('profile');
                setSocialModalOpen(true);
              }}
            />
            <Settings 
              className="w-6 h-6 sm:w-5 sm:h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" 
              onClick={() => {
                playButtonClick();
                setSettingsModalOpen(true);
              }}
            />
          </div>
          <button 
            onClick={user ? handleLogout : () => setAuthModalOpen(true)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform bg-yellow-400 hover:bg-yellow-400/90 active:bg-yellow-400/80 text-black shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] h-7 sm:h-9 px-2 sm:px-3 text-xs"
            onMouseDown={playButtonClick}
          >
            {user ? 'Logout' : 'Login'}
          </button>
        </div>
      </div>

      <main className="min-h-screen flex flex-col items-center justify-start relative z-10 pt-4 sm:pt-8 px-3 sm:px-4 pb-6">
        {/* Logo Section */}
        <div className="text-center mb-4 sm:mb-6 lg:mb-8 w-full">
          <div className="custom-logo">
            <div className="logo-main">
              <span className="logo-aight">AIGHT</span>
              <span className="logo-bruv">BRUV</span>
            </div>
            <div className="logo-subtitle">SKILL-BASED BETTING</div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col lg:flex-row items-stretch gap-2 sm:gap-4 w-full max-w-7xl">
          
          {/* Left Column - Leaderboard & Friends */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2 sm:gap-4 order-3 lg:order-1">
            {/* Leaderboard */}
            <div className="rounded-lg border-2 text-card-foreground bg-background/60 backdrop-blur-lg border-border/40">
              <div className="p-2 sm:p-4 flex flex-col min-h-[180px] sm:min-h-[200px] lg:min-h-[250px]">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold">Leaderboard</span>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-secondary/80 ml-auto bg-green-500/20 text-green-400 border-green-500/30">
                    <div className="flex items-center gap-2">
                      <div className="relative w-2 h-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                        <div className="absolute top-0 left-0 w-2 h-2 bg-green-400 rounded-full"></div>
                      </div>
                      Live
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto mb-4">
                  <div className="space-y-2 text-xs sm:text-sm">
                    {leaderboard.slice(0, 3).map((player, index) => (
                      <div key={player.id} className="flex justify-between">
                        <span className="text-muted-foreground">{index + 1}. {player.username}</span>
                        <span className="text-yellow-400">
                          ${index === 0 ? animatedLeaderboard1.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                            index === 1 ? animatedLeaderboard2.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                            animatedLeaderboard3.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {leaderboard.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No players yet!</p>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSocialModalOpen(true)}
                  onMouseDown={playButtonClick}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-8 sm:h-9 px-3 text-xs w-full"
                >
                  View Full Leaderboard
                </button>
              </div>
            </div>

            {/* Friends */}
            <div className="rounded-lg border-2 text-card-foreground bg-background/60 backdrop-blur-lg border-border/40">
              <div className="p-2 sm:p-4 flex flex-col min-h-[180px] sm:min-h-[200px] lg:min-h-[250px]">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold">Friends</span>
                  <button className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent rounded-md px-3 h-6 ml-auto text-xs text-muted-foreground hover:text-foreground">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </button>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    0 playing
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto mb-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No friends... add some!</p>
                  </div>
                </div>
                <button 
                  onMouseDown={playButtonClick}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-8 sm:h-9 px-3 text-xs w-full"
                >
                  Add Friends
                </button>
              </div>
            </div>
          </div>

          {/* Center Column - Main Game Interface */}
          <div className="w-full lg:flex-1 flex flex-col gap-2 sm:gap-4 items-center order-1 lg:order-2">
            <div className="rounded-lg border-2 text-card-foreground w-full max-w-none bg-background/60 backdrop-blur-lg border-border/40">
              <div className="p-4 sm:p-8 lg:p-8 space-y-6 sm:space-y-6">
                
                {/* Name + Avatar + Edit */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative h-[36px] w-[36px] sm:h-[44px] sm:w-[44px] flex items-center justify-center shrink-0 group">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-800 via-yellow-700 to-yellow-900 rounded-lg shadow-[0_6px_12px_rgba(0,0,0,0.4)]"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-gold to-yellow-600 rounded-lg shadow-[0_4px_8px_rgba(255,215,0,0.3)] group-hover:shadow-[0_6px_12px_rgba(255,215,0,0.4)] transition-all duration-300"></div>
                      <div className="absolute inset-1 bg-gradient-to-br from-yellow-300 via-gold to-yellow-500 rounded-md opacity-80"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/25 to-transparent rounded-lg opacity-60"></div>
                      <div className="absolute inset-0 rounded-lg border-2 border-yellow-800/60 shadow-inner"></div>
                      <div className="absolute inset-0 rounded-lg border border-yellow-300/40"></div>
                      <span className="relative z-10 text-black font-black text-base sm:text-lg tracking-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)]">?</span>
                    </div>
                    
                    <input
                      placeholder="Enter your name"
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-background/50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 border-border/40 text-base sm:text-base placeholder:text-gray-400 placeholder:text-sm sm:placeholder:text-base"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                    />
                    
                    <button className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] shrink-0 h-[36px] w-[36px] sm:h-[44px] sm:w-[44px]">
                      <PenSquare className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bet Amount Buttons */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button 
                      onClick={() => setSelectedBet(1)}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform ${
                        selectedBet === 1 
                          ? 'border-0 bg-yellow-400 hover:bg-yellow-400/90 active:bg-yellow-400/80 text-black shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
                          : 'bg-transparent hover:bg-yellow-400/10 active:bg-yellow-400/20 text-yellow-400 border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
                      } hover:translate-y-[2px] active:translate-y-[3px] h-12 sm:h-11 px-3 sm:px-4 lg:px-8 text-base sm:text-base lg:text-lg font-bold`}
                    >
                      $1
                    </button>
                    <button 
                      onClick={() => setSelectedBet(5)}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform ${
                        selectedBet === 5 
                          ? 'border-0 bg-yellow-400 hover:bg-yellow-400/90 active:bg-yellow-400/80 text-black shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
                          : 'bg-transparent hover:bg-yellow-400/10 active:bg-yellow-400/20 text-yellow-400 border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
                      } hover:translate-y-[2px] active:translate-y-[3px] h-12 sm:h-11 px-3 sm:px-4 lg:px-8 text-base sm:text-base lg:text-lg font-bold`}
                    >
                      $5
                    </button>
                    <button 
                      onClick={() => setSelectedBet(20)}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform ${
                        selectedBet === 20 
                          ? 'border-0 bg-yellow-400 hover:bg-yellow-400/90 active:bg-yellow-400/80 text-black shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
                          : 'bg-transparent hover:bg-yellow-400/10 active:bg-yellow-400/20 text-yellow-400 border-2 border-yellow-400 shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04]'
                      } hover:translate-y-[2px] active:translate-y-[3px] h-12 sm:h-11 px-3 sm:px-4 lg:px-8 text-base sm:text-base lg:text-lg font-bold`}
                    >
                      $20
                    </button>
                  </div>
                </div>

                {/* Join Game */}
                <div>
                  <button 
                    onClick={handleJoinGame}
                    onMouseDown={playButtonClick}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform relative overflow-hidden bg-[#fca109] hover:bg-[#fca109]/90 active:bg-[#fca109]/80 text-black shadow-[0_8px_0_#ae6903] hover:shadow-[0_4px_0_#ae6903] active:shadow-[0_2px_0_#ae6903] hover:translate-y-[4px] active:translate-y-[6px] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out before:skew-x-[-20deg] px-4 py-2 w-full h-16 sm:h-14 lg:h-16 text-lg sm:text-lg lg:text-xl font-black gap-2 sm:gap-3"
                  >
                    <div className="absolute inset-1 bg-gradient-to-b from-[#ffd053] from-50% to-[#feba2a] to-50% rounded-md flex items-center justify-center z-10 overflow-hidden">
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#fcefc1] rounded-sm"></div>
                      <Play className="w-5 h-5 sm:w-5 sm:h-5 lg:w-7 lg:h-7" />
                      {user ? 'JOIN GAME' : 'LOGIN TO PLAY'}
                    </div>
                  </button>
                </div>

                {/* Region + Browse */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button 
                    onMouseDown={playButtonClick}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-10 sm:h-9 px-2 sm:px-3 text-sm sm:text-xs w-full"
                  >
                    <Globe className="w-3 h-3 mr-1" />
                    US
                  </button>
                  <button 
                    onMouseDown={playButtonClick}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-10 sm:h-9 px-2 sm:px-3 text-sm sm:text-xs"
                  >
                    <List className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Browse Lobbies</span>
                    <span className="sm:hidden">Browse Lobbies</span>
                  </button>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-4 sm:pt-4 border-t-2 border-border/20">
                  <div className="text-center">
                    <div className="text-2xl sm:text-xl lg:text-2xl font-bold text-yellow-400">
                      <span>{animatedPlayersInGame}</span>
                    </div>
                    <div className="text-sm sm:text-sm text-muted-foreground">Players In Game</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-xl lg:text-2xl font-bold text-yellow-400">
                      $<span>{animatedGlobalWinnings.toLocaleString()}</span>
                    </div>
                    <div className="text-sm sm:text-sm text-muted-foreground">Global Winnings</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manage Affiliate Button */}
            <div className="flex gap-2 sm:gap-4 w-full max-w-lg sm:max-w-xl lg:max-w-full">
              <button 
                onClick={() => {
                  playButtonClick();
                  setShowAffiliateModal(true);
                }}
                onMouseDown={playButtonClick}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform relative overflow-hidden bg-[#fca109] hover:bg-[#fca109]/90 active:bg-[#fca109]/80 text-black shadow-[0_8px_0_#ae6903] hover:shadow-[0_4px_0_#ae6903] active:shadow-[0_2px_0_#ae6903] hover:translate-y-[4px] active:translate-y-[6px] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out before:skew-x-[-20deg] h-10 sm:h-11 px-4 sm:px-6 lg:px-8 flex-1"
              >
                <div className="absolute inset-1 bg-gradient-to-b from-[#ffd053] from-50% to-[#feba2a] to-50% rounded-md flex items-center justify-center z-10 overflow-hidden">
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#fcefc1] rounded-sm"></div>
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Manage Affiliate</span>
                  <span className="sm:hidden">Manage Affiliate</span>
                </div>
              </button>
            </div>
          </div>

          {/* Right Column - Wallet & Customize */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2 sm:gap-4 order-2 lg:order-3">
            {/* Wallet */}
            <div className="rounded-lg border-2 text-card-foreground bg-background/60 backdrop-blur-lg border-border/40">
              <div className="p-2 sm:p-4 flex flex-col min-h-[180px] sm:min-h-[200px] lg:min-h-[250px]">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-green-400" />
                  <span className="font-semibold">Wallet</span>
                  <div className="ml-auto flex gap-1 sm:gap-2">
                    <button 
                      onClick={async () => {
                        try {
                          // Get user's Solana address
                          if (user) {
                            const { data } = await supabase
                              .rpc('get_user_crypto_addresses', { 
                                target_user_id: user.id
                              })
                              .single();
                            
                            if (data?.solana_address) {
                              await navigator.clipboard.writeText(data.solana_address);
                              playSuccessSound();
                              
                              // Create and show a styled success message
                              const successMessage = document.createElement('div');
                              successMessage.innerHTML = `
                                <div style="
                                  position: fixed;
                                  top: 20px;
                                  right: 20px;
                                  background: linear-gradient(135deg, #10b981, #059669);
                                  color: white;
                                  padding: 16px 20px;
                                  border-radius: 12px;
                                  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
                                  z-index: 9999;
                                  font-family: 'Inter', sans-serif;
                                  font-weight: 600;
                                  font-size: 14px;
                                  display: flex;
                                  align-items: center;
                                  gap: 8px;
                                  backdrop-filter: blur(10px);
                                  border: 1px solid rgba(255, 255, 255, 0.1);
                                  animation: slideInRight 0.3s ease-out;
                                ">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                  Solana address copied to clipboard!
                                </div>
                              `;
                              
                              // Add animation keyframes if not already present
                              if (!document.querySelector('#copy-success-animation')) {
                                const style = document.createElement('style');
                                style.id = 'copy-success-animation';
                                style.textContent = `
                                  @keyframes slideInRight {
                                    from {
                                      transform: translateX(100%);
                                      opacity: 0;
                                    }
                                    to {
                                      transform: translateX(0);
                                      opacity: 1;
                                    }
                                  }
                                `;
                                document.head.appendChild(style);
                              }
                              
                              document.body.appendChild(successMessage);
                              
                              // Remove the message after 3 seconds
                              setTimeout(() => {
                                successMessage.style.animation = 'slideInRight 0.3s ease-out reverse';
                                setTimeout(() => {
                                  if (document.body.contains(successMessage)) {
                                    document.body.removeChild(successMessage);
                                  }
                                }, 300);
                              }, 3000);
                            } else {
                              // Create and show error message
                              const errorMessage = document.createElement('div');
                              errorMessage.innerHTML = `
                                <div style="
                                  position: fixed;
                                  top: 20px;
                                  right: 20px;
                                  background: linear-gradient(135deg, #ef4444, #dc2626);
                                  color: white;
                                  padding: 16px 20px;
                                  border-radius: 12px;
                                  box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
                                  z-index: 9999;
                                  font-family: 'Inter', sans-serif;
                                  font-weight: 600;
                                  font-size: 14px;
                                  display: flex;
                                  align-items: center;
                                  gap: 8px;
                                  backdrop-filter: blur(10px);
                                  border: 1px solid rgba(255, 255, 255, 0.1);
                                  animation: slideInRight 0.3s ease-out;
                                ">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                  </svg>
                                  No Solana address found
                                </div>
                              `;
                              
                              document.body.appendChild(errorMessage);
                              
                              setTimeout(() => {
                                errorMessage.style.animation = 'slideInRight 0.3s ease-out reverse';
                                setTimeout(() => {
                                  if (document.body.contains(errorMessage)) {
                                    document.body.removeChild(errorMessage);
                                  }
                                }, 300);
                              }, 3000);
                            }
                          }
                        } catch (error) {
                          console.error('Failed to copy address:', error);
                          
                          // Create and show error message
                          const errorMessage = document.createElement('div');
                          errorMessage.innerHTML = `
                            <div style="
                              position: fixed;
                              top: 20px;
                              right: 20px;
                              background: linear-gradient(135deg, #ef4444, #dc2626);
                              color: white;
                              padding: 16px 20px;
                              border-radius: 12px;
                              box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
                              z-index: 9999;
                              font-family: 'Inter', sans-serif;
                              font-weight: 600;
                              font-size: 14px;
                              display: flex;
                              align-items: center;
                              gap: 8px;
                              backdrop-filter: blur(10px);
                              border: 1px solid rgba(255, 255, 255, 0.1);
                              animation: slideInRight 0.3s ease-out;
                            ">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                              Failed to copy address
                            </div>
                          `;
                          
                          document.body.appendChild(errorMessage);
                          
                          setTimeout(() => {
                            errorMessage.style.animation = 'slideInRight 0.3s ease-out reverse';
                            setTimeout(() => {
                              if (document.body.contains(errorMessage)) {
                                document.body.removeChild(errorMessage);
                              }
                            }, 300);
                          }, 3000);
                        }
                      }}
                      onMouseDown={playButtonClick}
                      className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent rounded-md h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Copy Address</span>
                      <span className="sm:hidden">Copy Address</span>
                    </button>
                    <button className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent rounded-md h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Refresh Balance</span>
                      <span className="sm:hidden">Refresh Balance</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 flex flex-col items-center text-center py-3 sm:py-4 justify-center mb-4">
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-400">
                      $<span>{balance.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">0.0000 SOL</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => {
                        playButtonClick();
                        setWalletMode('deposit');
                        setWalletModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-green-500/10 active:bg-green-500/20 text-green-500 border-2 border-green-500 shadow-[0_4px_0_#15803D] hover:shadow-[0_2px_0_#15803D] active:shadow-[0_1px_0_#15803D] hover:translate-y-[2px] active:translate-y-[3px] h-8 sm:h-9 px-2 sm:px-3 text-xs"
                    >
                      Add Funds
                    </button>
                    <button 
                      onClick={() => {
                        playButtonClick();
                        setWalletMode('withdraw');
                        setWalletModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-[#5865F2]/10 active:bg-[#5865F2]/20 text-[#5865F2] border-2 border-[#5865F2] shadow-[0_4px_0_#3C45A5] hover:shadow-[0_2px_0_#3C45A5] active:shadow-[0_1px_0_#3C45A5] hover:translate-y-[2px] active:translate-y-[3px] h-8 sm:h-9 px-2 sm:px-3 text-xs"
                    >
                      Cash Out
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Customize */}
            <div className="rounded-lg border-2 text-card-foreground bg-background/60 backdrop-blur-lg border-border/40">
              <div className="p-2 sm:p-4 flex flex-col h-52 sm:h-48 lg:h-64">
                <div className="flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shirt w-5 h-5 text-purple-400">
                    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path>
                  </svg>
                  <span className="font-semibold">Customize</span>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 rounded-md mb-3 sm:mb-4 overflow-hidden bg-gray-800/50">
                    <SnakePreview color={snakeColor} />
                  </div>
                  <div className="flex-shrink-0">
                    <button 
                      onClick={() => setCustomizeModalOpen(true)}
                      onMouseDown={playButtonClick}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] h-10 px-4 py-2 w-full text-xs"
                    >
                      Customize Snake
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AuthModal 
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onModeChange={setAuthMode}
      />
      
      <CustomizeModal 
        isOpen={customizeModalOpen}
        onClose={() => setCustomizeModalOpen(false)}
        currentColor={snakeColor}
        onColorChange={setSnakeColor}
      />
      
      <SocialModal 
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        initialTab={initialSocialTab}
      />
      
      <SettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        soundEnabled={soundEnabled}
        onSoundToggle={setSoundEnabled}
      />
      
      <WalletModal 
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        mode={walletMode}
        onModeChange={setWalletMode}
      />
      
      <AffiliateModal 
        isOpen={showAffiliateModal}
        onClose={() => setShowAffiliateModal(false)}
      />
    </div>
  );
}

export default App;