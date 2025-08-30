# Multi-Network Deposit Listener & Auto-Transfer

Real-time WebSocket-based deposit detection and automatic fund sweeping for Solana, Ethereum, and Tron.

## Setup

1. **Install dependencies:**
```bash
cd deposit-listener
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. **Run the services:**
```bash
# Multi-network deposit listener with auto-sweep
node multi-network-listener.js

# Solana-only deposit listener (legacy)
node index.js

# Manual sweep operations
node multi-network-auto-transfer.js sweep-all
node multi-network-auto-transfer.js sweep-user solana <user_id>
node multi-network-auto-transfer.js sweep-user ethereum <user_id>
node multi-network-auto-transfer.js sweep-user tron <user_id>
```

## Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (not anon key!)
- `SOLANA_WSS_URL` - WebSocket URL for Solana
- `ETHEREUM_WSS_URL` - WebSocket URL for Ethereum (your private endpoint)
- `TRON_WSS_URL` - WebSocket URL for Tron (your private endpoint)
- `ETHEREUM_RPC_URL` - HTTP RPC URL for Ethereum
- `TRON_RPC_URL` - HTTP RPC URL for Tron
- `MIN_DEPOSIT_SOL` - Minimum deposit threshold (default: 0.0001)
- `COLLECTION_WALLET_ADDRESS` - Solana collection address
- `ETHEREUM_COLLECTION_ADDRESS` - Ethereum collection address
- `TRON_COLLECTION_ADDRESS` - Tron collection address
- `MASTER_MNEMONIC` - HD wallet master mnemonic (KEEP SECRET!)

## Features

- ✅ **Multi-network support** (Solana, Ethereum, Tron)
- ✅ **Real-time deposit detection** via WebSocket for all networks
- ✅ **Automatic fund sweeping** to collection wallets
- ✅ **HD wallet derivation** from master mnemonic
- ✅ **Automatic reconnection** if connection drops
- ✅ **Dynamic address loading** from database
- ✅ **Instant balance crediting** 
- ✅ **Duplicate prevention**
- ✅ **Comprehensive logging**
- ✅ **Real-time price conversion** using CoinGecko API

## Auto-Transfer System

The system automatically sweeps deposited funds to your collection wallets:

### Collection Addresses:
- **Solana**: `6MCvSMpgu7bM5tS1wS5HPrtST3fZfb1NwRp8UYZhyKfc` (or your configured address)
- **Ethereum**: `0x6608F3E90b2E0398CC9e9FF7D5bB6B1aBbeF357c`
- **Tron**: `TAWfSzCDG93EKQxutoYiUi5x7NLXTNoV7D`

### How it works:
1. **Deposit detected** → WebSocket listener catches the transaction
2. **User credited** → USD balance updated in database
3. **Auto-sweep triggered** → Funds transferred to collection wallet
4. **Complete** → User has spendable balance, you have the crypto

## Manual Operations

```bash
# Sweep all addresses across all networks
node multi-network-auto-transfer.js sweep-all

# Sweep specific user on specific network
node multi-network-auto-transfer.js sweep-user solana <user_id>
node multi-network-auto-transfer.js sweep-user ethereum <user_id>
node multi-network-auto-transfer.js sweep-user tron <user_id>

# Start auto-transfer listener only
node multi-network-auto-transfer.js listen
```

## Deployment

### Option 1: VPS/Server
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start index.js --name "solana-deposits"
pm2 startup
pm2 save
```

### Option 2: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

### Option 3: Railway/Render/Heroku
Just connect your repo and deploy!

## Monitoring

The service logs all activity:
- 📡 WebSocket connection status
- 📋 Address loading and subscriptions
- 💰 Deposit detection and processing
- ❌ Errors and reconnection attempts

## How It Works

1. **Connects** to Solana WebSocket
2. **Loads** all user Solana addresses from database
3. **Subscribes** to balance changes for each address
4. **Detects** incoming SOL deposits instantly
5. **Credits** user balances in real-time
6. **Prevents** duplicate processing