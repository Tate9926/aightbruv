import WebSocket from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Polyfill fetch for Node.js
import fetch from 'node-fetch'
if (!globalThis.fetch) globalThis.fetch = fetch

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

class SolanaDepositListener {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SOLANA_WSS_URL) {
      throw new Error('Missing environment variables')
    }

    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    this.ws = null
    this.isConnected = false
    this.addressToUserMap = new Map()
    this.subscribedAddresses = new Set()
    this.subscriptionIdToAddress = new Map()
    this.addressBalances = new Map()
    this.reconnectAttempts = 0
    this.reconnectDelay = 5000
  }

  async start() {
    await this.connectWebSocket()
    await this.loadAndSubscribeAddresses()
  }

  async connectWebSocket() {
    this.ws = new WebSocket(process.env.SOLANA_WSS_URL)

    this.ws.on('open', () => {
      console.log('✅ SOLANA WSS connected')
      this.isConnected = true
      this.reconnectAttempts = 0

      // Test connection
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id: 999999, method: 'getVersion' }))
    })

    this.ws.on('message', (data) => this.handleMessage(data))
    this.ws.on('close', () => this.handleClose())
    this.ws.on('error', (err) => console.error('❌ SOLANA WSS error:', err))
  }

  handleClose() {
    console.log('🔌 SOLANA WSS disconnected')
    this.isConnected = false
    this.reconnectAttempts++
    if (this.reconnectAttempts <= 5) {
      console.log(`🔄 Reconnecting in ${this.reconnectDelay / 1000}s...`)
      setTimeout(() => this.connectWebSocket(), this.reconnectDelay)
    }
  }

  async loadAndSubscribeAddresses() {
    const { data: userAddresses, error } = await this.supabase
      .rpc('get_user_addresses_for_network', { network_name: 'solana' })

    if (error) return console.error('❌ Error fetching addresses:', error)
    console.log(`📊 Found ${userAddresses?.length || 0} SOLANA addresses`)

    for (const ua of userAddresses) {
      if (!ua.address) continue
      const address = ua.address.trim()
      this.addressToUserMap.set(address, ua.user_id)
      console.log(`📍 Loaded SOLANA address: ${address} -> user: ${ua.user_id}`)

      if (!this.subscribedAddresses.has(address) && this.isConnected) {
        await this.subscribeAddress(address)
        this.subscribedAddresses.add(address)
      }
    }
  }

  async subscribeAddress(address) {
    const subscriptionId = Math.floor(Math.random() * 1000000)
    const msg = {
      jsonrpc: '2.0',
      id: subscriptionId,
      method: 'accountSubscribe',
      params: [address, { encoding: 'base64', commitment: 'confirmed' }]
    }
    this.subscriptionIdToAddress.set(subscriptionId, address)
    console.log(`📡 Subscribing to SOLANA address: ${address} (ID: ${subscriptionId})`)
    this.ws.send(JSON.stringify(msg))
  }

  async handleMessage(data) {
    const message = JSON.parse(data.toString())
    console.log('🔍 Full SOLANA message:', JSON.stringify(message, null, 2))

    // Test connection response
    if (message.id === 999999 && message.result) {
      console.log('✅ SOLANA connection test successful:', message.result)
      return
    }

    // Subscription confirmation
    if (message.result && typeof message.result === 'number') {
      const address = this.subscriptionIdToAddress.get(message.id)
      if (address) {
        console.log(`✅ Subscribed to ${address} with subscription ID ${message.result}`)
        this.subscriptionIdToAddress.set(message.result, address)
      }
      return
    }

    // Account change notification
    if (message.method === 'accountNotification' && message.params) {
      console.log('🎯 SOLANA ACCOUNT CHANGE DETECTED!')
      await this.processAccountChange(message.params)
    }
  }

  async processAccountChange(params) {
    const { result, subscription } = params
    if (!result || !result.value) return

    const newBalance = result.value.lamports || 0
    const address = this.subscriptionIdToAddress.get(subscription)
    if (!address) return console.warn('⚠️ Unknown subscription ID:', subscription)

    const prevBalance = this.addressBalances.get(address) || 0
    const balanceIncrease = newBalance - prevBalance
    this.addressBalances.set(address, newBalance)

    console.log(`   Address: ${address}`)
    console.log(`   New Balance: ${newBalance / 1e9} SOL`)

    if (balanceIncrease > 0) {
      console.log(`💰 DEPOSIT DETECTED: ${balanceIncrease / 1e9} SOL`)
      const userId = this.addressToUserMap.get(address)
      if (!userId) return console.warn('⚠️ No user for address', address)
      // Here you can call your creditUserDeposit() logic
    }
  }
}

const listener = new SolanaDepositListener()
listener.start().catch(console.error)
