# VeilBook

This project is submitted as part of Veilbook.  
It consists of two repositories:

1. **Main Repo (this one)** 
2. **Contract Repo** – https://github.com/VeilBook/veilbook-contract

> **Your limit orders. Nobody else's business.**

VeilBook is a confidential limit order book built on Uniswap V4. It uses Fully Homomorphic Encryption (FHE) to keep your order sizes private — not just from other traders, but from searchers, and block builders.

Live on **Sepolia Testnet** · Built with Zama fhEVM · Powered by Uniswap V4

---

### Demo Live Link: 

##### Demo Link: https://veilbook-frontend.vercel.app/

##### Demo Video: https://www.youtube.com/watch?v=8kg8ZR38Dik

[![Watch the video](https://img.youtube.com/vi/8kg8ZR38Dik/maxresdefault.jpg)](https://www.youtube.com/watch?v=8kg8ZR38Dik)



## The Problem

Every limit order on a standard DEX is public. Anyone can see your order size, your price, and your wallet. MEV bots exploit this to front-run, sandwich, and extract value from your trades before they even execute.

The root cause is simple: the data is readable. As long as order details are plaintext onchain, they are a target.

VeilBook fixes this at the infrastructure level — not by obscuring data, but by making it mathematically unreadable to everyone except the order owner.

---

## How it Works

When you place a limit order on VeilBook:

1. Your order amount is **encrypted locally** using the Zama FHE SDK before it ever leaves your browser
2. The **encrypted ciphertext** is submitted to the VeilBook hook contract — no plaintext ever touches the chain
3. VeilBook stores the order in an onchain **Confidential Limit Order Book**, encrypted at rest
4. When a swap crosses your limit tick, the hook's `afterSwap` callback settles your order using **homomorphic arithmetic** — amounts are matched and transferred without ever being decrypted
5. Only you can reveal your filled amounts, by signing a decryption request that goes to the Zama Relayer — amounts come back only to your browser

The result: MEV is structurally impossible. There is nothing for a searcher to read.

---

## Features

- **Confidential limit orders** — encrypted `euint64` amounts, invisible to everyone except you
- **Zero MEV** — searchers cannot front-run what they cannot see
- **Self-sovereign decryption** — only you can decrypt your fills, via EIP-712 signature
- **No keeper required** — matching happens fully onchain inside `afterSwap`
- **Multi-token** — trade NBL, SLR, ATH, VTX, ZTA against USDC on Sepolia
- **Non-custodial** — VeilBook never holds your keys or your plaintext balances

---

## Quick Start

### Prerequisites

- Node.js >= 18
- MetaMask or Rabby wallet configured for Sepolia
- Sepolia ETH for gas (get some from a [Sepolia faucet](https://sepoliafaucet.com))

> **Wallet RPC tip**: Set your wallet's Sepolia RPC to Alchemy or Infura. Free public RPCs (publicnode, drpc) have strict rate limits that cause order-fetching failures.

---

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/VeilBook/veilbook-frontend
cd veilbook-frontend

# Install dependencies
npm install
```

---

### 2. Start Development Environment

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 3. Connect MetaMask

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Connect Wallet** in the top right
3. Select MetaMask (or Rabby)
4. Switch to the **Sepolia Testnet** when prompted
5. If Sepolia is not in your wallet, add it manually:
   - **Network Name**: Sepolia
   - **RPC URL**: `https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY`
   - **Chain ID**: `11155111`
   - **Currency Symbol**: `ETH`
   - **Explorer**: `https://sepolia.etherscan.io`

---

## Using the App

### Get Test Tokens

Head to **Faucet** to mint test tokens for any of the supported trading pairs before you start trading.

---

### Place an Order

1. Go to **Trade** and select a token pair (e.g. NBL/USDC)
2. Enter your limit price and order amount
3. Choose **Buy** or **Sell**
4. Hit **Place Order** — the app will walk you through:
   - **Approve** — authorize VeilBook to spend your token
   - **Deposit** — transfer tokens into VeilBook; you receive an encrypted token balance in return
   - **Set Operator** — authorize VeilBook to move your encrypted balance
   - **Encrypt** — your order amount is encrypted in-browser using Zama SDK
   - **Submit** — the encrypted order is sent to the hook contract onchain

Once placed, your order sits in the confidential order book waiting to be matched. No one can see its size.

---

### View and Manage Your Orders

Go to **Orders** to see all your active and closed limit orders.

Since amounts are encrypted onchain, they show as **🔒 Encrypted** by default. To reveal your fills:

1. Click **Decrypt** on any order
2. Sign the EIP-712 decryption request in your wallet
3. The Zama Relayer processes the request and returns your plaintext filled amounts — only to your browser

Once decrypted, you can:
- **Claim** — withdraw your filled output tokens to your wallet
- **Cancel** — cancel an active unfilled or partially filled order and recover your remaining balance

---

### Initialize a Pool (Advanced)

Go to **Pools** to view existing Uniswap V4 pools or initialize a new one with the VeilBook hook. You can configure your own fee tier and tick spacing when deploying a custom pool.

---

## App Structure

```
/app/trade       — place confidential limit orders
/app/orders      — view, decrypt, cancel, and claim your orders  
/app/pools       — initialize Uniswap V4 pools with the VeilBook hook
/app/faucet      — mint Sepolia test tokens
/lib/math.ts     — tick calculations, price conversions, poolId computation
/lib/constants   — deployed addresses, ABIs, pool keys
```

---

## Contract Addresses (Sepolia)

| Contract | Address |
|---|---|
| VeilBook Hook | `0x67CbE7937E20Af24fBcc8Be354A5b4B5601D5040` |
| MockUSDC | `0xFf191a477C6aa6e0d0176Ed9711c6A66a68a510d` |
| PoolManager | `0x19380Fd31d8044fB3349d9eaEFfF779Bf41f885D` |

### Mock Tokens (Sepolia)

| Token | Address |
|---|---|
| NBL (Nebula) | `0x5EDB776E0e8324609276De545118E5f4ef0e820B` |
| SLR (Solaris) | `0x2f1b32866FFF6c5c48324806A94a3766cF69861D` |
| ATH (Aether) | `0x3dC4270317C33873538EfBE05F22711F33187FEa` |
| VTX (Vortex) | `0x3C8330c0A975b77bc9d809b75d32ACee49C64cc9` |
| ZTA | `0xBce34969854a0950788f248D18B997b8b05798F9` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Privacy Core | Zama fhEVM Relayer SDK |
| DEX Infrastructure | Uniswap V4 Hooks |
| Web3 | Wagmi + RainbowKit + ethers.js v6 |
| Styling | Tailwind CSS |

---


## Known Limitations

- **Sepolia only** — VeilBook is currently deployed on testnet. 
- **Decrypt required before cancel** — to cancel an order, you must first decrypt it so the contract knows the unfilled plaintext amount.

---

## 📄 License

Distributed under the MIT License.
