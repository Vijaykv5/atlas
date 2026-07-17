# Atlas

Atlas lets users write a memory and store its title, country, type, and note
directly on Avalanche Fuji through the Atlas contract.

## Environment

Create the app env file:

```bash
cp .env.example .env.local
```

Set:

```env
NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS=
DB_URL=
```

`NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS` is required by the browser when submitting
`createMemory(string title, string country, string kind, string description)`
through the connected wallet. Use the Atlas contract address printed by the Fuji
deploy.

`DB_URL` is required by `/api/memories` to store submitted memories in Neon after
the wallet returns an Avalanche Fuji transaction hash.

To deploy the contract, configure the blockchain workspace:

```bash
cd blockchain
cp .env.example .env
```

Set:

```env
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=
```

`DEPLOYER_PRIVATE_KEY` must be a funded Avalanche Fuji test wallet private key.
Never commit `.env`, never share a private key, and never enter a seed phrase.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
