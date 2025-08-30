import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fetch from 'node-fetch'
import { SolanaAutoTransfer } from './auto-transfer.js'
import cryptoPrices from './crypto-prices.js'

// Polyfill fetch for Node.js
if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') })

class SolanaDepositListener {
  constructor() {
    this.ws = null
    this.isConnected = false
    
    // Initialize auto-transfer service
    this.autoTransfer = new SolanaAutoTransfer()
    
    this.subscribedAddresses = new Set()
    this.addressToUserMap = new Map()
    this.subscriptionIdToAddress = new Map()
    this.addressBalances = new Map() // Track previous balances
    this.reconnectAttempts = 0
    this.reconnectDelay = 5000
    
    // Validate environment variables
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is required')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
    }
    if (!process.env.SOLANA_WSS_URL) {
      throw new Error('SOLANA_WSS_URL environment variable is required')
    }
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          fetch: fetch
        }
      }
    )
    
    console.log('🚀 Solana Deposit Listener initialized')
  }

  async start() {
    console.log('🔌 Starting WebSocket connection...')
    await this.connectWebSocket()
    await this.loadAndSubscribeAddresses()
    
    // Refresh addresses every 5 minutes
    setInterval(() => {
      this.loadAndSubscribeAddresses()
    }, 5 * 60 * 1000)
    
    console.log('✅ Deposit listener is running!')
  }

  async connectWebSocket() {
    try {
      this.ws = new WebSocket(process.env.SOLANA_WSS_URL)
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected to Solana')
        this.isConnected = true
        this.reconnectAttempts = 0
      })

      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data)
      })

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket disconnected: ${code} - ${reason}`)
        this.isConnected = false
        this.attemptReconnect()
      })

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        this.isConnected = false
      })

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
        
        this.ws.once('open', () => {
          clearTimeout(timeout)
          resolve()
        })
        
        this.ws.once('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error)
      this.attemptReconnect()
    }
  }

  async attemptReconnect() {
    if (this.reconnectAttempts >= 5) {
      console.error('❌ Max reconnection attempts reached. Exiting...')
      process.exit(1)
    }

    this.reconnectAttempts++
    console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/5)`)
    
    setTimeout(() => {
      this.connectWebSocket()
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  async loadAndSubscribeAddresses() {
    try {
      console.log('📋 Loading user addresses from database...')
      
      const { data: userAddresses, error } = await this.supabase
        .rpc('get_user_addresses_for_network', { network_name: 'solana' })

      if (error) {
        console.error('❌ Error loading user addresses:', error)
        return
      }

      console.log(`📊 Found ${userAddresses?.length || 0} user addresses`)

      // Clear existing maps
      this.addressToUserMap.clear()
      const newAddresses = new Set()

      // Build address mapping
      userAddresses?.forEach((ua) => {
        if (ua.address) {
          const address = ua.address.trim()
          newAddresses.add(address)
          this.addressToUserMap.set(address, ua.user_id)
          console.log(`📍 Loaded address: ${address} -> user: ${ua.user_id}`)
        }
      })

      // Subscribe to new addresses
      if (this.ws && this.isConnected) {
        for (const address of newAddresses) {
          if (!this.subscribedAddresses.has(address)) {
            await this.subscribeToAddress(address)
            this.subscribedAddresses.add(address)
          }
        }
        console.log(`📡 Subscribed to ${this.subscribedAddresses.size} addresses`)
      } else {
        console.log('⚠️ WebSocket not ready for subscriptions')
      }

    } catch (error) {
      console.error('❌ Error loading user addresses:', error)
    }
  }

  async subscribeToAddress(address) {
    if (!this.ws || !this.isConnected) {
      console.log('⚠️ WebSocket not ready for subscription')
      return
    }

    try {
      const subscriptionId = Math.floor(Math.random() * 1000000)

      const subscribeMessage = {
        jsonrpc: '2.0',
        id: subscriptionId,
        method: 'accountSubscribe',
        params: [
          address,
          { encoding: 'base64', commitment: 'confirmed' }
        ]
      }

      console.log(`📡 Subscribing to account changes for address: ${address} (ID: ${subscriptionId})`)
      this.ws.send(JSON.stringify(subscribeMessage))
      
      // Map subscription ID to address
      this.subscriptionIdToAddress.set(subscriptionId, address)
      // Small delay between subscriptions
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`❌ Error subscribing to address ${address}:`, error)
    }
  }

  async handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data.toString())
      
      // Log all messages for debugging
      console.log('📨 WebSocket message:', JSON.stringify(message, null, 2))

      // Handle subscription confirmations
      if (message.result && typeof message.result === 'number') {
        const address = this.subscriptionIdToAddress.get(message.id)
        if (address) {
          console.log(`✅ Account subscription confirmed for ${address}: ID ${message.result}`)
          // Update mapping with server-assigned subscription ID
          this.subscriptionIdToAddress.set(message.result, address)
        }
        return
      }

      // Handle account change notifications
      if (message.method === 'accountNotification' && message.params) {
        console.log('🎯 ACCOUNT CHANGE DETECTED!')
        console.log('📨 Full notification:', JSON.stringify(message.params, null, 2))
        await this.processAccountChange(message.params)
        return  
      }

      // Handle errors
      if (message.error) {
        console.error('❌ WebSocket error response:', message.error)
        return
      }

    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error)
    }
  }

  async processAccountChange(params) {
    try {
      const { result, subscription } = params
      
      if (!result || !result.value) {
        console.log('⚠️ No account data')
        return
      }
      
      const newBalance = result.value.lamports || 0
      const newBalanceSOL = newBalance / 1e9

      // Find address for this subscription
      let address = null
      for (const [subId, addr] of this.subscriptionIdToAddress.entries()) {
        if (subId === subscription) {
          address = addr
          break
        }
      }
      
      if (!address) {
        console.log(`⚠️ Unknown subscription ID: ${subscription}`)
        return
      }

      console.log(`🎯 BALANCE CHANGE DETECTED!`)
      console.log(`   Address: ${address}`)
      console.log(`   New Balance: ${newBalanceSOL.toFixed(9)} SOL`)

      // Check if balance increased (deposit)
      const previousBalance = this.addressBalances.get(address) || 0
      const balanceIncrease = newBalance - previousBalance
      
      if (balanceIncrease > 0) {
        const depositAmount = balanceIncrease / 1e9
        console.log(`💰 DEPOSIT DETECTED: ${depositAmount.toFixed(9)} SOL`)
        
        const userId = this.addressToUserMap.get(address)
        if (!userId) {
          console.log(`⚠️ No user found for address: ${address}`)
          // Update stored balance even if no user found
          this.addressBalances.set(address, newBalance)
          return
        }

        console.log(`💰 DEPOSIT DETECTED for ${address}:`)
        console.log(`   User: ${userId}`)
        console.log(`   Amount: ${depositAmount.toFixed(9)} SOL`)
        
        await this.creditUserDeposit(userId, address, depositAmount, `balance_change_${Date.now()}`)
      } else {
        console.log(`📊 Balance decreased or unchanged: ${(balanceIncrease / 1e9).toFixed(9)} SOL`)
      }

      // Update stored balance
      this.addressBalances.set(address, newBalance)

    } catch (error) {
      console.error('❌ Error processing account change:', error)
    }
  }

  async creditUserDeposit(userId, address, solAmount, transactionHash) {
    try {
      // Use real-time SOL price instead of static rate
      const usdAmount = cryptoPrices.convertToUSD(solAmount, 'solana')
      
      console.log(`💳 Crediting user ${userId}:`)
      console.log(`   Amount: ${solAmount.toFixed(9)} SOL = $${usdAmount.toFixed(2)}`)
      console.log(`   Rate: ${cryptoPrices.getFormattedPrice('solana')}`)
      console.log(`   Address: ${address}`)

      // Test Supabase connection first
      console.log('🔍 Testing Supabase connection...')
      const { data: testData, error: testError } = await this.supabase
        .from('profiles')
        .select('id')
        .limit(1)

      if (testError) {
        console.error('❌ Supabase connection test failed:', testError)
        return
      }
      console.log('✅ Supabase connection working')

      // Check if this deposit already exists
      console.log('🔍 Checking for existing deposit...')
      const { data: existingDeposit } = await this.supabase
        .from('pending_deposits')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_hash', transactionHash)
        .eq('network', 'solana')
        .single()

      if (existingDeposit) {
        console.log('⚠️ Deposit already processed, skipping...')
        return
      }

      console.log('📡 Creating deposit record...')
      // Create pending deposit record
      const { error: depositError } = await this.supabase
        .from('pending_deposits')
        .insert({
          user_id: userId,
          network: 'solana',
          transaction_hash: transactionHash,
          from_address: 'unknown',
          to_address: address,
          amount_crypto: solAmount,
          amount_usd: usdAmount,
          block_number: 0,
          block_hash: '',
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmations: 1
        })

      if (depositError) {
        console.error('❌ Error creating deposit record:', depositError)
        return
      }
      console.log('✅ Deposit record created')

      console.log('💰 Updating user balance...')
      // Credit user balance in profiles table
      // Get current balance first
      const { data: currentProfile, error: fetchError } = await this.supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching user profile:', fetchError)
        return
      }

      const currentBalance = currentProfile?.balance || 0
      const newBalance = currentBalance + usdAmount
      
      console.log(`💰 Balance update: $${currentBalance.toFixed(2)} + $${usdAmount.toFixed(2)} = $${newBalance.toFixed(2)}`)

      // Update balance with new total
      const { error: balanceError } = await this.supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId)

      if (balanceError) {
        console.error('❌ Error updating user balance:', balanceError)
        console.error('❌ Balance error details:', JSON.stringify(balanceError, null, 2))
        return
      } else {
        console.log(`💰 Balance updated: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`)
      }

    console.log('📝 Creating transaction record...')
      // Create transaction record
      const { error: txError } = await this.supabase
        .from('deposit_transactions')
        .insert({
          user_id: userId,
          network: 'solana',
          transaction_hash: transactionHash,
          from_address: 'unknown',
          to_address: address,
          amount_crypto: solAmount,
          amount_usd: usdAmount,
          block_number: 0,
          block_hash: '',
          confirmations: 1
        })

      if (txError) {
        console.error('❌ Error creating transaction record:', txError)
        console.error('❌ Transaction error details:', JSON.stringify(txError, null, 2))
      } else {
        console.log('✅ Transaction record created')
      }

    // 🚀 AUTOMATIC SWEEP: Transfer funds to collection wallet
    console.log('🚀 Starting automatic sweep...')
    try {
      // Get user's account index from database
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('account_index')
        .eq('id', userId)
        .single()

      const accountIndex = profile?.account_index || 0
      
      const sweepResult = await this.autoTransfer.processTransferForUser(
        userId, 
        accountIndex, 
        `Auto-sweep for deposit ${transactionHash}`
      )
      
      if (sweepResult) {
        console.log(`✅ Auto-sweep successful: ${sweepResult.amountSOL.toFixed(9)} SOL transferred`)
      } else {
        console.log('⚠️ No funds to sweep (already empty)')
      }
    } catch (sweepError) {
      console.error('❌ Auto-sweep failed:', sweepError.message)
      // Don't fail the deposit - just log the sweep error
    }
    
      console.log(`✅ Successfully credited user ${userId} with $${usdAmount.toFixed(2)}`)

    } catch (error) {
      console.error('❌ Error crediting user deposit:', error)
      console.error('❌ Full error details:', JSON.stringify(error, null, 2))
    }
  }

}

// Start the deposit listener
const listener = new SolanaDepositListener()
listener.start().catch(error => {
  console.error('❌ Failed to start deposit listener:', error)
  process.exit(1)
})

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down deposit listener...')
  if (listener.ws) {
    listener.ws.close()
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down deposit listener...')
  if (listener.ws) {
    listener.ws.close()
  }
  process.exit(0)
})