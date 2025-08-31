import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fetch from 'node-fetch'
import cryptoPrices from './crypto-prices.js'
import { MultiNetworkAutoTransfer } from './multi-network-auto-transfer.js'
import dotenv from 'dotenv'

// Polyfill fetch for Node.js
if (!globalThis.fetch) globalThis.fetch = fetch

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

class SolanaDepositListener {
  constructor() {
    this.autoTransfer = new MultiNetworkAutoTransfer()

    this.ws = null
    this.isConnected = false
    this.subscribedAddresses = new Set()
    this.addressToUserMap = new Map()
    this.addressBalances = new Map()
    this.subscriptionIdToAddress = new Map()
    this.reconnectAttempts = 0
    this.reconnectDelay = 5000

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SOLANA_WSS_URL) {
      throw new Error('Missing required environment variables')
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch } }
    )

    console.log('🚀 Solana Deposit Listener initialized')
  }

  async start() {
    console.log('🔌 Connecting to Solana WebSocket...')
    await this.connectWebSocket()
    await this.loadAndSubscribeAddresses()

    // Refresh addresses every 5 minutes
    setInterval(() => this.loadAndSubscribeAddresses(), 5 * 60 * 1000)
    console.log('✅ Solana deposit listener is running!')
  }

  async connectWebSocket() {
    const wsUrl = process.env.SOLANA_WSS_URL
    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.on('open', () => {
        console.log('✅ Solana WebSocket connected')
        this.isConnected = true
        this.reconnectAttempts = 0

        // Test message
        const testMessage = { jsonrpc: '2.0', id: 999999, method: 'getVersion' }
        this.ws.send(JSON.stringify(testMessage))
      })

      this.ws.on('message', data => this.handleWebSocketMessage(data))

      this.ws.on('close', () => {
        console.log('🔌 Solana WebSocket disconnected')
        this.isConnected = false
        this.attemptReconnect()
      })

      this.ws.on('error', err => {
        console.error('❌ Solana WebSocket error:', err)
        this.isConnected = false
      })

      // Wait for open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
        this.ws.once('open', () => {
          clearTimeout(timeout)
          resolve()
        })
        this.ws.once('error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    } catch (error) {
      console.error('❌ Failed to connect Solana WebSocket:', error)
      this.attemptReconnect()
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= 5) return console.error('❌ Max reconnection attempts reached for Solana')
    this.reconnectAttempts++
    console.log(`🔄 Attempting to reconnect Solana... (${this.reconnectAttempts}/5)`)
    setTimeout(() => this.connectWebSocket(), this.reconnectDelay * this.reconnectAttempts)
  }

  async loadAndSubscribeAddresses() {
    try {
      console.log('📋 Loading Solana addresses from database...')
      const { data: userAddresses, error } = await this.supabase.rpc('get_user_addresses_for_network', { network_name: 'solana' })
      if (error) return console.error('❌ Error loading Solana addresses:', error)
      console.log(`📊 Found ${userAddresses?.length || 0} addresses`)

      userAddresses?.forEach(ua => {
        if (!ua.address) return
        const address = ua.address.trim()
        this.addressToUserMap.set(address, ua.user_id)
        if (!this.subscribedAddresses.has(address)) this.subscribeToAddress(address)
      })
    } catch (error) {
      console.error('❌ Error loading Solana addresses:', error)
    }
  }

  subscribeToAddress(address) {
    if (!this.ws || !this.isConnected) return console.warn('⚠️ Solana WebSocket not ready for subscription')
    const subscriptionId = Math.floor(Math.random() * 1000000)
    const subscribeMessage = { jsonrpc: '2.0', id: subscriptionId, method: 'accountSubscribe', params: [address, { encoding: 'base64', commitment: 'confirmed' }] }

    this.ws.send(JSON.stringify(subscribeMessage))
    this.subscriptionIdToAddress.set(subscriptionId, address)
    this.subscribedAddresses.add(address)
    console.log(`📡 Subscribing to Solana address: ${address} (ID: ${subscriptionId})`)
  }

  async handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data.toString())
      // Test response
      if (message.id === 999999 && message.result) return console.log('✅ Solana WebSocket test successful:', message.result)

      // Subscription confirmation
      if (message.result && typeof message.result === 'number') {
        const address = this.subscriptionIdToAddress.get(message.id)
        if (address) {
          this.subscriptionIdToAddress.set(message.result, address)
          console.log(`🔔 Now monitoring ${address} for deposits`)
        }
        return
      }

      // Account notification
      if (message.method === 'accountNotification' && message.params) {
        await this.processAccountChange(message.params)
      }

      if (message.error) console.error('❌ Solana WebSocket error response:', message.error)
    } catch (error) {
      console.error('❌ Error processing Solana WebSocket message:', error)
    }
  }

  async processAccountChange(params) {
    try {
      const { result, subscription } = params
      if (!result || !result.value) return

      const newBalance = result.value.lamports || 0
      const address = this.subscriptionIdToAddress.get(subscription)
      if (!address) return console.warn('⚠️ Unknown subscription ID:', subscription)

      const previousBalance = this.addressBalances.get(address) || 0
      const balanceIncrease = newBalance - previousBalance
      this.addressBalances.set(address, newBalance)

      if (balanceIncrease > 0) {
        const depositAmount = balanceIncrease / 1e9
        const userId = this.addressToUserMap.get(address)
        if (!userId) return console.warn('⚠️ No user for address:', address)
        console.log(`💰 Solana deposit detected for user ${userId}: ${depositAmount} SOL`)
        await this.creditUserDeposit(userId, address, depositAmount)
      }
    } catch (error) {
      console.error('❌ Error processing Solana account change:', error)
    }
  }

  async creditUserDeposit(userId, address, cryptoAmount) {
    try {
      const usdAmount = cryptoPrices.convertToUSD(cryptoAmount, 'solana')
      console.log(`💳 Crediting user ${userId}: ${cryptoAmount} SOL = $${usdAmount.toFixed(2)}`)

      // Insert pending deposit
      await this.supabase.from('pending_deposits').insert({
        user_id: userId, network: 'solana', transaction_hash: `balance_change_${Date.now()}`,
        from_address: 'unknown', to_address: address,
        amount_crypto: cryptoAmount, amount_usd: usdAmount,
        block_number: 0, block_hash: '', status: 'confirmed', confirmed_at: new Date().toISOString(), confirmations: 1
      })

      // Update user balance
      const { data: profile } = await this.supabase.from('profiles').select('balance').eq('id', userId).single()
      const currentBalance = profile?.balance || 0
      await this.supabase.from('profiles').update({ balance: currentBalance + usdAmount }).eq('id', userId)

      // Auto-sweep
      const { data: userProfile } = await this.supabase.from('profiles').select('account_index').eq('id', userId).single()
      const sweepResult = await this.autoTransfer.processTransferForUser('solana', userId, userProfile?.account_index || 0, `Auto-sweep for Solana deposit`)
      if (sweepResult) console.log(`✅ Auto-sweep successful: ${sweepResult.amountCrypto} SOL transferred`)
    } catch (error) {
      console.error('❌ Error crediting Solana deposit:', error)
    }
  }
}

// Start Solana listener
const listener = new SolanaDepositListener()
listener.start().catch(err => console.error('❌ Failed to start Solana listener:', err))

// Graceful shutdown
process.on('SIGINT', () => { console.log('🛑 Shutting down Solana listener'); listener.ws?.close(); process.exit(0) })
process.on('SIGTERM', () => { console.log('🛑 Shutting down Solana listener'); listener.ws?.close(); process.exit(0) })
