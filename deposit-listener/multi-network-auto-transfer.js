import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { mnemonicToSeedSync } from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import { HDKey } from '@scure/bip32'
import * as secp256k1 from '@noble/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fetch from 'node-fetch'
import bs58 from 'bs58'
import dotenv from 'dotenv'

// Polyfill fetch for Node.js
if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') })

class MultiNetworkAutoTransfer {
  constructor() {
    // Network connections
    this.connections = {
      solana: new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      ),
      ethereum: null, // Will be initialized with ethers
      tron: null // Will use HTTP RPC
    }
    
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
    
    // Collection wallet addresses for each network
    this.collectionAddresses = {
      solana: process.env.COLLECTION_WALLET_ADDRESS || 'Zg5r67TdhqKf6YYcU6hi86j8Up7LX9DzBo5VZdmQE8y',
      ethereum: process.env.ETHEREUM_COLLECTION_ADDRESS || '0x6608F3E90b2E0398CC9e9FF7D5bB6B1aBbeF357c',
      tron: process.env.TRON_COLLECTION_ADDRESS || 'TAWfSzCDG93EKQxutoYiUi5x7NLXTNoV7D'
    }
    
    console.log('🚀 Multi-Network Auto Transfer Service initialized')
    console.log(`📦 Collection addresses:`)
    console.log(`   Solana: ${this.collectionAddresses.solana}`)
    console.log(`   Ethereum: ${this.collectionAddresses.ethereum}`)
    console.log(`   Tron: ${this.collectionAddresses.tron}`)
  }

  // Generate keypair from mnemonic for any network
  generateKeypairFromMnemonic(mnemonic, network, accountIndex) {
    try {
      const seed = mnemonicToSeedSync(mnemonic)
      
      const derivationPaths = {
        ethereum: `m/44'/60'/0'/0/${accountIndex}`,
        tron: `m/44'/195'/0'/0/${accountIndex}`,
        solana: `m/44'/501'/${accountIndex}'/0'`
      }
      
      const derivationPath = derivationPaths[network]
      console.log(`🔑 Deriving ${network.toUpperCase()} keypair for account ${accountIndex} using path: ${derivationPath}`)
      
      if (network === 'solana') {
        // Solana uses ed25519
        const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key
        const keypair = Keypair.fromSeed(derivedSeed)
        console.log(`✅ Generated Solana address: ${keypair.publicKey.toBase58()}`)
        return keypair
      } else {
        // Ethereum and Tron use secp256k1
        const hdkey = HDKey.fromMasterSeed(seed)
        const derivedKey = hdkey.derive(derivationPath)
        
        if (!derivedKey.privateKey) {
          throw new Error(`Failed to derive ${network} private key`)
        }
        
        const privateKeyHex = Buffer.from(derivedKey.privateKey).toString('hex')
        const address = this.generateAddressFromPrivateKey(network, derivedKey.privateKey)
        
        console.log(`✅ Generated ${network.toUpperCase()} address: ${address}`)
        
        return {
          privateKey: derivedKey.privateKey,
          privateKeyHex,
          address
        }
      }
      
    } catch (error) {
      console.error(`❌ Error generating ${network} keypair:`, error)
      throw error
    }
  }

  // Generate address from private key for Ethereum/Tron
  generateAddressFromPrivateKey(network, privateKeyBytes) {
    try {
      // Generate public key
      const publicKey = secp256k1.getPublicKey(privateKeyBytes, false) // uncompressed
      const publicKeyBytes = publicKey.slice(1) // Remove 0x04 prefix
      
      // Hash public key with Keccak-256
      const hash = keccak_256(publicKeyBytes)
      
      if (network === 'ethereum') {
        // Ethereum: take last 20 bytes and add 0x prefix
        const addressBytes = hash.slice(-20)
        return '0x' + Buffer.from(addressBytes).toString('hex')
      } else if (network === 'tron') {
        // Tron: add 0x41 prefix and convert to Base58Check
        const addressBytes = new Uint8Array(21)
        addressBytes[0] = 0x41 // Tron mainnet prefix
        addressBytes.set(hash.slice(-20), 1)
        
        // Add checksum
        const checksum = keccak_256(keccak_256(addressBytes)).slice(0, 4)
        const addressWithChecksum = new Uint8Array(25)
        addressWithChecksum.set(addressBytes)
        addressWithChecksum.set(checksum, 21)
        
        return bs58.encode(addressWithChecksum)
      }
      
      throw new Error(`Unsupported network: ${network}`)
    } catch (error) {
      console.error(`❌ Error generating ${network} address:`, error)
      throw error
    }
  }

  // Transfer all available funds for Solana
  async transferSolanaFunds(sourceKeypair, reason = 'Auto sweep') {
    try {
      const sourceAddress = sourceKeypair.publicKey
      const collectionPublicKey = new PublicKey(this.collectionAddresses.solana)
      
      console.log(`🔄 Starting Solana transfer from ${sourceAddress.toBase58()}`)
      
      const balance = await this.connections.solana.getBalance(sourceAddress)
      console.log(`💰 Current balance: ${balance} lamports (${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL)`)
      
      if (balance === 0) {
        console.log('⚠️ No Solana balance to transfer')
        return null
      }
      
      const { blockhash } = await this.connections.solana.getLatestBlockhash('confirmed')
      const dummyTransaction = new Transaction({
        feePayer: sourceAddress,
        recentBlockhash: blockhash
      }).add(
        SystemProgram.transfer({
          fromPubkey: sourceAddress,
          toPubkey: collectionPublicKey,
          lamports: balance
        })
      )
      
      const feeEstimate = await this.connections.solana.getFeeForMessage(
        dummyTransaction.compileMessage(),
        'confirmed'
      )
      
      const transactionFee = feeEstimate.value || 5000
      const transferAmount = balance - transactionFee
      
      if (transferAmount <= 0) {
        console.log('⚠️ Insufficient Solana balance to cover transaction fee')
        return null
      }
      
      const transaction = new Transaction({
        feePayer: sourceAddress,
        recentBlockhash: blockhash
      }).add(
        SystemProgram.transfer({
          fromPubkey: sourceAddress,
          toPubkey: collectionPublicKey,
          lamports: transferAmount
        })
      )
      
      const signature = await sendAndConfirmTransaction(
        this.connections.solana,
        transaction,
        [sourceKeypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed'
        }
      )
      
      console.log(`✅ Solana transfer successful: ${signature}`)
      console.log(`💰 Transferred: ${(transferAmount / LAMPORTS_PER_SOL).toFixed(9)} SOL`)
      
      return {
        signature,
        amount: transferAmount,
        amountCrypto: transferAmount / LAMPORTS_PER_SOL,
        fee: transactionFee,
        from: sourceAddress.toBase58(),
        to: this.collectionAddresses.solana
      }
      
    } catch (error) {
      console.error('❌ Solana transfer failed:', error)
      throw error
    }
  }

  // Transfer all available funds for Ethereum
  async transferEthereumFunds(sourceWallet, reason = 'Auto sweep') {
    try {
      const { ethers } = await import('ethers')
      
      // Connect to Ethereum provider
      const provider = new ethers.JsonRpcProvider(
        process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/611bcbd3195640a0b5613d79ed6fb5fa'
      )
      
      const wallet = new ethers.Wallet(sourceWallet.privateKeyHex, provider)
      
      console.log(`🔄 Starting Ethereum transfer from ${wallet.address}`)
      
      const balance = await provider.getBalance(wallet.address)
      const balanceEth = ethers.formatEther(balance)
      
      console.log(`💰 Current balance: ${balanceEth} ETH`)
      
      if (balance === 0n) {
        console.log('⚠️ No Ethereum balance to transfer')
        return null
      }
      
      // Get gas price and estimate gas
      const feeData = await provider.getFeeData()
      const gasLimit = 21000n // Standard ETH transfer
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei')
      const gasCost = gasLimit * gasPrice
      
      const transferAmount = balance - gasCost
      
      if (transferAmount <= 0n) {
        console.log('⚠️ Insufficient Ethereum balance to cover gas fees')
        return null
      }
      
      const transaction = {
        to: this.collectionAddresses.ethereum,
        value: transferAmount,
        gasLimit: gasLimit,
        gasPrice: gasPrice
      }
      
      const txResponse = await wallet.sendTransaction(transaction)
      await txResponse.wait()
      
      console.log(`✅ Ethereum transfer successful: ${txResponse.hash}`)
      console.log(`💰 Transferred: ${ethers.formatEther(transferAmount)} ETH`)
      
      return {
        signature: txResponse.hash,
        amount: transferAmount,
        amountCrypto: parseFloat(ethers.formatEther(transferAmount)),
        fee: gasCost,
        from: wallet.address,
        to: this.collectionAddresses.ethereum
      }
      
    } catch (error) {
      console.error('❌ Ethereum transfer failed:', error)
      throw error
    }
  }

  // Transfer all available funds for Tron
  async transferTronFunds(sourceWallet, reason = 'Auto sweep') {
    try {
      const tronRpcUrl = process.env.TRON_RPC_URL || 'https://api.trongrid.io'
      const fromAddress = sourceWallet.address
      
      console.log(`🔄 Starting Tron transfer from ${fromAddress}`)
      
      // Check account balance
      const balanceResponse = await fetch(`${tronRpcUrl}/v1/accounts/${fromAddress}`)
      const balanceData = await balanceResponse.json()
      const balance = balanceData.data?.[0]?.balance || 0
      const balanceTrx = balance / 1000000
      
      console.log(`💰 Current balance: ${balanceTrx} TRX`)
      
      if (balance === 0) {
        console.log('⚠️ No Tron balance to transfer')
        return null
      }
      
      // Reserve 1 TRX for transaction fees
      const transactionFee = 1000000 // 1 TRX in SUN
      const transferAmount = balance - transactionFee
      
      if (transferAmount <= 0) {
        console.log('⚠️ Insufficient Tron balance to cover transaction fee')
        return null
      }
      
      // Create transaction
      const createTxResponse = await fetch(`${tronRpcUrl}/wallet/createtransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_address: this.hexToBase58(this.addressToHex(this.collectionAddresses.tron)),
          owner_address: this.hexToBase58(this.addressToHex(fromAddress)),
          amount: transferAmount
        })
      })
      
      const transaction = await createTxResponse.json()
      if (transaction.Error) {
        throw new Error(`Transaction creation failed: ${transaction.Error}`)
      }
      
      // Sign transaction
      const txID = transaction.txID
      const rawDataHex = transaction.raw_data_hex
      const txBytes = this.hexToBytes(rawDataHex)
      const hash = keccak_256(txBytes)
      const signature = secp256k1.sign(hash, sourceWallet.privateKey)
      const signatureHex = signature.toCompactHex()
      
      const signedTx = {
        ...transaction,
        signature: [signatureHex]
      }
      
      // Broadcast transaction
      const broadcastResponse = await fetch(`${tronRpcUrl}/wallet/broadcasttransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedTx)
      })
      
      const result = await broadcastResponse.json()
      
      if (!result.result) {
        throw new Error(`Transaction failed: ${result.message || 'Unknown error'}`)
      }
      
      console.log(`✅ Tron transfer successful: ${txID}`)
      console.log(`💰 Transferred: ${(transferAmount / 1000000).toFixed(6)} TRX`)
      
      return {
        signature: txID,
        amount: transferAmount,
        amountCrypto: transferAmount / 1000000,
        fee: transactionFee,
        from: fromAddress,
        to: this.collectionAddresses.tron
      }
      
    } catch (error) {
      console.error('❌ Tron transfer failed:', error)
      throw error
    }
  }

  // Helper functions for Tron address conversion
  addressToHex(address) {
    const decoded = bs58.decode(address)
    return Array.from(decoded.slice(0, 21)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  hexToBase58(hex) {
    const bytes = this.hexToBytes(hex)
    const checksum = keccak_256(keccak_256(bytes)).slice(0, 4)
    const addressWithChecksum = new Uint8Array(bytes.length + 4)
    addressWithChecksum.set(bytes)
    addressWithChecksum.set(checksum, bytes.length)
    return bs58.encode(addressWithChecksum)
  }

  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  }

  // Process transfer for a specific user and network
  async processTransferForUser(network, userId, accountIndex, reason = 'Deposit sweep') {
    try {
      const masterMnemonic = process.env.MASTER_MNEMONIC
      if (!masterMnemonic) {
        throw new Error('MASTER_MNEMONIC not configured')
      }
      
      console.log(`🎯 Processing ${network.toUpperCase()} transfer for user ${userId} (account ${accountIndex})`)
      
      // Generate keypair for this user's account
      const userWallet = this.generateKeypairFromMnemonic(masterMnemonic, network, accountIndex)
      
      // Transfer all funds based on network
      let result
      switch (network) {
        case 'solana':
          result = await this.transferSolanaFunds(userWallet, reason)
          break
        case 'ethereum':
          result = await this.transferEthereumFunds(userWallet, reason)
          break
        case 'tron':
          result = await this.transferTronFunds(userWallet, reason)
          break
        default:
          throw new Error(`Unsupported network: ${network}`)
      }
      
      if (result) {
        console.log(`✅ Successfully swept ${result.amountCrypto.toFixed(9)} ${network.toUpperCase()} from user ${userId}`)
        
        // Log the transfer in database
        try {
          await this.supabase
            .from('transfer_logs')
            .insert({
              user_id: userId,
              network: network,
              from_address: result.from,
              to_address: result.to,
              amount_crypto: result.amountCrypto,
              transaction_hash: result.signature,
              reason: reason,
              status: 'completed'
            })
        } catch (dbError) {
          console.log('⚠️ Failed to log transfer to database:', dbError.message)
        }
      }
      
      return result
      
    } catch (error) {
      console.error(`❌ Failed to process ${network.toUpperCase()} transfer for user ${userId}:`, error)
      throw error
    }
  }

  // Sweep all user addresses for all networks
  async sweepAllAddresses() {
    try {
      console.log('🧹 Starting sweep of all user addresses across all networks...')
      
      const networks = ['solana', 'ethereum', 'tron']
      let totalResults = {
        totalSwept: { solana: 0, ethereum: 0, tron: 0 },
        successfulSweeps: { solana: 0, ethereum: 0, tron: 0 },
        totalAddresses: { solana: 0, ethereum: 0, tron: 0 }
      }

      for (const network of networks) {
        console.log(`\n🔄 Processing ${network.toUpperCase()} addresses...`)
        
        // Get all user addresses for this network
        const { data: userAddresses, error } = await this.supabase
          .rpc('get_user_addresses_for_network', { network_name: network })

        if (error) {
          console.error(`❌ Failed to get ${network.toUpperCase()} addresses:`, error.message)
          continue
        }

        console.log(`📊 Found ${userAddresses?.length || 0} ${network.toUpperCase()} addresses to sweep`)
        totalResults.totalAddresses[network] = userAddresses?.length || 0

        for (const userAddress of userAddresses || []) {
          try {
            // Get user's account index from profiles table
            const { data: profile } = await this.supabase
              .from('profiles')
              .select('account_index')
              .eq('id', userAddress.user_id)
              .single()

            const accountIndex = profile?.account_index || 0
            
            const result = await this.processTransferForUser(
              network,
              userAddress.user_id, 
              accountIndex, 
              'Scheduled sweep'
            )
            
            if (result) {
              totalResults.totalSwept[network] += result.amountCrypto
              totalResults.successfulSweeps[network]++
            }
            
            // Small delay between transfers
            await new Promise(resolve => setTimeout(resolve, 1000))
            
          } catch (error) {
            console.error(`❌ Failed to sweep ${network.toUpperCase()} for user ${userAddress.user_id}:`, error.message)
          }
        }
      }
      
      console.log(`\n✅ Multi-network sweep completed!`)
      console.log(`📊 Results:`)
      for (const network of networks) {
        console.log(`   ${network.toUpperCase()}: ${totalResults.successfulSweeps[network]} sweeps, ${totalResults.totalSwept[network].toFixed(9)} ${network.toUpperCase()} total`)
      }
      
      return totalResults
      
    } catch (error) {
      console.error('❌ Multi-network sweep failed:', error)
      throw error
    }
  }

  // Listen for deposit notifications and auto-transfer for all networks
  async startAutoTransferListener() {
    console.log('👂 Starting multi-network auto-transfer listener...')
    
    const networks = ['solana', 'ethereum', 'tron']
    
    for (const network of networks) {
      // Subscribe to deposit notifications for each network
      const channel = this.supabase
        .channel(`deposit-notifications-${network}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_deposits',
          filter: `network=eq.${network}`
        }, async (payload) => {
          console.log(`🔔 New ${network.toUpperCase()} deposit detected:`, payload.new)
          
          try {
            const deposit = payload.new
            
            // Get user's account index
            const { data: profile } = await this.supabase
              .from('profiles')
              .select('account_index')
              .eq('id', deposit.user_id)
              .single()

            const accountIndex = profile?.account_index || 0
            
            // Auto-transfer funds
            console.log(`🚀 Auto-transferring ${network.toUpperCase()} funds for deposit ${deposit.id}`)
            
            await this.processTransferForUser(
              network,
              deposit.user_id,
              accountIndex,
              `Auto-sweep for ${network} deposit ${deposit.id}`
            )
            
          } catch (error) {
            console.error(`❌ ${network.toUpperCase()} auto-transfer failed:`, error)
          }
        })
        .subscribe()

      console.log(`✅ ${network.toUpperCase()} auto-transfer listener active!`)
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const autoTransfer = new MultiNetworkAutoTransfer()
  
  const command = process.argv[2]
  
  switch (command) {
    case 'sweep-all':
      console.log('🧹 Manual sweep of all addresses across all networks...')
      autoTransfer.sweepAllAddresses()
        .then(result => {
          console.log('✅ Multi-network sweep completed:', result)
          process.exit(0)
        })
        .catch(error => {
          console.error('❌ Multi-network sweep failed:', error)
          process.exit(1)
        })
      break
      
    case 'sweep-user':
      const network = process.argv[3]
      const userId = process.argv[4]
      const accountIndex = parseInt(process.argv[5]) || 0
      
      if (!network || !userId) {
        console.error('❌ Usage: node multi-network-auto-transfer.js sweep-user <network> <user_id> [account_index]')
        console.error('   Networks: solana, ethereum, tron')
        process.exit(1)
      }
      
      console.log(`🎯 Manual ${network.toUpperCase()} sweep for user ${userId}...`)
      autoTransfer.processTransferForUser(network, userId, accountIndex, 'Manual sweep')
        .then(result => {
          console.log('✅ User sweep completed:', result)
          process.exit(0)
        })
        .catch(error => {
          console.error('❌ User sweep failed:', error)
          process.exit(1)
        })
      break
      
    case 'listen':
      console.log('👂 Starting multi-network auto-transfer listener...')
      autoTransfer.startAutoTransferListener()
        .then(() => {
          console.log('✅ Multi-network listener started, press Ctrl+C to stop')
        })
        .catch(error => {
          console.error('❌ Failed to start multi-network listener:', error)
          process.exit(1)
        })
      break
      
    default:
      console.log('📖 Usage:')
      console.log('  node multi-network-auto-transfer.js sweep-all                           # Sweep all networks')
      console.log('  node multi-network-auto-transfer.js sweep-user <network> <user_id>     # Sweep specific user')
      console.log('  node multi-network-auto-transfer.js listen                             # Start auto-transfer listener')
      console.log('')
      console.log('Networks: solana, ethereum, tron')
      console.log('')
      console.log('Examples:')
      console.log('  node multi-network-auto-transfer.js sweep-user solana 28e19fe0-e11e-43fe-b178-a0af314334da')
      console.log('  node multi-network-auto-transfer.js sweep-user ethereum 28e19fe0-e11e-43fe-b178-a0af314334da')
      console.log('  node multi-network-auto-transfer.js sweep-user tron 28e19fe0-e11e-43fe-b178-a0af314334da')
      break
  }
}

export { MultiNetworkAutoTransfer }
