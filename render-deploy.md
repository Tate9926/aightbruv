# 🚀 Render Production Deployment Guide

## 📋 **What You're Deploying:**
1. **Frontend** - React app (main game interface)
2. **Deposit Listener** - Real-time WebSocket service for all networks
3. **Auto-Transfer** - Automatic fund sweeping service

## 🔧 **Deployment Steps:**

### **1. Create Render Account**
- Go to [render.com](https://render.com)
- Sign up with GitHub (recommended)

### **2. Deploy Frontend (Web Service)**
1. **Create New Web Service**
2. **Connect your GitHub repo**
3. **Configure:**
   ```
   Name: aightbruv-frontend
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: npm run preview
   ```

4. **Add Environment Variables:**
   ```
   NODE_ENV=production
   VITE_SUPABASE_URL=https://lystaruqkfcfxpgdlzvv.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### **3. Deploy Deposit Listener (Background Service)**
1. **Create New Background Worker**
2. **Connect same GitHub repo**
3. **Configure:**
   ```
   Name: aightbruv-deposit-listener
   Environment: Node
   Build Command: cd deposit-listener && npm install
   Start Command: cd deposit-listener && node multi-network-listener.js
   ```

4. **Add Environment Variables:**
   ```
   NODE_ENV=production
   SUPABASE_URL=https://lystaruqkfcfxpgdlzvv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   SOLANA_WSS_URL=wss://lb.drpc.org/solana/AvyFcV4C7Eatu7YOOIJHzKFlwb_Ag4sR8IV_qhnKxixj
   ETHEREUM_WSS_URL=wss://lb.drpc.org/ethereum/AvyFcV4C7Eatu7YOOIJHzKFlwb_Ag4sR8IV_qhnKxixj
   TRON_WSS_URL=wss://lb.drpc.org/tron/AvyFcV4C7Eatu7YOOIJHzKFlwb_Ag4sR8IV_qhnKxixj
   SOLANA_RPC_URL=https://lb.drpc.org/solana/AvyFcV4C7Eatu7YOOIJHzKFlwb_Ag4sR8IV_qhnKxixj
   ETHEREUM_RPC_URL=https://lb.drpc.org/ethereum/AvyFcV4C7Eatu7YOOIJHzKFlwb_Ag4sR8IV_qhnKxixj
   TRON_RPC_URL=https://lb.drpc.org/tron/AvyFcV4C7Eatu7YOOIJHzKFlwb_Ag4sR8IV_qhnKxixj
   MASTER_MNEMONIC=island regular found stumble another cash loud slim one jewel pear midnight
   COLLECTION_WALLET_ADDRESS=Zg5r67TdhqKf6YYcU6hi86j8Up7LX9DzBo5VZdmQE8y
   ETHEREUM_COLLECTION_ADDRESS=0x6608F3E90b2E0398CC9e9FF7D5bB6B1aBbeF357c
   TRON_COLLECTION_ADDRESS=TAWfSzCDG93EKQxutoYiUi5x7NLXTNoV7D
   MIN_DEPOSIT_SOL=0.0001
   ```

### **4. Deploy Auto-Transfer Service (Background Service)**
1. **Create Another Background Worker**
2. **Connect same GitHub repo**
3. **Configure:**
   ```
   Name: aightbruv-auto-transfer
   Environment: Node
   Build Command: cd deposit-listener && npm install
   Start Command: cd deposit-listener && node multi-network-auto-transfer.js listen
   ```

4. **Use same environment variables** as deposit listener

## 🎯 **Production Architecture:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │ Deposit Listener │    │ Auto-Transfer   │
│   (Web Service) │    │ (Background)     │    │ (Background)    │
│                 │    │                  │    │                 │
│ • Game UI       │    │ • Real-time WSS  │    │ • Fund sweeping │
│ • User accounts │    │ • Deposit detect │    │ • Collection    │
│ • Withdrawals   │    │ • Balance credit │    │ • Multi-network │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │   Supabase DB       │
                    │ + Edge Functions    │
                    └─────────────────────┘
```

## ✅ **Benefits:**
- **24/7 uptime** with Render's infrastructure
- **Auto-scaling** and health checks
- **Real-time deposits** across all networks
- **Automatic fund collection**
- **Production-grade reliability**

Deploy all three services and your custodial wallet system will be **fully operational**! 🚀