import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BlockTransaction {
  hash: string
  from: string
  to: string
  value: string
  blockNumber: number
  blockHash: string
}

interface UserAddress {
  user_id: string
  address: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fetch real-time crypto prices
    const prices = await fetchCryptoPrices()
    console.log('💰 Current prices:', prices)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { network } = await req.json()
    
    if (!['ethereum', 'tron', 'solana'].includes(network)) {
      throw new Error('Invalid network specified')
    }

    console.log(`Starting transaction indexer for ${network}`)

    // Get the latest processed block
    const { data: latestBlockData } = await supabaseClient
      .rpc('get_latest_processed_block', { network_name: network })

    // Get current block number from blockchain
    const currentBlock = await getCurrentBlockNumber(network)
    console.log(`Current block on ${network}: ${currentBlock}`)

    // For first-time processing, start from a recent block instead of 0
    let latestProcessedBlock = latestBlockData || 0
    
    // Set specific starting blocks for each network
    if (latestProcessedBlock === 0) {
      // For other networks, start from 1000 blocks ago only if no previous processing
      if (network === 'solana') {
        // For Solana, start from just 100 blocks ago to catch recent deposits
        latestProcessedBlock = Math.max(0, currentBlock - 100)
        console.log(`Solana indexer starting from recent block ${latestProcessedBlock} (100 blocks ago)`)
      } else {
        latestProcessedBlock = Math.max(0, currentBlock - 1000)
      }
      console.log(`No previous processing found for ${network}, starting from block ${latestProcessedBlock}`)
    }
    
    console.log(`Latest processed block for ${network}: ${latestProcessedBlock}`)

    if (currentBlock <= latestProcessedBlock) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No new blocks to process',
          latestProcessedBlock,
          currentBlock
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all user addresses for this network
    const { data: userAddresses, error: addressError } = await supabaseClient
      .rpc('get_user_addresses_for_network', { network_name: network })

    if (addressError) {
      throw new Error(`Failed to get user addresses: ${addressError.message}`)
    }

    const addressMap = new Map<string, string>()
    userAddresses?.forEach((ua: UserAddress) => {
      if (ua.address) {
        addressMap.set(ua.address.toLowerCase(), ua.user_id)
      }
    })

    console.log(`Monitoring ${addressMap.size} addresses for ${network}`)

    // Process blocks in batches - smaller batches for Solana
    const batchSize = network === 'solana' ? 5 : 10 // Reasonable batches for Solana
    let processedBlocks = 0
    let totalDeposits = 0
    const maxProcessingTime = network === 'solana' ? 20000 : 20000 // 20 seconds for Solana
    const startTime = Date.now()

    for (let blockNum = latestProcessedBlock + 1; blockNum <= currentBlock && (Date.now() - startTime) < 18000; blockNum += batchSize) {
      const endBlock = Math.min(blockNum + batchSize - 1, currentBlock)
      
      // Double-check we don't exceed current block (safety check)
      if (blockNum > currentBlock) {
        console.log(`Reached current block ${currentBlock}, stopping processing`)
        break
      }
      
      console.log(`Processing ${network} blocks ${blockNum} to ${endBlock}`)
      
      try {
        const blockResults = await processBlockRange(network, blockNum, endBlock, addressMap, supabaseClient)
        processedBlocks += blockResults.processedBlocks
        totalDeposits += blockResults.depositsFound
        
        // Much longer delay for Solana to avoid rate limits
        if (network === 'solana') {
          await new Promise(resolve => setTimeout(resolve, 3000)) // Increased to 3s
        }
      } catch (error) {
        console.error(`Error processing batch ${blockNum}-${endBlock}:`, error)
        // Continue with next batch instead of failing
        continue
      }
      
      // Check if we're approaching timeout
      if (Date.now() - startTime > 18000) {
        console.log(`Approaching timeout, stopping at block ${endBlock}`)
        break
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        network,
        processedBlocks,
        depositsFound: totalDeposits,
        latestBlock: currentBlock
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Transaction indexer error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function getCurrentBlockNumber(network: string): Promise<number> {
  switch (network) {
    case 'ethereum':
      return await getEthereumBlockNumber()
    case 'tron':
      return await getTronBlockNumber()
    case 'solana':
      return await getSolanaBlockNumber()
    default:
      throw new Error(`Unsupported network: ${network}`)
  }
}

async function getEthereumBlockNumber(): Promise<number> {
  const rpcUrl = Deno.env.get('ETHEREUM_RPC_URL')
  if (!rpcUrl) throw new Error('ETHEREUM_RPC_URL not configured')

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    })
  })

  const data = await response.json()
  return parseInt(data.result, 16)
}

