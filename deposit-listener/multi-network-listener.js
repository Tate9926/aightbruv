import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fetch from 'node-fetch'
import cryptoPrices from './crypto-prices.js'
import { MultiNetworkAutoTransfer } from './multi-network-auto-transfer.js'

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

class MultiNetworkDepositListener {
  constructor() {
    // Initialize auto-transfer service
    this.autoTransfer = new MultiNetworkAutoTransfer()
    
    this.connections = {
      solana: { ws: null, isConnected: false },
      ethereum: { ws: null, isConnected: false },
      tron: { ws: null, isConnected: false }
    }
    
    this.subscribedAddresses = {
      solana: new Set(),
      ethereum: new Set(),
      tron: new Set()
    }
    
    this.addressToUserMap = {
      solana: new Map(),
      ethereum: new Map(),
      tron: new Map()
    }
    
    this.addressBalances = {
      solana: new Map(),
      ethereum: new Map(),
      tron: new Map()
    }
    
    this.subscriptionIdToAddress = {
      solana: new Map(),
      ethereum: new Map(),
      tron: new Map()
    }
    
    this.reconnectAttempts = {
      solana: 0,
      ethereum: 0,
      tron: 0
    }
    
    this.reconnectDelay = 5000
    
    // Validate environment variables
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is required')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
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
    
    console.log('🚀 Multi-Network Deposit Listener initialized')
  }

  async start() {
    console.log('🔌 Starting WebSocket connections for all networks...')
    
    // Start connections for all networks
    const networks = ['solana', 'ethereum', 'tron']
    
    for (const network of networks) {
      const wsUrl = this.getWebSocketUrl(network)
      if (wsUrl) {
        await this.connectWebSocket(network, wsUrl)
        await this.loadAndSubscribeAddresses(network)
      } else {
        console.log(`⚠️ No WebSocket URL configured for ${network}`)
      }
    }
    
    // Refresh addresses every 5 minutes
    setInterval(() => {
      networks.forEach(network => {
        if (this.connections[network].isConnected) {
          this.loadAndSubscribeAddresses(network)
        }
      })
    }, 5 * 60 * 1000)
    
    console.log('✅ Multi-network deposit listener is running!')
  }

  getWebSocketUrl(network) {
    switch (network) {
      case 'solana':
        return process.env.SOLANA_WSS_URL
      case 'ethereum':
        return process.env.ETHEREUM_WSS_URL // Your private Ethereum WSS
      case 'tron':
        return process.env.TRON_WSS_URL // Your private Tron WSS
      default:
        return null
    }
  }

