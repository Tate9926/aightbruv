import React, { useState, useEffect } from 'react'
import { X, Users, Copy, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useSound } from '../utils/soundManager'

interface AffiliateModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AffiliateModal({ isOpen, onClose }: AffiliateModalProps) {
  const [affiliateCode, setAffiliateCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    earningsUsd: 0
  })
  const { user } = useAuth()
  const { playButtonClick, playSuccessSound } = useSound()

  useEffect(() => {
    if (isOpen && user) {
      fetchAffiliateData()
    }
  }, [isOpen, user])

  const fetchAffiliateData = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Get or create affiliate code
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const defaultCode = profile?.username || `user_${user.id.slice(0, 8)}`
      
      // Get or create affiliate code
      const { data: codeData, error: codeError } = await supabase
        .rpc('get_or_create_affiliate_code', {
          p_user_id: user.id,
          p_code: defaultCode
        })

      if (codeError) throw codeError
      
      setAffiliateCode(codeData || defaultCode)

      // Get affiliate stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_affiliate_stats', {
          p_user_id: user.id
        })

      if (statsError) throw statsError

      if (statsData && statsData.length > 0) {
        setStats({
          totalUsers: statsData.total_users || 0,
          earningsUsd: parseFloat(statsData.total_earnings || 0)
        })
      } else {
        setStats({
          totalUsers: 0,
          earningsUsd: 0
        })
      }

    } catch (error) {
      console.error('Error fetching affiliate data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCode = async () => {
    if (!affiliateCode.trim() || !user) return

    setSaving(true)
    try {
      // Update affiliate code
      const { error } = await supabase
        .from('affiliate_codes')
        .upsert({
          user_id: user.id,
          code: affiliateCode.trim()
        })

      if (error) throw error
      
      playSuccessSound()
    } catch (error) {
      console.error('Error saving affiliate code:', error)
    } finally {
      setSaving(false)
    }
  }

  const copyShareLink = () => {
    const shareLink = `https://gaming-interface-wit-kkws.bolt.host/?ref=${affiliateCode}`
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    playSuccessSound()
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 bg-background p-6 shadow-lg duration-200 sm:rounded-lg max-w-4xl backdrop-blur-md border border-border/40"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)), url("/images/assets/grid-fade.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2 text-yellow-400">
            <Users className="h-5 w-5" />
            AFFILIATE PROGRAM
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Affiliate Code Section */}
          <div className="rounded-lg text-card-foreground bg-black/80 border border-border/40">
            <div className="p-4 space-y-3">
              <div className="text-white text-sm font-medium">Your Affiliate Code</div>
              <input
                type="text"
                value={affiliateCode}
                onChange={(e) => setAffiliateCode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border/40 bg-black/50 px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium text-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder="your-code"
                disabled={loading}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCode}
                  disabled={saving || loading}
                  onMouseDown={playButtonClick}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer border-0 will-change-transform bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-black shadow-[0_4px_0_#ca8a04] hover:shadow-[0_2px_0_#ca8a04] active:shadow-[0_1px_0_#ca8a04] hover:translate-y-[2px] active:translate-y-[3px] h-9 px-3 text-xs"
                >
                  {saving ? 'Saving...' : 'Save Code'}
                </button>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Share Link</div>
                <div className="flex items-center gap-2">
                  <div className="text-white text-sm break-all">
                    https://gaming-interface-wit-kkws.bolt.host/?ref={affiliateCode}
                  </div>
                  <button
                    onClick={copyShareLink}
                    onMouseDown={playButtonClick}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="rounded-lg text-card-foreground bg-black/80 border border-border/40">
            <div className="p-4 space-y-3">
              <div className="text-white text-sm font-medium">Stats</div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-1 gap-4">
                <div>
                  <div className="text-xs text-white">Commission Rate</div>
                  <div className="text-yellow-400 text-xl font-bold">10%</div>
                </div>
                <div>
                  <div className="text-xs text-white">Total Users</div>
                  <div className="text-white text-xl font-bold">{stats.totalUsers}</div>
                </div>
                <div>
                  <div className="text-xs text-white">Total Earnings</div>
                  <div className="text-yellow-400 text-xl font-bold">${stats.earningsUsd.toFixed(2)}</div>
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
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-yellow-400 hover:text-yellow-300"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
}