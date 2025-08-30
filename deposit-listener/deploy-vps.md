# VPS Deployment Guide

## 🚀 Complete VPS Setup for Solana Auto-Transfer

### 1. **Copy All Files to VPS**
```bash
# Upload entire deposit-listener folder to VPS
scp -r deposit-listener/ user@your-vps:/home/user/
```

### 2. **Install Dependencies on VPS**
```bash
ssh user@your-vps
cd /home/user/deposit-listener
npm install
```

### 3. **Configure Environment Variables**
```bash
# Copy and edit .env file
cp .env.example .env
nano .env

# Add your actual values:
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WSS_URL=wss://api.mainnet-beta.solana.com
MASTER_MNEMONIC=your_actual_mnemonic
COLLECTION_WALLET_ADDRESS=your_collection_address
```

### 4. **Install Process Manager**
```bash
# Install PM2 for 24/7 operation
npm install -g pm2
```

### 5. **Start Services**
```bash
# Start WebSocket deposit listener
pm2 start index.js --name "deposit-listener"

# Start auto-transfer service
pm2 start auto-transfer.js --name "auto-transfer" -- listen

# Save PM2 configuration
pm2 startup
pm2 save
```

### 6. **Monitor Services**
```bash
# Check status
pm2 status

# View logs
pm2 logs deposit-listener
pm2 logs auto-transfer

# Restart if needed
pm2 restart all
```

### 7. **Firewall Setup**
```bash
# Allow necessary ports
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

## 🔄 How It Works in Production

### **Flow:**
1. **💰 Deposit detected** → WebSocket listener (running 24/7)
2. **💳 Credit user** → Updates Supabase database
3. **🚀 Auto-sweep** → Transfers SOL to collection wallet
4. **✅ Complete** → User has USD balance, SOL collected

### **Services Running:**
- `deposit-listener` → Monitors deposits via WebSocket
- `auto-transfer` → Sweeps funds automatically
- Both services restart automatically if they crash

## 🛡️ Security Considerations

### **Environment Variables:**
- ✅ Keep `.env` file secure (never commit to git)
- ✅ Use strong server passwords
- ✅ Regular security updates

### **Mnemonic Security:**
- ⚠️ **CRITICAL**: Store mnemonic securely
- ⚠️ Consider hardware security modules for production
- ⚠️ Regular key rotation

## 📊 Monitoring

### **Check Logs:**
```bash
# Real-time logs
pm2 logs --lines 100

# Check for errors
pm2 logs | grep ERROR
```

### **Database Monitoring:**
- Monitor `pending_deposits` table
- Check `processed_blocks` for indexing progress
- Watch `deposit_transactions` for successful credits

## 🔧 Troubleshooting

### **Common Issues:**
1. **RPC Rate Limits** → Use premium RPC provider
2. **WebSocket Disconnects** → PM2 auto-restarts
3. **Insufficient SOL** → Monitor collection wallet balance
4. **Database Errors** → Check Supabase connection

### **Performance Optimization:**
- Use dedicated RPC endpoint
- Monitor server resources
- Set up alerts for failures