async function getTronBlockNumber(): Promise<number> {
  const rpcUrl = Deno.env.get('TRON_RPC_URL') || 'https://api.trongrid.io'
  
  const response = await fetch(`${rpcUrl}/wallet/getnowblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  const data = await response.json()
  return data.block_header?.raw_data?.number || 0
}

async function getSolanaBlockNumber(): Promise<number> {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSlot'
    })
  })

  const data = await response.json()
  return data.result || 0
}

async function processBlockRange(
  network: string,
  startBlock: number,
  endBlock: number,
  addressMap: Map<string, string>,
  supabaseClient: any
): Promise<{ processedBlocks: number; depositsFound: number }> {
  let processedBlocks = 0
  let depositsFound = 0

  // Process blocks in parallel batches for better efficiency
  const batchSize = network === 'solana' ? 3 : 5 // Smaller batches for Solana
  
  for (let i = startBlock; i <= endBlock; i += batchSize) {
    const batchEnd = Math.min(i + batchSize - 1, endBlock)
    const blockPromises = []
    
    // Create parallel requests for this batch
    for (let blockNum = i; blockNum <= batchEnd; blockNum++) {
      blockPromises.push(processSingleBlock(network, blockNum, addressMap, supabaseClient))
    }
    
    try {
      // Wait for all blocks in this batch to complete
      const batchResults = await Promise.allSettled(blockPromises)
      
      // Process results
      batchResults.forEach((result, index) => {
        const blockNum = i + index
        if (result.status === 'fulfilled') {
          processedBlocks += result.value.processedBlocks
          depositsFound += result.value.depositsFound
        } else {
          console.error(`Error processing ${network} block ${blockNum}:`, result.reason)
        }
      })
      
      // Add delay between batches to respect rate limits
      if (network === 'solana' && batchEnd < endBlock) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1s between batches
      }
      
    } catch (error) {
      console.error(`Error processing batch ${i}-${batchEnd}:`, error)
    }
  }

  return { processedBlocks, depositsFound }
}

async function processSingleBlock(
  network: string,
  blockNum: number,
  addressMap: Map<string, string>,
  supabaseClient: any
): Promise<{ processedBlocks: number; depositsFound: number }> {
  try {
    const blockData = await getBlockTransactions(network, blockNum)
    
    if (!blockData) {
      // Record empty blocks to track progress
      await supabaseClient
        .from('processed_blocks')
        .insert({
          network,
          block_number: blockNum,
          block_hash: '',
          transaction_count: 0,
          deposits_found: 0
        })
      
      return { processedBlocks: 1, depositsFound: 0 }
    }

    const { transactions, blockHash } = blockData
    let blockDeposits = 0

    // Filter transactions that involve our user addresses
    for (const tx of transactions) {
      const toAddress = tx.to?.toLowerCase()
      if (toAddress && addressMap.has(toAddress)) {
        const userId = addressMap.get(toAddress)!
        
        // Convert amount to USD (simplified conversion)
        const amountCrypto = parseFloat(formatCryptoAmount(tx.value, network))
        const amountUsd = amountCrypto * (prices[network] || getCryptoToUsdRate(network))

        // Only process deposits above minimum threshold
        if (amountUsd >= getMinimumDepositUsd(network)) {
          console.log(`Found deposit: ${amountCrypto} ${network.toUpperCase()} ($${amountUsd.toFixed(2)}) for user ${userId}`)
          
          await createPendingDeposit(supabaseClient, {
            userId,
            network,
            transactionHash: tx.hash,
            fromAddress: tx.from,
            toAddress: tx.to,
            amountCrypto,
            amountUsd,
            blockNumber: blockNum,
            blockHash
          })

          blockDeposits++
        }
      }
    }

    // Record processed block
    await supabaseClient
      .from('processed_blocks')
      .insert({
        network,
        block_number: blockNum,
        block_hash: blockHash,
        transaction_count: transactions.length,
        deposits_found: blockDeposits
      })

    if (blockDeposits > 0) {
      console.log(`${network} block ${blockNum}: Found ${blockDeposits} deposits`)
    }

    return { processedBlocks: 1, depositsFound: blockDeposits }

  } catch (error) {
    console.error(`Error processing ${network} block ${blockNum}:`, error)
    return { processedBlocks: 0, depositsFound: 0 }
  }
}
async function getBlockTransactions(network: string, blockNumber: number): Promise<{ transactions: BlockTransaction[], blockHash: string } | null> {
  switch (network) {
    case 'ethereum':
      return await getEthereumBlockTransactions(blockNumber)
    case 'tron':
      return await getTronBlockTransactions(blockNumber)
    case 'solana':
      return await getSolanaBlockTransactions(blockNumber)
    default:
      throw new Error(`Unsupported network: ${network}`)
  }
}

async function getEthereumBlockTransactions(blockNumber: number): Promise<{ transactions: BlockTransaction[], blockHash: string } | null> {
  const rpcUrl = Deno.env.get('ETHEREUM_RPC_URL')
  if (!rpcUrl) throw new Error('ETHEREUM_RPC_URL not configured')

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: [`0x${blockNumber.toString(16)}`, true],
      id: 1
    })
  })

  const data = await response.json()
  
  // Ethereum: If block doesn't exist, it's unusual - log it
  if (!data.result) return null

  const block = data.result
  // Ethereum: Every block ALWAYS has a hash - never empty!
  console.log(`Ethereum block ${blockNumber}: ${block.transactions.length} transactions, hash: ${block.hash}`)
  
  const transactions: BlockTransaction[] = block.transactions
    .filter((tx: any) => tx.to && tx.value !== '0x0') // Only transactions with recipients and value
    .map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      blockNumber: parseInt(tx.blockNumber, 16),
      blockHash: tx.blockHash
    }))

  // Ethereum: Block hash is ALWAYS present and real
  return { transactions, blockHash: block.hash }
}

async function getTronBlockTransactions(blockNumber: number): Promise<{ transactions: BlockTransaction[], blockHash: string } | null> {
  const rpcUrl = Deno.env.get('TRON_RPC_URL') || 'https://api.trongrid.io'
  
  const response = await fetch(`${rpcUrl}/wallet/getblockbynum`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num: blockNumber })
  })

  const data = await response.json()
  
  if (!data.transactions) return null

  const transactions: BlockTransaction[] = data.transactions
    .filter((tx: any) => 
      tx.raw_data?.contract?.[0]?.type === 'TransferContract' &&
      tx.raw_data.contract[0].parameter?.value?.amount > 0
    )
    .map((tx: any) => {
      const contract = tx.raw_data.contract[0].parameter.value
      return {
        hash: tx.txID,
        from: contract.owner_address,
        to: contract.to_address,
        value: contract.amount.toString(),
        blockNumber,
        blockHash: data.blockID
      }
    })

  return { transactions, blockHash: data.blockID }
}

async function getSolanaBlockTransactions(blockNumber: number): Promise<{ transactions: BlockTransaction[], blockHash: string } | null> {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
  
  try {
    console.log(`🔍 Fetching Solana slot ${blockNumber}...`)
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBlock',
        params: [blockNumber, {
          encoding: 'json',
          transactionDetails: 'full',
          rewards: false,
          maxSupportedTransactionVersion: 0
        }]
      }),
      signal: AbortSignal.timeout(8000) // 8 second timeout for more reliability
    })


    if (!response.ok) {
      if (response.status === 429) {
        console.log(`⚠️ Rate limited for slot ${blockNumber}`)
        // Don't log as error, this is expected
        return null
      }
      console.error(`❌ Solana API error for slot ${blockNumber}: ${response.status}`)
      return null
    }

    const data = await response.json()
    
    if (data.error) {
      // Handle specific Solana RPC errors
      if (data.error.code === -32009) {
        console.log(`⚪ Slot ${blockNumber} was skipped (normal)`)
        return null
      } else if (data.error.code === -32004) {
        console.log(`⏳ Slot ${blockNumber} not confirmed yet`)
        return null
      } else if (data.error.code === -32005) {
        console.log(`🔄 Node is behind for slot ${blockNumber}`)
        return null
      } else {
        console.error(`❌ Solana RPC error for slot ${blockNumber}:`, data.error)
        return null
      }
    }
    
    if (!data.result) {
      console.log(`⚪ No data for slot ${blockNumber}`)
      return null
    }

    const block = data.result
    console.log(`✅ Got slot ${blockNumber} with ${block.transactions?.length || 0} transactions`)
    
    const transactions: BlockTransaction[] = []

    // 🎯 OPTIMIZED: Process ALL transactions efficiently
    if (block.transactions && block.transactions.length > 0) {
      console.log(`🔍 Processing ${block.transactions.length} transactions in slot ${blockNumber}`)
      
      for (const tx of block.transactions) {
        if (tx.meta?.err) continue // Skip failed transactions
        
        const signature = tx.transaction?.signatures?.[0]
        if (!signature) continue

        try {
          // 🎯 EFFICIENT: Get all account data in one pass
          const accountKeys = tx.transaction?.message?.accountKeys || []
          const preBalances = tx.meta?.preBalances || []
          const postBalances = tx.meta?.postBalances || []

          // Safety check: ensure arrays have same length
          const minLength = Math.min(accountKeys.length, preBalances.length, postBalances.length)
          
          // 🔥 FILTER: Only native SOL transfers (not SPL tokens)
          const instructions = tx.transaction?.message?.instructions || []
          const isNativeSOLTransfer = instructions.some(instruction => {
            const programId = accountKeys[instruction.programIdIndex]
            return programId === '11111111111111111111111111111112' // System Program
          })
          
          if (!isNativeSOLTransfer) {
            continue
          }
          
          // 💰 DETECT: Look for SOL balance increases (deposits)
          for (let i = 0; i < minLength; i++) {
            const balanceChange = postBalances[i] - preBalances[i]
            
            // 🎯 THRESHOLD: More than 0.0001 SOL (100k lamports) = ~$0.02
            if (balanceChange > 100000) {
              let fromAddress = 'unknown'
              
              // Find sender (balance decrease)
              for (let j = 0; j < minLength; j++) {
                const senderBalanceChange = postBalances[j] - preBalances[j]
                if (senderBalanceChange < -balanceChange * 0.5) {
                  fromAddress = accountKeys[j]
                  break
                }
              }
              
              const solAmount = balanceChange / 1e9
              const usdAmount = solAmount * 200
              
              console.log(`🎯 FOUND SOL DEPOSIT: ${solAmount.toFixed(9)} SOL (~$${usdAmount.toFixed(4)}) to ${accountKeys[i]} from ${fromAddress}`)
              
              transactions.push({
                hash: signature,
                from: fromAddress,
                to: accountKeys[i],
                value: balanceChange.toString(),
                blockNumber,
                blockHash: block.blockhash || block.previousBlockhash || `slot_${blockNumber}`
              })
            }
          }
          
        } catch (error) {
          console.error(`Error parsing transaction ${signature}:`, error)
        }
      }
    }
    
    // 🔧 ALWAYS use a valid block hash
    const realBlockHash = block.blockhash || block.previousBlockhash || `slot_${blockNumber}`
    
    if (transactions.length > 0) {
      console.log(`🎯 RESULT: Found ${transactions.length} SOL deposits in slot ${blockNumber}`)
    }
    
    return { 
      transactions, 
      blockHash: realBlockHash
    }

  } catch (error) {
    if (!error.message?.includes('timeout')) {
      console.error(`❌ Failed to fetch Solana slot ${blockNumber}:`, error.message)
    }
    return null
  }
}

async function createPendingDeposit(supabaseClient: any, deposit: {
  userId: string
  network: string
  transactionHash: string
  fromAddress: string
  toAddress: string
  amountCrypto: number
  amountUsd: number
  blockNumber: number
  blockHash: string
}) {
  const { error } = await supabaseClient
    .from('pending_deposits')
    .insert({
      user_id: deposit.userId,
      network: deposit.network,
      transaction_hash: deposit.transactionHash,
      from_address: deposit.fromAddress,
      to_address: deposit.toAddress,
      amount_crypto: deposit.amountCrypto,
      amount_usd: deposit.amountUsd,
      block_number: deposit.blockNumber,
      block_hash: deposit.blockHash,
      status: 'confirmed', // Mark as confirmed since we're processing confirmed blocks
      confirmed_at: new Date().toISOString()
    })

  if (error && !error.message.includes('duplicate key')) {
    throw error
  }
}
async function fetchCryptoPrices(): Promise<Record<string, number>> {
  try {
    console.log('🔄 Fetching real-time crypto prices...')
    
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tron,solana&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AIGHTBRUV-Indexer/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Price API error: ${response.status}`)
    }

    const data = await response.json()
    
    const prices = {
      ethereum: data.ethereum?.usd || 3000,
      tron: data.tron?.usd || 0.10,
      solana: data.solana?.usd || 200
    }
    
    console.log('✅ Real-time prices fetched:')
    console.log(`   ETH: $${prices.ethereum.toFixed(2)}`)
    console.log(`   TRX: $${prices.tron.toFixed(4)}`)
    console.log(`   SOL: $${prices.solana.toFixed(2)}`)
    
    return prices
    
  } catch (error) {
    console.error('❌ Failed to fetch crypto prices:', error)
    
    // Return fallback prices
    return {
      ethereum: 3000,
      tron: 0.10,
      solana: 200
    }
  }
}

function formatCryptoAmount(value: string, network: string): string {
  switch (network) {
    case 'ethereum':
      // Convert from Wei to ETH
      return (parseInt(value, 16) / 1e18).toString()
    case 'tron':
      // TRX uses 6 decimal places (SUN to TRX)
      return (parseInt(value) / 1e6).toString()
    case 'solana':
      // Convert from lamports to SOL
      return (parseInt(value) / 1e9).toString()
    default:
      return value
  }
}

function getCryptoToUsdRate(network: string): number {
  // Simplified conversion rates - in production, fetch from price API
  const rates = {
    ethereum: 3000, // $3000 per ETH
    tron: 0.10, // $0.10 per TRX
    solana: 200 // $200 per SOL
  }
  return rates[network as keyof typeof rates] || 1
}

function getMinimumDepositUsd(network: string): number {
  // Minimum deposit thresholds in USD
  const minimums = {
    ethereum: 0.05, // ~0.000017 ETH - lower threshold
    tron: 0.10, // ~1 TRX
    solana: 0.0002 // ~0.000001 SOL - EXTREMELY low threshold to catch any deposit
  }
  return minimums[network as keyof typeof minimums] || 1
}