  async connectWebSocket(network, wsUrl) {
    try {
      console.log(`🔌 Connecting to ${network.toUpperCase()} WebSocket: ${wsUrl}`)
      
      const ws = new WebSocket(wsUrl)
      this.connections[network].ws = ws
      
      ws.on('open', () => {
        console.log(`✅ ${network.toUpperCase()} WebSocket connected`)
        this.connections[network].isConnected = true
        this.reconnectAttempts[network] = 0
      })

      ws.on('message', (data) => {
        this.handleWebSocketMessage(network, data)
      })

      ws.on('close', (code, reason) => {
        console.log(`🔌 ${network.toUpperCase()} WebSocket disconnected: ${code} - ${reason}`)
        this.connections[network].isConnected = false
        this.attemptReconnect(network, wsUrl)
      })

      ws.on('error', (error) => {
        console.error(`❌ ${network.toUpperCase()} WebSocket error:`, error)
        this.connections[network].isConnected = false
      })

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
        
        ws.once('open', () => {
          clearTimeout(timeout)
          resolve()
        })
        
        ws.once('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

    } catch (error) {
      console.error(`❌ Failed to connect ${network.toUpperCase()} WebSocket:`, error)
      this.attemptReconnect(network, wsUrl)
    }
  }

  async attemptReconnect(network, wsUrl) {
    if (this.reconnectAttempts[network] >= 5) {
      console.error(`❌ Max reconnection attempts reached for ${network.toUpperCase()}`)
      return
    }

    this.reconnectAttempts[network]++
    console.log(`🔄 Attempting to reconnect ${network.toUpperCase()}... (${this.reconnectAttempts[network]}/5)`)
    
    setTimeout(() => {
      this.connectWebSocket(network, wsUrl)
    }, this.reconnectDelay * this.reconnectAttempts[network])
  }

  async loadAndSubscribeAddresses(network) {
    try {
      console.log(`📋 Loading ${network.toUpperCase()} addresses from database...`)
      
      const { data: userAddresses, error } = await this.supabase
        .rpc('get_user_addresses_for_network', { network_name: network })

      if (error) {
        console.error(`❌ Error loading ${network.toUpperCase()} addresses:`, error)
        return
      }

      console.log(`📊 Found ${userAddresses?.length || 0} ${network.toUpperCase()} addresses`)

      // Clear existing maps
      this.addressToUserMap[network].clear()
      const newAddresses = new Set()

      // Build address mapping
      userAddresses?.forEach((ua) => {
        if (ua.address) {
          const address = ua.address.trim()
          newAddresses.add(address)
          this.addressToUserMap[network].set(address, ua.user_id)
          console.log(`📍 Loaded ${network.toUpperCase()} address: ${address} -> user: ${ua.user_id}`)
        }
      })

      // Subscribe to new addresses
      if (this.connections[network].ws && this.connections[network].isConnected) {
        for (const address of newAddresses) {
          if (!this.subscribedAddresses[network].has(address)) {
            await this.subscribeToAddress(network, address)
            this.subscribedAddresses[network].add(address)
          }
        }
        console.log(`📡 Subscribed to ${this.subscribedAddresses[network].size} ${network.toUpperCase()} addresses`)
      } else {
        console.log(`⚠️ ${network.toUpperCase()} WebSocket not ready for subscriptions`)
      }

    } catch (error) {
      console.error(`❌ Error loading ${network.toUpperCase()} addresses:`, error)
    }
  }

  async subscribeToAddress(network, address) {
    const ws = this.connections[network].ws
    if (!ws || !this.connections[network].isConnected) {
      console.log(`⚠️ ${network.toUpperCase()} WebSocket not ready for subscription`)
      return
    }

    try {
      const subscriptionId = Math.floor(Math.random() * 1000000)
      let subscribeMessage

      switch (network) {
        case 'solana':
          subscribeMessage = {
            jsonrpc: '2.0',
            id: subscriptionId,
            method: 'accountSubscribe',
            params: [
              address,
              { encoding: 'base64', commitment: 'confirmed' }
            ]
          }
          break
          
        case 'ethereum':
          // Ethereum WebSocket subscription for balance changes
          subscribeMessage = {
            jsonrpc: '2.0',
            id: subscriptionId,
            method: 'eth_subscribe',
            params: [
              'logs',
              {
                address: address,
                topics: []
              }
            ]
          }
          break
          
        case 'tron':
          // Tron WebSocket subscription (depends on your Tron WSS provider)
          subscribeMessage = {
            jsonrpc: '2.0',
            id: subscriptionId,
            method: 'subscribe',
            params: [
              'account',
              {
                address: address
              }
            ]
          }
          break
      }

      console.log(`📡 Subscribing to ${network.toUpperCase()} address: ${address} (ID: ${subscriptionId})`)
      ws.send(JSON.stringify(subscribeMessage))
      
      // Map subscription ID to address
      this.subscriptionIdToAddress[network].set(subscriptionId, address)
      
      // Small delay between subscriptions
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`❌ Error subscribing to ${network.toUpperCase()} address ${address}:`, error)
    }
  }

