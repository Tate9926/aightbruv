import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fetch real-time crypto prices for accurate USD conversion
    const prices = await fetchCryptoPrices()
    console.log('💰 Using real-time prices:', prices)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting deposit processor...')

    // Get all confirmed pending deposits that haven't been credited yet
    const { data: pendingDeposits, error: fetchError } = await supabaseClient
      .from('pending_deposits')
      .select('*')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(50) // Reduced batch size for faster processing

    if (fetchError) {
      throw new Error(`Failed to fetch pending deposits: ${fetchError.message}`)
    }

    if (!pendingDeposits || pendingDeposits.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending deposits to process',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingDeposits.length} pending deposits`)

    let processed = 0
    let failed = 0

    for (const deposit of pendingDeposits) {
      try {
        // Verify the deposit has enough confirmations
        const currentConfirmations = await getTransactionConfirmations(
          deposit.network,
          deposit.transaction_hash
        )

        if (currentConfirmations < deposit.required_confirmations) {
          console.log(`Deposit ${deposit.id} needs more confirmations: ${currentConfirmations}/${deposit.required_confirmations}`)
          
          // Update confirmation count
          await supabaseClient
            .from('pending_deposits')
            .update({ confirmations: currentConfirmations })
            .eq('id', deposit.id)
          
          continue
        }

        // Credit the user's account
        // Start transaction for atomic balance update
        const { error: balanceError } = await supabaseClient
          .from('profiles')
          .update({
            balance: supabaseClient.raw(`balance + ${deposit.amount_usd}`)
          })
          .eq('id', deposit.user_id)

        if (balanceError) {
          throw new Error(`Failed to credit deposit: ${balanceError.message}`)
        }

        // Mark deposit as credited
        await supabaseClient
          .from('pending_deposits')
          .update({
            status: 'credited',
            credited_at: new Date().toISOString()
          })
          .eq('id', deposit.id)

        // Create audit record
        await supabaseClient
          .from('deposit_transactions')
          .insert({
            user_id: deposit.user_id,
            network: deposit.network,
            transaction_hash: deposit.transaction_hash,
            from_address: deposit.from_address,
            to_address: deposit.to_address,
            amount_crypto: deposit.amount_crypto,
            amount_usd: deposit.amount_usd,
            block_number: deposit.block_number,
            block_hash: deposit.block_hash,
            confirmations: currentConfirmations
          })

        console.log(`Successfully credited deposit ${deposit.id} for user ${deposit.user_id}: $${deposit.amount_usd}`)
        processed++

      } catch (error) {
        console.error(`Failed to process deposit ${deposit.id}:`, error)
        
        // Mark deposit as failed
        await supabaseClient
          .from('pending_deposits')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', deposit.id)
        
        failed++
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        failed,
        total: pendingDeposits.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Deposit processor error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function getTransactionConfirmations(network: string, txHash: string): Promise<number> {
  try {
    switch (network) {
      case 'ethereum':
        return await getEthereumConfirmations(txHash)
      case 'tron':
        return await getTronConfirmations(txHash)
      case 'solana':
        return await getSolanaConfirmations(txHash)
      default:
        return 1 // Default to 1 confirmation for unknown networks
    }
  } catch (error) {
    console.error(`Error getting confirmations for ${txHash}:`, error)
    return 0
  }
}

async function getEthereumConfirmations(txHash: string): Promise<number> {
  const rpcUrl = Deno.env.get('ETHEREUM_RPC_URL')
  if (!rpcUrl) return 1

  // Get transaction receipt
  const txResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [txHash],
      id: 1
    })
  })

  const txData = await txResponse.json()
  if (!txData.result) return 0

  const txBlockNumber = parseInt(txData.result.blockNumber, 16)

  // Get current block number
  const blockResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    })
  })

  const blockData = await blockResponse.json()
  const currentBlock = parseInt(blockData.result, 16)

  return Math.max(0, currentBlock - txBlockNumber + 1)
}

async function getTronConfirmations(txHash: string): Promise<number> {
  const rpcUrl = Deno.env.get('TRON_RPC_URL') || 'https://api.trongrid.io'
  
  const response = await fetch(`${rpcUrl}/wallet/gettransactioninfobyid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: txHash })
  })

  const data = await response.json()
  
  if (!data.blockNumber) return 0

  // Get current block
  const blockResponse = await fetch(`${rpcUrl}/wallet/getnowblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  const blockData = await blockResponse.json()
  const currentBlock = blockData.block_header?.raw_data?.number || 0

  return Math.max(0, currentBlock - data.blockNumber + 1)
}

async function getSolanaConfirmations(txHash: string): Promise<number> {
  const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignatureStatuses',
      params: [[txHash], { searchTransactionHistory: true }]
    })
  })

  const data = await response.json()
  
  if (!data.result?.value?.[0]) return 0

  const status = data.result.value[0]
  return status.confirmations || (status.confirmationStatus === 'finalized' ? 32 : 1)
}

async function fetchCryptoPrices(): Promise<Record<string, number>> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tron,solana&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AIGHTBRUV-Processor/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Price API error: ${response.status}`)
    }

    const data = await response.json()
    
    return {
      ethereum: data.ethereum?.usd || 3000,
      tron: data.tron?.usd || 0.10,
      solana: data.solana?.usd || 200
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch crypto prices, using fallbacks:', error)
    return {
      ethereum: 3000,
      tron: 0.10,
      solana: 200
    }
  }
}