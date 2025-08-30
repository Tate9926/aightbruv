import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WithdrawalRequest {
  withdrawal_id: string
  user_id: string
  amount: string
  network: 'ethereum' | 'tron' | 'solana'
  withdrawal_address: string
  network_fee: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get private keys from environment variables
    const privateKeys = {
      ethereum: Deno.env.get('ETHEREUM_WITHDRAWAL_PRIVATE_KEY'),
      tron: Deno.env.get('TRON_WITHDRAWAL_PRIVATE_KEY'),
      solana: Deno.env.get('SOLANA_WITHDRAWAL_PRIVATE_KEY')
    }

    // Validate that all required private keys are configured
    if (!privateKeys.ethereum || !privateKeys.tron || !privateKeys.solana) {
      const missing = []
      if (!privateKeys.ethereum) missing.push('ETHEREUM_WITHDRAWAL_PRIVATE_KEY')
      if (!privateKeys.tron) missing.push('TRON_WITHDRAWAL_PRIVATE_KEY')
      if (!privateKeys.solana) missing.push('SOLANA_WITHDRAWAL_PRIVATE_KEY')
      
      throw new Error(`Missing environment variables: ${missing.join(', ')}`)
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { withdrawal_id, user_id, amount, network, withdrawal_address, network_fee }: WithdrawalRequest = await req.json()

    console.log(`Processing withdrawal ${withdrawal_id} for user ${user_id}: ${amount} ${network.toUpperCase()}`)

    // Get user's account index from database
    const { data: userData, error: userError } = await supabaseClient
      .from('profiles')
      .select('id, balance')
      .eq('id', user_id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Verify user has sufficient balance for withdrawal
    const withdrawalUsdAmount = parseFloat(amount) * getCryptoToUsdRate(network)
    if (userData.balance < withdrawalUsdAmount) {
      throw new Error(`Insufficient balance. Available: $${userData.balance.toFixed(2)}, Required: $${withdrawalUsdAmount.toFixed(2)}`)
    }

    // Update withdrawal status to processing
    await supabaseClient
      .from('withdrawals')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawal_id)

    let transactionHash: string
    let success = false

    try {
      // Process withdrawal based on network using derivation
      switch (network) {
        case 'ethereum':
          transactionHash = await processEthereumWithdrawal(amount, withdrawal_address, network_fee, privateKeys.ethereum!)
          break
        case 'tron':
          transactionHash = await processTronWithdrawal(amount, withdrawal_address, network_fee, privateKeys.tron!)
          break
        case 'solana':
          transactionHash = await processSolanaWithdrawal(amount, withdrawal_address, network_fee, privateKeys.solana!)
          break
        default:
          throw new Error(`Unsupported network: ${network}`)
      }

      success = true
      console.log(`Withdrawal successful: ${transactionHash}`)

    } catch (error) {
      console.error(`Withdrawal failed:`, error)
      
      // Update withdrawal status to failed
      await supabaseClient
        .from('withdrawals')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawal_id)

      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    if (success && transactionHash) {
      // Update withdrawal status to completed
      await supabaseClient
        .from('withdrawals')
        .update({ 
          status: 'completed',
          transaction_hash: transactionHash,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawal_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          transaction_hash: transactionHash,
          message: `Withdrawal completed successfully`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

  } catch (error) {
    console.error('Withdrawal processing error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Helper function to get crypto to USD conversion rates
function getCryptoToUsdRate(network: 'ethereum' | 'tron' | 'solana'): number {
  const rates = {
    ethereum: 3000, // $3000 per ETH
    tron: 0.10, // $0.10 per TRX  
    solana: 200 // $200 per SOL
  }
  return rates[network] || 3000
}

// Ethereum withdrawal with mnemonic derivation
async function processEthereumWithdrawal(amount: string, toAddress: string, networkFee: string, privateKeyHex: string): Promise<string> {
  const { ethers } = await import('npm:ethers@6.8.0')
  
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKeyHex)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(
    Deno.env.get('ETHEREUM_RPC_URL') || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID'
  )
  
  const connectedWallet = wallet.connect(provider)
  
  console.log(`Using Ethereum withdrawal address: ${wallet.address}`)
  
  // Convert amount to Wei
  const amountWei = ethers.parseEther(amount)
  
  // Check balance
  const balance = await provider.getBalance(wallet.address)
  const balanceEth = ethers.formatEther(balance)
  
  console.log(`Current ETH balance: ${balanceEth} ETH`)
  
  if (balance < amountWei) {
    throw new Error(`Insufficient ETH balance. Available: ${balanceEth} ETH, Required: ${amount} ETH`)
  }
  
  // Create transaction
  const transaction = {
    to: toAddress,
    value: amountWei,
    gasLimit: 21000,
    gasPrice: (await provider.getFeeData()).gasPrice
  }
  
  // Send transaction
  const txResponse = await connectedWallet.sendTransaction(transaction)
  await txResponse.wait() // Wait for confirmation
  
  console.log(`✅ Ethereum withdrawal successful: ${txResponse.hash}`)
  console.log(`💰 Sent: ${amount} ETH to ${toAddress}`)
  
  return txResponse.hash
}

// Tron withdrawal with mnemonic derivation
async function processTronWithdrawal(amount: string, toAddress: string, networkFee: string, privateKeyHex: string): Promise<string> {
  const secp256k1Module = await import('npm:@noble/secp256k1@2.0.0')
  const secp256k1 = secp256k1Module.secp256k1 || secp256k1Module.default || secp256k1Module
  const { keccak_256 } = await import('npm:@noble/hashes@1.3.3/sha3')
  const bs58 = (await import('npm:bs58@5.0.0')).default

  // Verify secp256k1 import with more detailed checking
  if (!secp256k1) {
    throw new Error('Failed to import secp256k1 library - module is undefined')
  }
  
  // Check for different possible method names
  const getPublicKeyFn = secp256k1.getPublicKey || secp256k1.Point?.fromPrivateKey || secp256k1.publicKeyCreate
  if (!getPublicKeyFn) {
    throw new Error(`secp256k1 methods not found. Available methods: ${Object.keys(secp256k1).join(', ')}`)
  }

  // Helper functions for Tron address conversion
  function addressToHex(address: string): string {
    const decoded = bs58.decode(address)
    return Array.from(decoded.slice(0, 21)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  function hexToBase58(hex: string): string {
    const bytes = hexToBytes(hex)
    const checksum = keccak_256(keccak_256(bytes)).slice(0, 4)
    const addressWithChecksum = new Uint8Array(bytes.length + 4)
    addressWithChecksum.set(bytes)
    addressWithChecksum.set(checksum, bytes.length)
    return bs58.encode(addressWithChecksum)
  }

  function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  }
  
  // Convert hex private key to bytes
  const privateKeyBytes = hexToBytes(privateKeyHex)
  
  // Generate public key and address
  let publicKey
  try {
    // Try different methods to get public key
    if (secp256k1.getPublicKey) {
      publicKey = secp256k1.getPublicKey(privateKeyBytes, false) // uncompressed
    } else if (secp256k1.Point?.fromPrivateKey) {
      const point = secp256k1.Point.fromPrivateKey(privateKeyBytes)
      publicKey = point.toRawBytes(false) // uncompressed
    } else if (secp256k1.publicKeyCreate) {
      publicKey = secp256k1.publicKeyCreate(privateKeyBytes, false) // uncompressed
    } else {
      throw new Error('No suitable public key generation method found')
    }
  } catch (error) {
    throw new Error(`Failed to generate public key: ${error.message}`)
  }
  
  const publicKeyBytes = publicKey.slice(1) // Remove 0x04 prefix
  
  // Hash public key with Keccak-256 and take last 20 bytes
  const hash = keccak_256(publicKeyBytes)
  const addressBytes = new Uint8Array(21)
  addressBytes[0] = 0x41 // Tron mainnet prefix
  addressBytes.set(hash.slice(-20), 1)
  
  // Convert to Base58Check
  const checksum = keccak_256(keccak_256(addressBytes)).slice(0, 4)
  const addressWithChecksum = new Uint8Array(25)
  addressWithChecksum.set(addressBytes)
  addressWithChecksum.set(checksum, 21)
  const fromAddress = bs58.encode(addressWithChecksum)
  
  console.log(`Using Tron withdrawal address: ${fromAddress}`)
  
  const tronRpcUrl = Deno.env.get('TRON_RPC_URL') || 'https://api.trongrid.io'
  
  // Convert TRX to SUN (1 TRX = 1,000,000 SUN)  
  const amountSun = Math.floor(parseFloat(amount) * 1000000)
  const networkFeeSun = Math.floor(parseFloat(networkFee) * 1000000)
  
  try {
    // Check account balance
    const balanceResponse = await fetch(`${tronRpcUrl}/v1/accounts/${fromAddress}`)
    const balanceData = await balanceResponse.json()
    const balance = balanceData.data?.[0]?.balance || 0
    const totalRequired = amountSun + networkFeeSun + 1000000 // Add 1 TRX for transaction fees
    
    console.log(`Current TRX balance: ${(balance / 1000000).toFixed(6)} TRX`)
    
    if (balance < totalRequired) {
      throw new Error(`Insufficient TRX balance. Available: ${(balance / 1000000).toFixed(6)} TRX, Required: ${(totalRequired / 1000000).toFixed(6)} TRX`)
    }
    
    // Create transaction
    const createTxResponse = await fetch(`${tronRpcUrl}/wallet/createtransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_address: toAddress,
        owner_address: fromAddress,
        amount: amountSun
      })
    })
    
    const transaction = await createTxResponse.json()
    if (transaction.Error) {
      throw new Error(`Transaction creation failed: ${transaction.Error}`)
    }
    
    // Sign transaction
    const txID = transaction.txID
    const rawDataHex = transaction.raw_data_hex
    const txBytes = hexToBytes(rawDataHex)
    const hash = keccak_256(txBytes)
    const signature = secp256k1.sign(hash, privateKeyBytes)
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
    
    console.log(`✅ Tron withdrawal successful: ${txID}`)
    console.log(`💰 Sent: ${amount} TRX to ${toAddress}`)
    
    return txID
    
  } catch (error) {
    if (error.message.includes('Insufficient TRX balance')) {
      throw error
    }
    throw new Error(`Tron withdrawal failed: ${error.message}`)
  }
}

// Solana withdrawal with mnemonic derivation
async function processSolanaWithdrawal(amount: string, toAddress: string, networkFee: string, privateKeyBase58: string): Promise<string> {
  const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = await import('npm:@solana/web3.js@1.87.6')
  
  let fromKeypair: any = null
  
  try {
    // Decode the base58 private key
    const bs58 = (await import('npm:bs58@5.0.0')).default
    const privateKeyBytes = bs58.decode(privateKeyBase58)
    fromKeypair = Keypair.fromSecretKey(privateKeyBytes)
    
    // Verify this is the correct address
    const actualAddress = fromKeypair.publicKey.toBase58()
    console.log(`Using Solana withdrawal address: ${actualAddress}`)
  } catch (error) {
    throw new Error(`Failed to load Solana private key: ${error.message}`)
  }
  
  // Connect to Solana
  const connection = new Connection(
    Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  )
  
  // Convert amounts to lamports for validation
  const amountLamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL)
  const networkFeeLamports = Math.floor(parseFloat(networkFee) * LAMPORTS_PER_SOL)
  
  console.log(`Withdrawal request: ${amount} SOL (${amountLamports} lamports)`)
  console.log(`Network fee: ${networkFee} SOL (${networkFeeLamports} lamports)`)
  console.log(`To address: ${toAddress}`)
  
  // Check account balance first
  try {
    const balance = await connection.getBalance(fromKeypair.publicKey)
    console.log(`Current wallet balance: ${balance} lamports (${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL)`)
    
    // Solana rent exemption minimum (about 0.00089 SOL = 890880 lamports)
    const rentExemptMinimum = 890880
    // Transaction fee estimate (5000 lamports = 0.000005 SOL)
    const transactionFee = 5000
    
    console.log(`Estimated transaction fee: ${transactionFee} lamports (${(transactionFee / LAMPORTS_PER_SOL).toFixed(9)} SOL)`)
    console.log(`Rent exempt minimum: ${rentExemptMinimum} lamports (${(rentExemptMinimum / LAMPORTS_PER_SOL).toFixed(9)} SOL)`)
    
    // Total required = withdrawal amount + transaction fee + rent exemption minimum
    const totalRequired = amountLamports + transactionFee + rentExemptMinimum
    console.log(`Total required: ${totalRequired} lamports (${(totalRequired / LAMPORTS_PER_SOL).toFixed(9)} SOL)`)
    
    if (balance < totalRequired) {
      const availableForWithdrawal = Math.max(0, balance - transactionFee - rentExemptMinimum)
      throw new Error(`Insufficient SOL balance. Available: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL, Required: ${(totalRequired / LAMPORTS_PER_SOL).toFixed(9)} SOL, Available for withdrawal: ${(availableForWithdrawal / LAMPORTS_PER_SOL).toFixed(9)} SOL`)
    }
  } catch (error) {
    if (error.message.includes('Insufficient funds')) {
      throw error
    }
    throw new Error(`Failed to check wallet balance: ${error.message}`)
  }
  
  // Validate destination address
  let toPublicKey: PublicKey
  try {
    toPublicKey = new PublicKey(toAddress)
  } catch (error) {
    throw new Error(`Invalid Solana address: ${toAddress}`)
  }
  
  console.log(`Creating transaction...`)
  
  try {
    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    console.log(`Using blockhash: ${blockhash}`)
    
    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports: amountLamports
    })
    
    // Create transaction
    const transaction = new Transaction({
      feePayer: fromKeypair.publicKey,
      recentBlockhash: blockhash
    }).add(transferInstruction)
    
    console.log(`Sending transaction...`)
    
    // Use sendAndConfirmTransaction for simpler handling
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: false
      }
    )
    
    console.log(`✅ Solana withdrawal successful: ${signature}`)
    console.log(`💰 Sent: ${amount} SOL to ${toAddress}`)
    return signature
    
  } catch (error) {
    console.error(`Solana transaction error:`, error)
    
    if (error.message.includes('Attempt to debit an account but found no record of a prior credit')) {
      throw new Error('Insufficient SOL balance. The wallet has no SOL balance to process withdrawals.')
    }
    if (error.message.includes('insufficient funds')) {
      throw new Error('Transaction failed: Insufficient funds for transaction and fees.')
    }
    if (error.message.includes('Invalid public key')) {
      throw new Error(`Invalid destination address: ${toAddress}`)
    }
    if (error.message.includes('Transaction simulation failed')) {
      throw new Error('Transaction simulation failed: Please check if you have sufficient balance and the destination address is valid.')
    }
    
    throw new Error(`Solana transaction failed: ${error.message}`)
  }
}