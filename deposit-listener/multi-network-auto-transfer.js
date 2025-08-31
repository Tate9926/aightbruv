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

if (!globalThis.fetch) globalThis.fetch = fetch

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

class MultiNetworkAutoTransfer {
  constructor() {
    this.connections = {
      solana: new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed'),
      ethereum: null,
      tron: null
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch } }
    )

    this.collectionAddresses = {
      solana: process.env.COLLECTION_WALLET_ADDRESS,
      ethereum: process.env.ETHEREUM_COLLECTION_ADDRESS,
      tron: process.env.TRON_COLLECTION_ADDRESS
    }

    console.log('🚀 Multi-Network Auto Transfer Service initialized')
  }

  generateKeypairFromMnemonic(mnemonic, network, accountIndex) {
    const seed = mnemonicToSeedSync(mnemonic)
    const derivationPaths = {
      ethereum: `m/44'/60'/0'/0/${accountIndex}`,
      tron: `m/44'/195'/0'/0/${accountIndex}`,
      solana: `m/44'/501'/${accountIndex}'/0'`
    }
    const path = derivationPaths[network]

    if (network === 'solana') {
      const derivedSeed = derivePath(path, seed.toString('hex')).key
      return Keypair.fromSeed(derivedSeed)
    } else {
      const hdkey = HDKey.fromMasterSeed(seed)
      const derivedKey = hdkey.derive(path)
      if (!derivedKey.privateKey) throw new Error(`Failed to derive ${network} private key`)
      const privateKeyHex = Buffer.from(derivedKey.privateKey).toString('hex')
      const address = this.generateAddressFromPrivateKey(network, derivedKey.privateKey)
      return { privateKey: derivedKey.privateKey, privateKeyHex, address }
    }
  }

  generateAddressFromPrivateKey(network, privateKeyBytes) {
    const publicKey = secp256k1.getPublicKey(privateKeyBytes, false)
    const publicKeyBytes = publicKey.slice(1)
    const hash = keccak_256(publicKeyBytes)
    if (network === 'ethereum') return '0x' + Buffer.from(hash.slice(-20)).toString('hex')
    if (network === 'tron') {
      const bytes = new Uint8Array(21)
      bytes[0] = 0x41
      bytes.set(hash.slice(-20), 1)
      const checksum = keccak_256(keccak_256(bytes)).slice(0, 4)
      const addr = new Uint8Array(25)
      addr.set(bytes)
      addr.set(checksum, 21)
      return bs58.encode(addr)
    }
    throw new Error(`Unsupported network: ${network}`)
  }

  // --- Solana Transfer ---
  async transferSolanaFunds(sourceKeypair, reason = 'Auto sweep') {
    try {
      const sourceAddress = sourceKeypair.publicKey
      const collectionPublicKey = new PublicKey(this.collectionAddresses.solana)
      const balance = await this.connections.solana.getBalance(sourceAddress)
      if (balance === 0) return null

      const { blockhash, lastValidBlockHeight } = await this.connections.solana.getLatestBlockhash('confirmed')
      const dummyTx = new Transaction({
        feePayer: sourceAddress,
        recentBlockhash: blockhash
      }).add(SystemProgram.transfer({ fromPubkey: sourceAddress, toPubkey: collectionPublicKey, lamports: balance }))
      const feeEstimate = await this.connections.solana.getFeeForMessage(dummyTx.compileMessage(), 'confirmed')
      const transactionFee = feeEstimate.value || 5000
      const transferAmount = balance - transactionFee
      if (transferAmount <= 0) return null

      const tx = new Transaction({ feePayer: sourceAddress, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: sourceAddress, toPubkey: collectionPublicKey, lamports: transferAmount }))

      const signature = await this.connections.solana.sendTransaction(tx, [sourceKeypair])
      await this.connections.solana.confirmTransaction({ signature, blockhash, lastValidBlockHeight })
      return { signature, amount: transferAmount, amountCrypto: transferAmount / LAMPORTS_PER_SOL, fee: transactionFee, from: sourceAddress.toBase58(), to: this.collectionAddresses.solana }
    } catch (err) { throw err }
  }

  // --- Ethereum Transfer ---
  async transferEthereumFunds(sourceWallet) {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL)
    const wallet = new ethers.Wallet(sourceWallet.privateKeyHex, provider)
    const balance = await provider.getBalance(wallet.address)
    if (balance === 0n) return null
    const feeData = await provider.getFeeData()
    const gasLimit = 21000n
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei')
    const gasCost = gasLimit * gasPrice
    const transferAmount = balance - gasCost
    if (transferAmount <= 0n) return null
    const txResponse = await wallet.sendTransaction({ to: this.collectionAddresses.ethereum, value: transferAmount, gasLimit, gasPrice })
    await txResponse.wait()
    return { signature: txResponse.hash, amount: transferAmount, amountCrypto: parseFloat(ethers.formatEther(transferAmount)), fee: gasCost, from: wallet.address, to: this.collectionAddresses.ethereum }
  }

  // --- Tron Transfer ---
  async transferTronFunds(sourceWallet) {
    const tronRpcUrl = process.env.TRON_RPC_URL
    const fromAddress = sourceWallet.address
    const balanceResponse = await fetch(`${tronRpcUrl}/v1/accounts/${fromAddress}`)
    const balanceData = await balanceResponse.json()
    const balance = balanceData.data?.[0]?.balance || 0
    const transactionFee = 1000000
    const transferAmount = balance - transactionFee
    if (transferAmount <= 0) return null
    const createTxResponse = await fetch(`${tronRpcUrl}/wallet/createtransaction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_address: this.hexToBase58(this.addressToHex(this.collectionAddresses.tron)),
        owner_address: this.hexToBase58(this.addressToHex(fromAddress)),
        amount: transferAmount
      })
    })
    const transaction = await createTxResponse.json()
    const txBytes = this.hexToBytes(transaction.raw_data_hex)
    const hash = keccak_256(txBytes)
    const signature = secp256k1.sign(hash, sourceWallet.privateKey).toCompactHex()
    const signedTx = { ...transaction, signature: [signature] }
    const broadcastResponse = await fetch(`${tronRpcUrl}/wallet/broadcasttransaction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signedTx) })
    const result = await broadcastResponse.json()
    if (!result.result) throw new Error(result.message || 'Unknown error')
    return { signature: transaction.txID, amount: transferAmount, amountCrypto: transferAmount / 1000000, fee: transactionFee, from: fromAddress, to: this.collectionAddresses.tron }
  }

  addressToHex(address) { const decoded = bs58.decode(address); return Array.from(decoded.slice(0, 21)).map(b => b.toString(16).padStart(2, '0')).join('') }
  hexToBase58(hex) { const bytes = this.hexToBytes(hex); const checksum = keccak_256(keccak_256(bytes)).slice(0, 4); const arr = new Uint8Array(bytes.length + 4); arr.set(bytes); arr.set(checksum, bytes.length); return bs58.encode(arr) }
  hexToBytes(hex) { const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16); return bytes }

  async processTransferForUser(network, userId, accountIndex, reason = 'Deposit sweep') {
    const masterMnemonic = process.env.MASTER_MNEMONIC
    const userWallet = this.generateKeypairFromMnemonic(masterMnemonic, network, accountIndex)
    let result
    switch (network) {
      case 'solana': result = await this.transferSolanaFunds(userWallet, reason); break
      case 'ethereum': result = await this.transferEthereumFunds(userWallet, reason); break
      case 'tron': result = await this.transferTronFunds(userWallet, reason); break
      default: throw new Error(`Unsupported network: ${network}`)
    }
    if (result) await this.supabase.from('transfer_logs').insert({ user_id: userId, network, from_address: result.from, to_address: result.to, amount_crypto: result.amountCrypto, transaction_hash: result.signature, reason, status: 'completed' })
    return result
  }

  // --- Real-time listener ---
  async startAutoTransferListener() {
    const networks = ['solana', 'ethereum', 'tron']
    for (const network of networks) {
      this.supabase.channel(`deposit-notifications-${network}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pending_deposits', filter: `network=eq.${network}` }, async payload => {
          const deposit = payload.new
          const { data: profile } = await this.supabase.from('profiles').select('account_index').eq('id', deposit.user_id).single()
          await this.processTransferForUser(network, deposit.user_id, profile?.account_index || 0, `Auto-sweep for ${network} deposit ${deposit.id}`)
          console.log(`✅ Auto-transferred ${network.toUpperCase()} for deposit ${deposit.id}`)
        })
        .subscribe()
      console.log(`✅ ${network.toUpperCase()} auto-transfer listener active`)
    }
  }
}

export { MultiNetworkAutoTransfer }
