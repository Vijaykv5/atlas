<p align="center">
  <img src="./public/logo/logo.png" alt="Atlas logo" width="120" />
</p>

# Atlas

Atlas is an Avalanche-powered memory archive. It lets people write a personal
memory, attach image or voice-backed media, store the public metadata
and mint the memory as an ERC-721 NFT on Avalanche Fuji.

Each on-chain memory ID is also the NFT token ID, so the published memory can be
verified on Snowtrace and held in the creator's wallet.

## Links

- **Repository:** [github.com/Vijaykv5/atlas](https://github.com/Vijaykv5/atlas)
- **Avalanche Fuji Explorer:** [Snowtrace Testnet](https://testnet.snowtrace.io)
- **Blockchain README:** [blockchain/README.md](./blockchain/README.md)
- **Contract source:** [blockchain/contracts/Atlas.sol](./blockchain/contracts/Atlas.sol)

> Add the deployed app URL and deployed contract URL here after deployment:
>
> - **Live app:** `https://atlas.vijaykv.xyz/`
> - **Atlas contract:** `https://testnet.snowtrace.io/address/0xeEfbf26250b01BBfEC3348a8094E3f6C1875044B`

## Why Atlas

Important moments often disappear into private camera rolls, social feeds, or
platforms that can change their rules. Atlas gives creators a small, direct way
to publish a memory with an enduring on-chain anchor.

The app is intentionally simple:

1. Write a title, country, type and memory note.
2. Connect an EVM wallet (Raby wallet preffered).
3. Switch to Avalanche Fuji.
4. Mint the memory through the Atlas contract.
5. View the memory NFT and transaction on Snowtrace.

## Avalanche Integration

Atlas is built for Avalanche Fuji, the Avalanche C-Chain testnet.

- **Network:** Avalanche Fuji
- **Chain ID:** `43113`
- **RPC:** `https://api.avax-test.network/ext/bc/C/rpc`
- **Explorer:** `https://testnet.snowtrace.io`
- **Token standard:** ERC-721-compatible memory NFTs
- **Primary contract:** [`Atlas.sol`](./blockchain/contracts/Atlas.sol)

The main contract function is:

```solidity
createMemory(
  string title,
  string country,
  string kind,
  string description,
  string imageCid
)
```

When called, it stores the memory fields on-chain, mints an Atlas Memories NFT
to the caller, emits `MemoryCreated`, and returns the new memory ID. IDs start at
`1`, and the memory ID is the same as the NFT token ID.

## Features

- Create permanent memory records with title, country, type, description and media metadata.
- Connect an EVM wallet and guide users onto Avalanche Fuji.
- Mint each memory as an ERC-721 NFT named `Atlas Memories` with symbol `ATLAS`.
- Store public NFT metadata and media records through Next.js API routes backed by Neon.
- Browse public memories through the Atlas globe experience.
- View wallet-specific memories from the profile page.
- Open completed transactions directly on Snowtrace.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Globe UI:** `react-globe.gl` and Three.js
- **Database:** Neon serverless Postgres
- **Wallet/network:** Browser EVM wallet provider
- **Smart contracts:** Solidity, Hardhat, Hardhat Ignition, ethers
- **Target chain:** Avalanche Fuji

## Project Structure

```text
atlas/
  app/                         Next.js app routes and API routes
  components/globe/            Interactive Atlas globe and memory creation UI
  components/landing/          Public landing page sections
  components/profile/          Wallet profile memory view
  public/logo/                 Project logo and favicon
  public/textures/             Globe texture assets
  blockchain/
    contracts/Atlas.sol        Avalanche Fuji memory NFT contract
    scripts/deploy-fuji.ts     Fuji deployment script
    test/Atlas.test.ts         Contract test suite
```

## Local Setup

Install the web app dependencies:

```bash
bun install
```

Create the app environment file:

```bash
cp .env.example .env.local
```

Set:

```env
NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS=
NEXT_PUBLIC_ATLAS_PUBLIC_APP_URL=http://localhost:3000
DB_URL=
```

Run the app:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Blockchain Setup

Install the blockchain workspace dependencies:

```bash
cd blockchain
bun install
```

Create the contract environment file:

```bash
cp .env.example .env
```

Set:

```env
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=
```

The deployer wallet needs Fuji test AVAX. Never commit `.env`, never share a
private key, and never enter a seed phrase into the app.

Compile and test:

```bash
bun run check
```

Deploy to Avalanche Fuji:

```bash
bun run deploy:fuji
```

The deploy script prints the contract address, deployer address, transaction
hash, chain ID, and Snowtrace contract URL. Copy the printed contract address
into `NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS`.

## Judge Verification

Judges can verify the Avalanche integration by checking:

- The contract source in [`blockchain/contracts/Atlas.sol`](./blockchain/contracts/Atlas.sol).
- The Fuji deployment script in [`blockchain/scripts/deploy-fuji.ts`](./blockchain/scripts/deploy-fuji.ts).
- The Fuji network config in [`blockchain/hardhat.config.ts`](./blockchain/hardhat.config.ts).
- The live deployed contract on Snowtrace once the address is added above.

For a minted memory, confirm on Snowtrace that:

1. The transaction ran on Avalanche Fuji.
2. The transaction called `createMemory`.
3. The `MemoryCreated` event was emitted.
4. The NFT owner matches the creator wallet.
5. `tokenURI(tokenId)` points to Atlas metadata served by the deployed app.

## Environment Variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS` | Web app | Deployed Atlas contract address on Avalanche Fuji. |
| `NEXT_PUBLIC_ATLAS_PUBLIC_APP_URL` | Web app and NFT metadata | Public app origin used for metadata and media URLs. |
| `DB_URL` | Next.js API routes | Neon Postgres connection string for memory/media records. |
| `FUJI_RPC_URL` | Blockchain workspace | Avalanche Fuji RPC endpoint. |
| `DEPLOYER_PRIVATE_KEY` | Blockchain workspace | Funded Fuji deployer wallet private key. |

## API Routes

- `POST /api/memories/assets` stores NFT metadata and image assets before minting.
- `POST /api/memories` records the finalized memory after the wallet returns a Fuji transaction hash.
- `GET /api/memories` returns public memories, optionally filtered by creator wallet.
- `GET /api/memories/metadata/[mediaId]` serves ERC-721 metadata.
- `GET /api/memories/media/[mediaId]` serves stored memory media.

## Production Notes

- Use a public `NEXT_PUBLIC_ATLAS_PUBLIC_APP_URL` for deployments; wallets and
  Snowtrace cannot render NFT metadata from `localhost`.
- Keep the contract address and live app URL in this README once deployed so
  reviewers can verify the project quickly.
- Use a dedicated deployer wallet for Fuji.
- Keep database credentials and private keys out of source control.

