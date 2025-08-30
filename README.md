# 🐍 AIGHTBRUV - Multiplayer Snake Game

A real-time multiplayer snake game with cryptocurrency deposits and withdrawals.

## 🚀 Features

- **Real-time multiplayer** snake gameplay
- **Cryptocurrency deposits** (Solana, Ethereum, Tron)
- **Instant withdrawals** to your wallet
- **Live leaderboards** and statistics
- **Affiliate program** with 10% commission
- **Mobile-responsive** design

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Real-time)
- **Blockchain:** Multi-network support (SOL/ETH/TRX)
- **Deployment:** Render (Frontend + Background Workers)

## 🏗️ Architecture

```
Frontend (React)
    ↓
Supabase Database
    ↑
Background Workers
    ↓
Blockchain Networks
```

## 📦 Deployment

### Production (Render)
1. Push to GitHub
2. Deploy 3 services to Render:
   - Frontend Web Service
   - Deposit Listener Worker
   - Auto-Transfer Worker

### Local Development
```bash
npm install
npm run dev
```

## 🔧 Environment Variables

See `.env.example` for required configuration.

## 📄 License

MIT License - See LICENSE file for details.