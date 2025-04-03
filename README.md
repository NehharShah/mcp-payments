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

## Setup

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