# XLend – Confidential Lending on FHEVM

XLend is a proof-of-concept **privacy-preserving lending protocol** built on **Zama’s FHEVM**. It demonstrates how fully homomorphic encryption (FHE) can be used to build DeFi primitives where **balances, liquidity, and debts remain encrypted on-chain**, while still allowing correct execution.

The project consists of two core smart contracts:

* **CWETH** – a confidential wrapped ETH token (ERC-7984)
* **Xlend** – a confidential lending market using CWETH

All sensitive values (liquidity, borrow amounts, debts) are handled as encrypted `euint64` values using Zama’s official Solidity libraries.

---

## ✨ Key Features

* 🔐 **Encrypted balances & debts** using FHEVM
* 🧮 Arithmetic on encrypted values (`add`, `sub`, `lt`, `eq`, `select`)
* 🏦 Confidential lending pools (funds)
* 🤝 Private borrowing & repayment
* 🔑 Access-controlled decryption via the Relayer SDK
* ⚙️ Uses only **official Zama libraries** (no deprecated SDKs)

---

## 🧱 Architecture Overview

```
ETH (18 decimals)
   │
   ▼
CWETH (ERC-7984, 6 decimals, encrypted balances)
   │
   ▼
Xlend (encrypted liquidity & debt accounting)
```

### Confidential Token Layer – CWETH

* Users deposit native ETH
* ETH is converted to **encrypted CWETH**
* CWETH follows the ERC-7984 confidential token standard

### Lending Layer – Xlend

* Liquidity providers create funds with encrypted CWETH
* Borrowers borrow against encrypted liquidity
* Debts and available liquidity are always encrypted

---

## 📦 Contracts

### 1. CWETH.sol

A confidential wrapped ETH token implemented using **ERC-7984**.

#### Properties

* **Decimals:** 6
* **Rate:** `1e12` wei per CWETH unit

  * Converts 18-decimal ETH → 6-decimal CWETH

#### Deposit Flow

```solidity
function deposit(address to) public payable
```

1. User sends ETH (`msg.value` in wei)
2. ETH is converted to CWETH units:

   ```
   tokenAmount = weiAmount / RATE
   ```
3. CWETH is minted as an encrypted `euint64`

All balances are confidential and stored encrypted.

---

### 2. Xlend.sol

The main lending protocol.

#### Fund Structure

```solidity
struct Fund {
    address owner;
    uint64 clearLiquidity;
    euint64 liquidity; // encrypted CWETH
}
```

* `clearLiquidity` is a public hint for UI display
* `liquidity` is the true encrypted available balance

#### Core Concepts

* Each fund has a unique `fundId` (starting from **1**)
* Liquidity and debts are always encrypted
* Borrowing and repayment happen privately

---

## 🔄 Protocol Flows

### 1️⃣ Create a Fund

```solidity
function createFund(
    uint64 clearLiquidity,
    externalEuint64 liquidityExt,
    bytes calldata proof
)
```

**Steps:**

1. User encrypts CWETH amount off-chain
2. Encrypted value + proof is submitted
3. Contract:

   * Converts input using `FHE.fromExternal`
   * Transfers encrypted CWETH into the protocol
   * Stores encrypted liquidity

Liquidity providers retain private visibility into their funds.

---

### 2️⃣ Borrow

```solidity
function borrow(
    uint256 fundId,
    externalEuint64 amountExt,
    bytes calldata proof
)
```

**Encrypted logic:**

* Checks `amount ≤ liquidity` **without decrypting**
* If allowed:

  * Liquidity is reduced (encrypted)
  * Borrower debt is increased (encrypted)
* If not allowed:

  * Borrow silently resolves to `0`

This preserves privacy while preventing over-borrowing.

---

### 3️⃣ Repay

```solidity
function repay(
    uint256 fundId,
    externalEuint64 amountExt,
    bytes calldata proof
)
```

* Encrypted comparison against borrower’s debt
* Debt and liquidity updated homomorphically
* CWETH transferred back into the fund

---

## 🔐 Privacy & Access Control

XLend uses FHEVM ACL primitives:

* `FHE.allow(...)` – grant read access
* `FHE.allowThis(...)` – allow contract access
* `FHE.allowTransient(...)` – allow temporary token transfers

### Reading Encrypted Values

* Encrypted values **cannot be read directly**
* Unauthorized reads return a null handle (`0x00…00`)
* Users must decrypt using the **Relayer SDK**

Example:

```ts
const value = await fhevm.userDecrypt(
  ciphertextHandle,
  contractAddress,
  userAddress
);
```

---

## 🧪 Development Notes

* Fund IDs start at **1**, not 0
* `euint64` values must never be cast to `Number`
* Encrypted storage must be initialized before arithmetic
* Reads returning encrypted values must be made **with a signer**

---

## 🛠️ Tooling & Stack

* **Solidity:** ^0.8.27
* **FHE:** Zama FHEVM
* **Confidential Tokens:** ERC-7984
* **Frontend:** ethers.js + wagmi
* **Encryption / Decryption:** `@zama-fhe/relayer-sdk`
* **Network:** Sepolia FHEVM

---

## 🚧 Limitations & Future Work

* No interest rate model (principal-only lending)
* No liquidations
* Borrow failures are silent by design
* No global public metrics (by choice)

Potential extensions:

* Confidential interest accrual
* Publicly decryptable aggregate metrics
* Fund-level risk parameters
* Liquidation mechanisms

---

## 📜 Disclaimer

This project is **experimental** and intended for educational and research purposes only.
It has not been audited and should not be used in production.

---

## 🙌 Acknowledgements

Built using Zama’s FHEVM and official Solidity libraries.

For more information:

* [https://docs.zama.ai](https://docs.zama.ai)
