# Atlas Blockchain

Atlas stores immutable memory anchors on Avalanche Fuji. The contract records the creator wallet, memory title, country, memory type, note, and block timestamp directly on-chain.

## Install

```bash
cd blockchain
bun install
```

## Environment

Create a local `.env` file:

```bash
cp .env.example .env
```

Set:

```env
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=
```

Never commit `.env`, never share a private key, and never enter a seed phrase.

## Compile

```bash
bun run compile
```

## Test

```bash
bun run test
```

Run both:

```bash
bun run check
```

## Fuji Test AVAX

Get test AVAX for the deployer wallet from the Avalanche Fuji faucet, then confirm the wallet has enough AVAX to pay deployment gas.

## Deploy To Fuji

```bash
bun run deploy:fuji
```

The deployment uses the Hardhat Ignition module in `ignition/modules/Atlas.ts`, requires no constructor arguments, waits for confirmation, and prints:

- Contract address
- Network name
- Chain ID
- Deployer address
- Fuji explorer URL

Verify the deployment by opening the printed Snowtrace testnet URL.

## Contract Functions

`createMemory(string calldata title, string calldata country, string calldata kind, string calldata description)` publishes an immutable memory and returns its new ID. IDs start at `1`.

`getMemory(uint256 memoryId)` returns a stored memory and reverts for ID `0` or an ID that has not been published.

`getMemoriesByCreator(address creator)` returns all memory IDs published by a wallet.

`memoryCount()` returns the total number of published memories.

## Memory Format

The user-facing memory fields are stored directly on-chain:

```text
Contract arguments:

title: The night we won together
country: Singapore
kind: story
description: A permanent memory stored directly on Avalanche.
```

The contract rejects empty title, country, kind, and description values.

## On-Chain Storage

Stored on-chain:

- Creator address
- Memory title
- Country
- Memory type
- Memory note
- Block timestamp

The contract has no owner, admin, payments, tokens, NFTs, external calls, upgradeability, edit path, or delete path.
