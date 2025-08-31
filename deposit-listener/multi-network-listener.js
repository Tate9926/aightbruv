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

// Current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') })

class MultiNetworkDepositListener {
  constructor() {
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

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch } }
    )

    console.log('🚀 Multi-Network Deposit Listener initialized')
  }

  async start() {
    console.log('🔌 Starting WebSocket connections for all networks...')
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

    setInterval(() => {
      networks.forEach(async network => {
        if (this.connections[network].isConnected) await this.loadAndSubscribeAddresses(network)
      })
    }, 5 * 60 * 1000)

    console.log('✅ Multi-network deposit listener is running!')
  }

  getWebSocketUrl(network) {
    switch (network) {
      case 'solana': return process.env.SOLANA_WSS_URL
      case 'ethereum': return process.env.ETHEREUM_WSS_URL
      case 'tron': return process.env.TRON_WSS_URL
      default: return null
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

        if (network === 'solana') {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: 999999, method: 'getVersion' }))
          console.log('🧪 Sent Solana test message')
        }
      })

      ws.on('message', data => this.handleWebSocketMessage(network, data))

      ws.on('close', (code, reason) => {
        console.log(`🔌 ${network.toUpperCase()} WebSocket disconnected: ${code} - ${reason}`)
        this.connections[network].isConnected = false
        this.attemptReconnect(network, wsUrl)
      })

      ws.on('error', error => {
        console.error(`❌ ${network.toUpperCase()} WebSocket error:`, error)
        this.connections[network].isConnected = false
      })

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ws.once('open', () => { clearTimeout(timeout); resolve() })
        ws.once('error', (err) => { clearTimeout(timeout); reject(err) })
      })
    } catch (error) {
      console.error(`❌ Failed to connect ${network.toUpperCase()} WebSocket:`, error)
      this.attemptReconnect(network, wsUrl)
    }
  }

  attemptReconnect(network, wsUrl) {
    if (this.reconnectAttempts[network] >= 5) {
      console.error(`❌ Max reconnection attempts reached for ${network.toUpperCase()}`)
      return
    }
    this.reconnectAttempts[network]++
    console.log(`🔄 Reconnecting ${network.toUpperCase()} (${this.reconnectAttempts[network]}/5)...`)
    setTimeout(() => this.connectWebSocket(network, wsUrl), this.reconnectDelay * this.reconnectAttempts[network])
  }

  async loadAndSubscribeAddresses(network) {
    try {
      console.log(`📋 Loading ${network.toUpperCase()} addresses from database...`)
      const { data: userAddresses, error } = await this.supabase.rpc('get_user_addresses_for_network', { network_name: network })
      if (error) return console.error(`❌ Error loading ${network.toUpperCase()} addresses:`, error)

      console.log(`📊 Found ${userAddresses?.length || 0} ${network.toUpperCase()} addresses`)
      this.addressToUserMap[network].clear()
      const newAddresses = new Set()

      userAddresses?.forEach(ua => {
        if (ua.address) {
          const address = ua.address.trim()
          newAddresses.add(address)
          this.addressToUserMap[network].set(address, ua.user_id)
          console.log(`📍 Loaded ${network.toUpperCase()} address: ${address} -> user: ${ua.user_id}`)
        }
      })

      if (this.connections[network].ws && this.connections[network].isConnected) {
        for (const address of newAddresses) {
          if (!this.subscribedAddresses[network].has(address)) {
            await this.subscribeToAddress(network, address)
            this.subscribedAddresses[network].add(address)
          }
        }
        console.log(`📡 Subscribed to ${this.subscribedAddresses[network].size} ${network.toUpperCase()} addresses`)
      }
    } catch (error) {
      console.error(`❌ Error loading ${network.toUpperCase()} addresses:`, error)
    }
  }

  async subscribeToAddress(network, address) {
    const ws = this.connections[network].ws
    if (!ws || !this.connections[network].isConnected) return

    try {
      const subscriptionId = Math.floor(Math.random() * 1000000)
      let subscribeMessage

      switch (network) {
        case 'solana':
          subscribeMessage = { jsonrpc: '2.0', id: subscriptionId, method: 'accountSubscribe', params: [address, { encoding: 'base64', commitment: 'confirmed' }] }
          break
        case 'ethereum':
          subscribeMessage = { jsonrpc: '2.0', id: subscriptionId, method: 'eth_subscribe', params: ['logs', { address, topics: [] }] }
          break
        case 'tron':
          subscribeMessage = { jsonrpc: '2.0', id: subscriptionId, method: 'subscribe', params: ['account', { address }] }
          break
      }

      console.log(`📡 Subscribing to ${network.toUpperCase()} address: ${address} (ID: ${subscriptionId})`)
      ws.send(JSON.stringify(subscribeMessage))
      this.subscriptionIdToAddress[network].set(subscriptionId, address)
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`❌ Error subscribing to ${network.toUpperCase()} address ${address}:`, error)
    }
  }

  async handleWebSocketMessage(network, data) {
    try {
      const message = JSON.parse(data.toString())
      console.log(`📨 ${network.toUpperCase()} WebSocket message:`, JSON.stringify(message, null, 2))

      if (message.id === 999999 && message.result) {
        console.log(`✅ ${network.toUpperCase()} WebSocket test successful:`, message.result)
        return
      }

      if (message.result && typeof message.result === 'number') {
        const address = this.subscriptionIdToAddress[network].get(message.id)
        if (address) {
          console.log(`✅ ${network.toUpperCase()} subscription confirmed for ${address}: ID ${message.result}`)
          this.subscriptionIdToAddress[network].set(message.result, address)
        }
        return
      }

      switch (network) {
        case 'solana': await this.handleSolanaNotification(message); break
        case 'ethereum': await this.handleEthereumNotification(message); break
        case 'tron': await this.handleTronNotification(message); break
      }

      if (message.error) console.error(`❌ ${network.toUpperCase()} WebSocket error response:`, message.error)
    } catch (error) {
      console.error(`❌ Error processing ${network.toUpperCase()} WebSocket message:`, error)
    }
  }

  // ---------------- SOLANA ----------------
  async handleSolanaNotification(message) {
    if (message.method === 'accountNotification' && message.params) {
      console.log('🎯 SOLANA ACCOUNT CHANGE DETECTED!')
      await this.processSolanaAccountChange(message.params)
    }
  }

  async processSolanaAccountChange(params) {
    try {
      const { result, subscription } = params
      if (!result?.value) return console.log('⚠️ No Solana account data')

      // Find address for this subscription
      let address
      for (const [subId, addr] of this.subscriptionIdToAddress.solana.entries()) {
        if (subId.toString() === subscription.toString()) {
          address = addr
          break
        }
      }
      if (!address) return console.log(`⚠️ Unknown Solana subscription ID: ${subscription}`)

      const newBalance = result.value.lamports || 0
      const previousBalance = this.addressBalances.solana.get(address) || 0
      this.addressBalances.solana.set(address, newBalance)

      console.log(`   Address: ${address}`)
      console.log(`   New Balance: ${(newBalance/1e9).toFixed(9)} SOL`)

      const balanceIncrease = newBalance - previousBalance
      if (balanceIncrease > 0) {
        const depositAmountSOL = balanceIncrease / 1e9
        console.log(`💰 SOLANA DEPOSIT DETECTED: ${depositAmountSOL.toFixed(9)} SOL`)

        const userId = this.addressToUserMap.solana.get(address)
        if (!userId) return console.log(`⚠️ No user found for ${address}`)
        await this.creditUserDeposit('solana', userId, address, depositAmountSOL, `solana_balance_change_${Date.now()}`)
      }
    } catch (error) {
      console.error('❌ Error processing Solana account change:', error)
    }
  }

  // ---------------- ETHEREUM ----------------
  async handleEthereumNotification(message) {
    if (message.method === 'eth_subscription' && message.params) {
      console.log('🎯 ETHEREUM TRANSACTION DETECTED!')
      await this.processEthereumTransaction(message.params)
    }
  }

  async processEthereumTransaction(params) {
    console.log('Processing Ethereum transaction:', params)
  }

  // ---------------- TRON ----------------
  async handleTronNotification(message) {
    if (message.method === 'notification' && message.params) {
      console.log('🎯 TRON TRANSACTION DETECTED!')
      await this.processTronTransaction(message.params)
    }
  }

  async processTronTransaction(params) {
    console.log('Processing Tron transaction:', params)
  }

  // ---------------- HELPERS ----------------
  convertToMainUnit(amount, network) {
    switch (network) {
      case 'solana': return amount / 1e9
      case 'ethereum': return amount / 1e18
      case 'tron': return amount / 1e6
      default: return amount
    }
  }

  async creditUserDeposit(network, userId, address, cryptoAmount, transactionHash) {
    try {
      const usdAmount = cryptoPrices.convertToUSD(cryptoAmount, network)
      console.log(`💳 Crediting ${network.toUpperCase()} deposit for user ${userId}: ${cryptoAmount.toFixed(9)} = $${usdAmount.toFixed(2)}`)

      const { data: existingDeposit } = await this.supabase
        .from('pending_deposits')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_hash', transactionHash)
        .eq('network', network)
        .single()
      if (existingDeposit) return console.log('⚠️ Deposit already processed, skipping...')

      await this.supabase.from('pending_deposits').insert({
        user_id: userId,
        network,
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

      const { data: profile } = await this.supabase.from('profiles').select('balance, account_index').eq('id', userId).single()
      const currentBalance = profile?.balance || 0
      const newBalance = currentBalance + usdAmount

      await this.supabase.from('profiles').update({ balance: newBalance }).eq('id', userId)

      await this.supabase.from('deposit_transactions').insert({
        user_id: userId,
        network,
        transaction_hash: transactionHash,
        from_address: 'unknown',
        to_address: address,
        amount_crypto: cryptoAmount,
        amount_usd: usdAmount,
        block_number: 0,
        block_hash: '',
        confirmations: 1
      })

      console.log(`🚀 Auto-sweeping ${network.toUpperCase()}...`)
      try {
        const accountIndex = profile?.account_index || 0
        const sweepResult = await this.autoTransfer.processTransferForUser(network, userId, accountIndex, `Auto-sweep ${transactionHash}`)
        if (sweepResult) console.log(`✅ Auto-sweep successful: ${sweepResult.amountCrypto.toFixed(9)} ${network.toUpperCase()}`)
        else console.log('⚠️ No funds to sweep')
      } catch (sweepError) {
        console.error(`❌ Auto-sweep failed for ${network.toUpperCase()}:`, sweepError.message)
      }

      console.log(`✅ Successfully credited user ${userId} with $${usdAmount.toFixed(2)} from ${network.toUpperCase()} deposit`)
    } catch (error) {
      console.error(`❌ Error crediting ${network.toUpperCase()} deposit:`, error)
    }
  }
}

// ---------------- START ----------------
const listener = new MultiNetworkDepositListener()
listener.start().catch(error => { console.error('❌ Failed to start listener:', error); process.exit(1) })

process.on('SIGINT', () => { shutdown(); })
process.on('SIGTERM', () => { shutdown(); })

function shutdown() {
  console.log('🛑 Shutting down listener...')
  Object.values(listener.connections).forEach(conn => { if (conn.ws) conn.ws.close() })
  process.exit(0)
}
