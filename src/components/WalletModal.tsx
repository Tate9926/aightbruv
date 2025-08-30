import React, { useState, useEffect } from 'react'
import { X, Copy, Wallet, Check, ExternalLink, AlertTriangle, DollarSign, Send } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useSound } from '../utils/soundManager'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'deposit' | 'withdraw'
}

interface UserWallet {
  ethereum_address: string
  tron_address: string
  solana_address: string
}

type CryptoNetwork = 'ethereum' | 'tron' | 'solana'

const networkInfo = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    color: 'bg-blue-500',
    icon: '⟠',
    explorer: 'https://etherscan.io/address/'
  },
  tron: {
    name: 'Tron',
    symbol: 'TRX',
    color: 'bg-red-500',
    icon: '◊',
    explorer: 'https://tronscan.org/#/address/'
  },
  solana: {
    name: 'Solana',
    symbol: 'SOL',
    color: 'bg-purple-500',
    icon: '◎',
    explorer: 'https://explorer.solana.com/address/'
  }
}

export function WalletModal({ isOpen, onClose, mode }: WalletModalProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>('ethereum')
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState('')
  const [userBalance, setUserBalance] = useState(0)
  const { user } = useAuth()
  const { playButtonClick, playSuccessSound } = useSound()

  useEffect(() => {
    if (isOpen && user) {
      fetchUserWallet()
      fetchUserBalance()
    }
  }, [isOpen, user])

  const fetchUserWallet = async () => {
    if (!user) return

    setLoading(true)
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
      } else {
        console.log('No wallet found for user')
      }
    } catch (error) {
      console.error('Error fetching user wallet:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserBalance = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single()

      if (data) {
        setUserBalance(data.balance || 0)
      }
    } catch (error) {
      console.error('Error fetching user balance:', error)
    }
  }
  
  const copyToClipboard = async (address: string, network: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      playSuccessSound()
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }

  const openExplorer = (address: string, network: CryptoNetwork) => {
    const explorerUrl = networkInfo[network].explorer + address
    window.open(explorerUrl, '_blank')
  }

  const getCurrentAddress = () => {
    if (!userWallet) return null
    
    switch (selectedNetwork) {
      case 'ethereum':
        return userWallet.ethereum_address
      case 'tron':
        return userWallet.tron_address
      case 'solana':
        return userWallet.solana_address
      default:
        return null
    }
  }

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const validateWithdrawal = () => {
    setWithdrawError('')
    
    const amount = parseFloat(withdrawAmount)
    
    if (!withdrawAmount || isNaN(amount) || amount <= 0) {
      setWithdrawError('Please enter a valid amount')
      return false
    }
    
    if (amount < getMinWithdrawal()) {
      setWithdrawError(`Minimum withdrawal is ${getMinWithdrawal()} ${network.symbol}`)
      return false
    }
    
    const maxWithdrawal = getMaxWithdrawal()
    if (amount > maxWithdrawal) {
      setWithdrawError(`Insufficient balance. Maximum withdrawal: $${maxWithdrawal.toFixed(2)}`)
      return false
    }
    
    if (!withdrawAddress.trim()) {
      setWithdrawError('Please enter a withdrawal address')
      return false
    }
    
    if (!validateAddress(withdrawAddress, selectedNetwork)) {
      setWithdrawError(`Please enter a valid ${network.name} address`)
      return false
    }
    
    return true
  }
  
  const validateAddress = (address: string, network: CryptoNetwork) => {
    switch (network) {
      case 'ethereum':
        return /^0x[a-fA-F0-9]{40}$/.test(address)
      case 'tron':
        return /^T[A-Za-z1-9]{33}$/.test(address)
      case 'solana':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
      default:
        return false
    }
  }
  
  const getMinWithdrawal = () => {
    switch (selectedNetwork) {
      case 'ethereum': return 0.0001
      case 'tron': return 1
      case 'solana': return 0.001
      default: return 0.001
    }
  }
  
  const getMaxWithdrawal = () => {
    // Convert USD balance to crypto equivalent (simplified conversion)
    const conversionRates = {
      ethereum: 0.0003, // ~$3000 per ETH
      tron: 10, // ~$0.1 per TRX
      solana: 0.005 // ~$200 per SOL
    }
    
    return userBalance * (conversionRates[selectedNetwork] || 0.0003)
  }
  
  const getNetworkFee = () => {
    switch (selectedNetwork) {
      case 'ethereum': return 0.005
      case 'tron': return 1
      case 'solana': return 0.0001
      default: return 0.005
    }
  }
  
  const getMinDeposit = () => {
    switch (selectedNetwork) {
      case 'ethereum': return 0.0001
      case 'tron': return 1
      case 'solana': return 0.001
      default: return 0.0001
    }
  }
  
  const processWithdrawal = async () => {
    if (!validateWithdrawal() || !user) return
    
    setIsProcessing(true)
    setWithdrawError('')
    setWithdrawSuccess('')
    
    try {
      const amount = parseFloat(withdrawAmount)
      const networkFee = getNetworkFee()
      const totalAmount = amount + networkFee
      
      // Convert crypto amount back to USD for balance deduction
      const conversionRates = {
        ethereum: 3000, // $3000 per ETH
        tron: 0.1, // $0.10 per TRX
        solana: 200 // $200 per SOL
      }
      
      const usdAmount = totalAmount * (conversionRates[selectedNetwork] || 3000)
      
      // Create withdrawal record
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          amount: amount,
          network: selectedNetwork,
          withdrawal_address: withdrawAddress,
          network_fee: networkFee,
          total_amount: totalAmount,
          usd_amount: usdAmount,
          status: 'pending'
        })
        .select('id')
        .single()
      
      if (withdrawalError) throw withdrawalError
      
      // Update user balance
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({
          balance: userBalance - usdAmount
        })
        .eq('id', user.id)
      
      if (balanceError) throw balanceError
      
      // Process real withdrawal using Supabase Edge Function
      const { data: processResult, error: processError } = await supabase.functions.invoke('process-withdrawal', {
        body: {
          user_id: user.id,
          withdrawal_id: withdrawalData.id,
          amount: amount.toString(),
          network: selectedNetwork,
          withdrawal_address: withdrawAddress,
          network_fee: networkFee.toString()
        }
      })
      
      if (processError) {
        console.error('Withdrawal processing error:', processError)
        // Revert balance update on error
        await supabase
          .from('profiles')
          .update({
            balance: userBalance // Restore original balance
          })
          .eq('id', user.id)
        
        // Extract specific error message from Edge Function response
        let errorMessage = 'Failed to process withdrawal'
        
        if (processError.context?.data?.error) {
          errorMessage = processError.context.data.error
          
          // Add more user-friendly messages for common errors
          if (errorMessage.includes('Insufficient funds')) {
            errorMessage = 'Insufficient funds in the custodial wallet. Please try again later or contact support.'
          } else if (errorMessage.includes('Master mnemonic not configured')) {
            errorMessage = 'Withdrawal system is temporarily unavailable. Please contact support.'
          } else if (errorMessage.includes('User not found')) {
            errorMessage = 'Account verification failed. Please try logging out and back in.'
          }
        } else if (processError.context) {
          try {
            const errorContext = typeof processError.context === 'string' 
              ? JSON.parse(processError.context) 
              : processError.context
            
            if (errorContext.error) {
              errorMessage = errorContext.error
              
              // Add more user-friendly messages for common errors
              if (errorMessage.includes('Insufficient funds')) {
                errorMessage = 'Insufficient funds in the custodial wallet. Please try again later or contact support.'
              } else if (errorMessage.includes('Master mnemonic not configured')) {
                errorMessage = 'Withdrawal system is temporarily unavailable. Please contact support.'
              } else if (errorMessage.includes('User not found')) {
                errorMessage = 'Account verification failed. Please try logging out and back in.'
              }
            }
          } catch (parseError) {
            console.error('Error parsing context:', parseError)
          }
        } else if (processError.message) {
          errorMessage = processError.message
        }
        
        throw new Error(errorMessage)
      }
      
      if (processResult?.success) {
        setWithdrawSuccess(`Withdrawal successful! Transaction hash: ${processResult.transaction_hash}. Your ${amount} ${network.symbol} has been sent to your address.`)
      } else {
        throw new Error(processResult?.error || 'Withdrawal processing failed')
      }
      
      setWithdrawAmount('')
      setWithdrawAddress('')
      fetchUserBalance() // Refresh balance
      playSuccessSound()
      
    } catch (error: any) {
      console.error('Withdrawal error:', error)
      setWithdrawError(error.message || 'Failed to process withdrawal. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }
  
  if (!isOpen) return null

  const currentAddress = getCurrentAddress()
  const network = networkInfo[selectedNetwork]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-background/95 backdrop-blur-lg border-2 border-border/40 rounded-lg p-4">
        <button
          onClick={onClose}
          onMouseDown={playButtonClick}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wallet className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">
              {mode === 'deposit' ? 'Add Funds' : 'Withdraw Funds'}
            </h2>
          </div>
          <p className="text-sm text-gray-400">
            {mode === 'deposit' 
              ? 'Select a cryptocurrency to deposit funds' 
              : 'Select a cryptocurrency to withdraw funds'
            }
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
          </div>
        ) : (
          <>
            {/* Network Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select Network
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(networkInfo) as CryptoNetwork[]).map((network) => {
                  const info = networkInfo[network]
                  return (
                    <button
                      key={network}
                      onClick={() => {
                        playButtonClick()
                        setSelectedNetwork(network)
                      }}
                      className={`p-2 rounded-lg border-2 transition-all duration-200 ${
                        selectedNetwork === network
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-border/40 bg-background/30 hover:border-yellow-400/50'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`w-6 h-6 rounded-full ${info.color} flex items-center justify-center mx-auto mb-1 text-white font-bold text-xs`}>
                          {info.icon}
                        </div>
                        <div className="text-xs font-medium text-white">{info.symbol}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Deposit Status */}
            <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">Deposit Status</h4>
              <p className="text-xs text-blue-200/80">
                Deposits are automatically detected and credited to your account. 
                Processing time: 1-3 confirmations (~1-5 minutes).
              </p>
            </div>

            {/* Instructions */}
            {mode === 'deposit' && currentAddress && (
              <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">Deposit Instructions</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Send only {network.symbol} to this address</li>
                  <li>• Minimum deposit: {getMinDeposit()} {network.symbol}</li>
                  <li>• Funds will appear after network confirmation</li>
                  <li>• Do not send tokens from other networks</li>
                </ul>
              </div>
            )}

            {/* Address Display - Only for Deposit */}
            {mode === 'deposit' && (
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                  </div>
                ) : currentAddress ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Your {network.name} Address
                      </label>
                      <div className="flex items-center gap-2 bg-background/50 border border-border/40 rounded-lg px-3 py-2">
                        <div className={`w-6 h-6 rounded-full ${network.color} flex items-center justify-center text-white text-xs font-bold`}>
                          {network.icon}
                        </div>
                        <span className="text-sm font-mono flex-1">{formatAddress(currentAddress)}</span>
                        <button
                          onClick={() => copyToClipboard(currentAddress, selectedNetwork)}
                          onMouseDown={playButtonClick}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] text-xs h-8 w-8 p-0"
                        >
                          {copiedAddress === currentAddress ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => openExplorer(currentAddress, selectedNetwork)}
                          onMouseDown={playButtonClick}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-lg font-bold ring-offset-background transition-all duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer will-change-transform bg-transparent hover:bg-white/10 active:bg-white/15 text-white/90 border-2 border-white/55 shadow-[0_3px_0_#6B7280] hover:shadow-[0_1px_0_#6B7280] active:shadow-[0_0px_0_#6B7280] hover:translate-y-[2px] active:translate-y-[3px] text-xs h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No wallet address assigned</p>
                  </div>
                )}
              </div>
            )}

            {mode === 'withdraw' && (
              <div className="space-y-4">
                {/* Balance Display */}
                <div className="bg-background/50 border border-border/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Available Balance</span>
                    <span className="text-base font-bold text-green-400">
                      ${userBalance.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    ≈ {getMaxWithdrawal().toFixed(6)} {network.symbol}
                  </div>
                </div>

                {/* Withdrawal Form */}
                <div className="space-y-3">
                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Withdrawal Amount ({network.symbol})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.000001"
                        min={getMinWithdrawal()}
                        max={getMaxWithdrawal()}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-background/50 border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 text-white placeholder-gray-400"
                        placeholder={`Min: ${getMinWithdrawal()} ${network.symbol}`}
                      />
                      <button
                        onClick={() => setWithdrawAmount(getMaxWithdrawal().toString())}
                        onMouseDown={playButtonClick}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-yellow-400 text-black px-2 py-1 rounded hover:bg-yellow-500 transition-colors"
                      >
                        MAX
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Network fee: {getNetworkFee()} {network.symbol}
                    </div>
                  </div>
                  
                  {/* Address Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Withdrawal Address
                    </label>
                    <input
                      type="text"
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-background/50 border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 text-white placeholder-gray-400 font-mono text-xs"
                      placeholder={`Enter ${network.name} address`}
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Make sure this address supports {network.name} network
                    </div>
                  </div>
                  
                  {/* Error/Success Messages */}
                  {withdrawError && (
                    <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-red-400">{withdrawError}</span>
                    </div>
                  )}
                  
                  {withdrawSuccess && (
                    <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-2 flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-green-400">{withdrawSuccess}</span>
                    </div>
                  )}
                  
                  {/* Withdrawal Summary */}
                  {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                    <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-2">
                      <h4 className="text-sm font-semibold text-yellow-400 mb-2">Withdrawal Summary</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Amount:</span>
                          <span className="text-white">{withdrawAmount} {network.symbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Network Fee:</span>
                          <span className="text-white">{getNetworkFee()} {network.symbol}</span>
                        </div>
                        <div className="flex justify-between border-t border-yellow-400/20 pt-1">
                          <span className="text-yellow-400 font-medium">Total:</span>
                          <span className="text-yellow-400 font-medium">
                            {(parseFloat(withdrawAmount) + getNetworkFee()).toFixed(6)} {network.symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Withdraw Button */}
                  <button
                    onClick={processWithdrawal}
                    disabled={isProcessing || !withdrawAmount || !withdrawAddress}
                    onMouseDown={playButtonClick}
                    className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Withdraw {network.symbol}
                      </>
                    )}
                  </button>
                </div>
                
                {/* Withdrawal Info */}
                <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-400 mb-2">Important Information</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Minimum withdrawal: {getMinWithdrawal()} {network.symbol}</li>
                    <li>• Network fees are automatically deducted</li>
                    <li>• Processing time: 1-3 minutes</li>
                    <li>• Double-check the recipient address</li>
                    <li>• Withdrawals are irreversible</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}