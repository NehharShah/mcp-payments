# MCP Payment Distribution System

A Model Context Protocol (MCP) based payment distribution system for open source projects using stablecoins.

## Features

- MCP-based architecture for payment distribution
- Support for multiple payment models:
  - Contribution-based payments
  - Time-based payments
  - Milestone-based payments
  - Reputation-weighted distributions
- Stablecoin integration
- Smart contract interaction
- Contribution tracking
- Modern React frontend with:
  - Real-time Web3 integration
  - Interactive data visualizations
  - Responsive UI with Tailwind CSS
  - TypeScript support

## Setup

### Backend
1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run the application:
```bash
uvicorn app.main:app --reload
```

### Frontend
1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. For production build:
```bash
npm run build
```

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Web3 integration with ethers.js and web3-react
- UI components with Tailwind CSS and Headless UI
- Data visualization using Recharts
- State management with React Query

### Backend
- FastAPI
- SQLAlchemy
- Web3.py for blockchain interaction
- PostgreSQL database