  async handleWebSocketMessage(network, data) {
    try {
      const message = JSON.parse(data.toString())
      
      // Log messages for debugging
      console.log(`📨 ${network.toUpperCase()} WebSocket message:`, JSON.stringify(message, null, 2))

      // Handle subscription confirmations
      if (message.result && typeof message.result === 'number') {
        const address = this.subscriptionIdToAddress[network].get(message.id)
        if (address) {
          console.log(`✅ ${network.toUpperCase()} subscription confirmed for ${address}: ID ${message.result}`)
          this.subscriptionIdToAddress[network].set(message.result, address)
        }
        return
      }

      // Handle network-specific notifications
      switch (network) {
        case 'solana':
          await this.handleSolanaNotification(message)
          break
        case 'ethereum':
          await this.handleEthereumNotification(message)
          break
        case 'tron':
          await this.handleTronNotification(message)
          break
      }

      // Handle errors
      if (message.error) {
        console.error(`❌ ${network.toUpperCase()} WebSocket error response:`, message.error)
        return
      }

    } catch (error) {
      console.error(`❌ Error processing ${network.toUpperCase()} WebSocket message:`, error)
    }
  }

  async handleSolanaNotification(message) {
    if (message.method === 'accountNotification' && message.params) {
      console.log('🎯 SOLANA ACCOUNT CHANGE DETECTED!')
      await this.processAccountChange('solana', message.params)
    }
  }

  async handleEthereumNotification(message) {
    if (message.method === 'eth_subscription' && message.params) {
      console.log('🎯 ETHEREUM TRANSACTION DETECTED!')
      await this.processEthereumTransaction(message.params)
    }
  }

  async handleTronNotification(message) {
    if (message.method === 'notification' && message.params) {
      console.log('🎯 TRON TRANSACTION DETECTED!')
      await this.processTronTransaction(message.params)
    }
  }

  async processAccountChange(network, params) {
    try {
      const { result, subscription } = params
      
      if (!result || !result.value) {
        console.log(`⚠️ No ${network.toUpperCase()} account data`)
        return
      }
      
      let newBalance, address
      
      if (network === 'solana') {
        newBalance = result.value.lamports || 0
        
        // Find address for this subscription
        for (const [subId, addr] of this.subscriptionIdToAddress[network].entries()) {
          if (subId === subscription) {
            address = addr
            break
          }
        }
      }
      
      if (!address) {
        console.log(`⚠️ Unknown ${network.toUpperCase()} subscription ID: ${subscription}`)
        return
      }

      const newBalanceCrypto = this.convertToMainUnit(newBalance, network)
      console.log(`🎯 ${network.toUpperCase()} BALANCE CHANGE DETECTED!`)
      console.log(`   Address: ${address}`)
      console.log(`   New Balance: ${newBalanceCrypto.toFixed(9)} ${network.toUpperCase()}`)

      // Check if balance increased (deposit)
      const previousBalance = this.addressBalances[network].get(address) || 0
      const balanceIncrease = newBalance - previousBalance
      
      if (balanceIncrease > 0) {
        const depositAmount = this.convertToMainUnit(balanceIncrease, network)
        console.log(`💰 ${network.toUpperCase()} DEPOSIT DETECTED: ${depositAmount.toFixed(9)} ${network.toUpperCase()}`)
        
        const userId = this.addressToUserMap[network].get(address)
        if (!userId) {
          console.log(`⚠️ No user found for ${network.toUpperCase()} address: ${address}`)
          this.addressBalances[network].set(address, newBalance)
          return
        }

        await this.creditUserDeposit(network, userId, address, depositAmount, `balance_change_${Date.now()}`)
      }

      // Update stored balance
      this.addressBalances[network].set(address, newBalance)

    } catch (error) {
      console.error(`❌ Error processing ${network.toUpperCase()} account change:`, error)
    }
  }

  async processEthereumTransaction(params) {
    // Handle Ethereum transaction notifications
    // This depends on your specific Ethereum WSS provider format
    console.log('Processing Ethereum transaction:', params)
  }

  async processTronTransaction(params) {
    // Handle Tron transaction notifications  
    // This depends on your specific Tron WSS provider format
    console.log('Processing Tron transaction:', params)
  }

