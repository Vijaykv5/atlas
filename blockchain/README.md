# Atlas Blockchain

Atlas stores immutable memory anchors on Avalanche Fuji. The contract records the creator wallet, E6 latitude, E6 longitude, IPFS metadata URI, and block timestamp. Photos, videos, voice notes, generated stories, and other large content stay off-chain on IPFS.

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

`createMemory(int32 latitudeE6, int32 longitudeE6, string calldata metadataURI)` publishes an immutable memory and returns its new ID. IDs start at `1`.

`getMemory(uint256 memoryId)` returns a stored memory and reverts for ID `0` or an ID that has not been published.

`getMemoriesByCreator(address creator)` returns all memory IDs published by a wallet.

`memoryCount()` returns the total number of published memories.

## Coordinate E6 Format

Coordinates use signed integers with six fixed decimals:

```text
Latitude: 1.352083
Longitude: 103.625213

Contract arguments:

latitudeE6: 1352083
longitudeE6: 103625213
metadataURI: ipfs://bafy...
```

Valid latitude range: `-90_000_000` to `90_000_000`.

Valid longitude range: `-180_000_000` to `180_000_000`.

## On-Chain Vs IPFS

Stored on-chain:

- Creator address
- Latitude and longitude in E6 format
- IPFS metadata URI
- Block timestamp

Stored on IPFS:

- Photos
- Videos
- Voice notes
- AI story text
- Location display names
- Any rich metadata JSON

The contract has no owner, admin, payments, tokens, NFTs, external calls, upgradeability, edit path, or delete path.
