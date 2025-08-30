import fetch from 'node-fetch'

class CryptoPriceManager {
  constructor() {
    this.prices = {
      ethereum: 0,
      tron: 0,
      solana: 0
    }
    this.lastUpdate = 0
    this.updateInterval = 300000 // 5 minutes (300 seconds)
    this.isUpdating = false
    
    console.log('💰 Crypto Price Manager initialized')
    
    // Start price updates
    this.startPriceUpdates()
  }

  async startPriceUpdates() {
    // Initial fetch
    await this.updatePrices()
    
    // Set up interval
    setInterval(async () => {
      await this.updatePrices()
    }, this.updateInterval)
    
    console.log(`📊 Price updates started (every ${this.updateInterval/1000}s)`)
  }

  async updatePrices() {
    if (this.isUpdating) return
    
    this.isUpdating = true
    
    try {
      console.log('🔄 Fetching latest crypto prices...')
      
      // Using CoinGecko API (free, no API key needed)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tron,solana&vs_currencies=usd',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AIGHTBRUV-DepositListener/1.0'
          },
          timeout: 10000
        }
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Update prices
      this.prices.ethereum = data.ethereum?.usd || this.prices.ethereum
      this.prices.tron = data.tron?.usd || this.prices.tron
      this.prices.solana = data.solana?.usd || this.prices.solana
      
      this.lastUpdate = Date.now()
      
      console.log('✅ Prices updated:')
      console.log(`   ETH: $${this.prices.ethereum.toFixed(2)}`)
      console.log(`   TRX: $${this.prices.tron.toFixed(4)}`)
      console.log(`   SOL: $${this.prices.solana.toFixed(2)}`)
      
    } catch (error) {
      console.error('❌ Failed to update crypto prices:', error.message)
      
      // Fallback to backup API
      await this.updatePricesBackup()
      
    } finally {
      this.isUpdating = false
    }
  }

  async updatePricesBackup() {
    try {
      console.log('🔄 Trying backup price API...')
      
      // Backup: CryptoCompare API
      const response = await fetch(
        'https://min-api.cryptocompare.com/data/pricemulti?fsyms=ETH,TRX,SOL&tsyms=USD',
        {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      )

      if (!response.ok) {
        throw new Error(`CryptoCompare API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Update prices from backup
      this.prices.ethereum = data.ETH?.USD || this.prices.ethereum
      this.prices.tron = data.TRX?.USD || this.prices.tron
      this.prices.solana = data.SOL?.USD || this.prices.solana
      
      this.lastUpdate = Date.now()
      
      console.log('✅ Backup prices updated:')
      console.log(`   ETH: $${this.prices.ethereum.toFixed(2)}`)
      console.log(`   TRX: $${this.prices.tron.toFixed(4)}`)
      console.log(`   SOL: $${this.prices.solana.toFixed(2)}`)
      
    } catch (error) {
      console.error('❌ Backup price API also failed:', error.message)
      console.log('⚠️ Using cached prices')
    }
  }

  getPrice(network) {
    const price = this.prices[network.toLowerCase()]
    
    if (!price || price === 0) {
      console.warn(`⚠️ No price data for ${network}, using fallback`)
      // Fallback prices
      const fallbacks = {
        ethereum: 3000,
        tron: 0.10,
        solana: 200
      }
      return fallbacks[network.toLowerCase()] || 1
    }
    
    return price
  }

  getPriceAge() {
    return Date.now() - this.lastUpdate
  }

  isStale() {
    return this.getPriceAge() > (this.updateInterval * 3) // 90 seconds
  }

  getAllPrices() {
    return {
      ...this.prices,
      lastUpdate: this.lastUpdate,
      age: this.getPriceAge(),
      isStale: this.isStale()
    }
  }

  // Convert crypto amount to USD using real-time prices
  convertToUSD(amount, network) {
    const price = this.getPrice(network)
    const usdAmount = amount * price
    
    console.log(`💱 ${amount} ${network.toUpperCase()} = $${usdAmount.toFixed(2)} (rate: $${price.toFixed(4)})`)
    
    return usdAmount
  }

  // Get formatted price string
  getFormattedPrice(network) {
    const price = this.getPrice(network)
    const symbol = network.toUpperCase()
    
    if (price < 1) {
      return `${symbol}: $${price.toFixed(4)}`
    } else {
      return `${symbol}: $${price.toFixed(2)}`
    }
  }
}

// Create singleton instance
export const cryptoPrices = new CryptoPriceManager()

// Export for use in other modules
export default cryptoPrices