  convertToMainUnit(amount, network) {
    switch (network) {
      case 'solana':
        return amount / 1e9 // lamports to SOL
      case 'ethereum':
        return amount / 1e18 // wei to ETH
      case 'tron':
        return amount / 1e6 // sun to TRX
      default:
        return amount
    }
  }

  async creditUserDeposit(network, userId, address, cryptoAmount, transactionHash) {
    try {
      // Use real-time price conversion
      const usdAmount = cryptoPrices.convertToUSD(cryptoAmount, network)
      
      console.log(`💳 Crediting ${network.toUpperCase()} deposit for user ${userId}:`)
      console.log(`   Amount: ${cryptoAmount.toFixed(9)} ${network.toUpperCase()} = $${usdAmount.toFixed(2)}`)
      console.log(`   Rate: ${cryptoPrices.getFormattedPrice(network)}`)
      console.log(`   Address: ${address}`)

      // Check if this deposit already exists
      const { data: existingDeposit } = await this.supabase
        .from('pending_deposits')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_hash', transactionHash)
        .eq('network', network)
        .single()

      if (existingDeposit) {
        console.log('⚠️ Deposit already processed, skipping...')
        return
      }

      // Create pending deposit record
      const { error: depositError } = await this.supabase
        .from('pending_deposits')
        .insert({
          user_id: userId,
          network: network,
          transaction_hash: transactionHash,
          from_address: 'unknown',
          to_address: address,
          amount_crypto: cryptoAmount,
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

      // Credit user balance
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

      const { error: balanceError } = await this.supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId)

      if (balanceError) {
        console.error('❌ Error updating user balance:', balanceError)
        return
      }

      // Create transaction record
      const { error: txError } = await this.supabase
        .from('deposit_transactions')
        .insert({
          user_id: userId,
          network: network,
          transaction_hash: transactionHash,
          from_address: 'unknown',
          to_address: address,
          amount_crypto: cryptoAmount,
          amount_usd: usdAmount,
          block_number: 0,
          block_hash: '',
          confirmations: 1
        })

      if (txError) {
        console.error('❌ Error creating transaction record:', txError)
      }

      // 🚀 AUTOMATIC SWEEP: Transfer funds to collection wallet
      console.log(`🚀 Starting automatic ${network.toUpperCase()} sweep...`)
      try {
        // Get user's account index from database
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('account_index')
          .eq('id', userId)
          .single()

        const accountIndex = profile?.account_index || 0
        
        const sweepResult = await this.autoTransfer.processTransferForUser(
          network,
          userId, 
          accountIndex, 
          `Auto-sweep for ${network} deposit ${transactionHash}`
        )
        
        if (sweepResult) {
          console.log(`✅ Auto-sweep successful: ${sweepResult.amountCrypto.toFixed(9)} ${network.toUpperCase()} transferred`)
        } else {
          console.log('⚠️ No funds to sweep (already empty)')
        }
      } catch (sweepError) {
        console.error(`❌ Auto-sweep failed for ${network.toUpperCase()}:`, sweepError.message)
        // Don't fail the deposit - just log the sweep error
      }
      
      console.log(`✅ Successfully credited user ${userId} with $${usdAmount.toFixed(2)} from ${network.toUpperCase()} deposit`)

    } catch (error) {
      console.error(`❌ Error crediting ${network.toUpperCase()} deposit:`, error)
    }
  }
}

// Start the multi-network deposit listener
const listener = new MultiNetworkDepositListener()
listener.start().catch(error => {
  console.error('❌ Failed to start multi-network deposit listener:', error)
  process.exit(1)
})

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down multi-network deposit listener...')
  Object.values(listener.connections).forEach(conn => {
    if (conn.ws) {
      conn.ws.close()
    }
  })
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down multi-network deposit listener...')
  Object.values(listener.connections).forEach(conn => {
    if (conn.ws) {
      conn.ws.close()
    }
  })
  process.exit(0)
})