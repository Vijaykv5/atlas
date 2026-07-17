import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MemoryPayload = {
  txHash?: string;
  creatorAddress?: string;
  title?: string;
  country?: string;
  kind?: string;
  description?: string;
  imageCid?: string;
  imageDataUrl?: string;
  voiceDataUrl?: string;
  contractAddress?: string;
  nftTokenId?: string;
};

const MAX_TEXT_LENGTH = 2_000;
const MAX_MEDIA_DATA_URL_LENGTH = 7_000_000;
const DEFAULT_LIMIT = 100;

function getDatabaseURL() {
  return (
    process.env.DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL
  );
}

function getSQL() {
  const databaseURL = getDatabaseURL();

  if (!databaseURL) {
    throw new Error("Neon database is not configured. Add DB_URL to .env.local.");
  }

  return neon(databaseURL);
}

async function ensureMemoriesTable() {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS atlas_memories (
      id BIGSERIAL PRIMARY KEY,
      tx_hash TEXT UNIQUE NOT NULL,
      creator_address TEXT NOT NULL,
      title TEXT NOT NULL,
      country TEXT NOT NULL,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      image_cid TEXT NOT NULL DEFAULT '',
      image_data_url TEXT NOT NULL DEFAULT '',
      voice_data_url TEXT NOT NULL DEFAULT '',
      chain_id INTEGER NOT NULL DEFAULT 43113,
      contract_address TEXT,
      nft_token_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE atlas_memories
    ADD COLUMN IF NOT EXISTS image_cid TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE atlas_memories
    ADD COLUMN IF NOT EXISTS image_data_url TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE atlas_memories
    ADD COLUMN IF NOT EXISTS voice_data_url TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE atlas_memories
    ADD COLUMN IF NOT EXISTS nft_token_id TEXT NOT NULL DEFAULT ''
  `;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function cleanDataURL(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isTransactionHash(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function toMemoryResponse(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    txHash: row.tx_hash,
    creatorAddress: row.creator_address,
    title: row.title,
    country: row.country,
    kind: row.kind,
    description: row.description,
    imageCid: row.image_cid,
    imageDataUrl: row.image_data_url,
    voiceDataUrl: row.voice_data_url,
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    nftTokenId: row.nft_token_id,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    await ensureMemoriesTable();
    const sql = getSQL();
    const { searchParams } = new URL(request.url);
    const creator = cleanText(searchParams.get("creator"));

    if (creator && !isAddress(creator)) {
      return NextResponse.json({ error: "Invalid creator address." }, { status: 400 });
    }

    const rows = creator
      ? await sql`
          SELECT
            id,
            tx_hash,
            creator_address,
            title,
            country,
            kind,
            description,
            image_cid,
            image_data_url,
            voice_data_url,
            chain_id,
            contract_address,
            nft_token_id,
            created_at
          FROM atlas_memories
          WHERE LOWER(creator_address) = LOWER(${creator})
          ORDER BY created_at DESC
          LIMIT ${DEFAULT_LIMIT}
        `
      : await sql`
          SELECT
            id,
            tx_hash,
            creator_address,
            title,
            country,
            kind,
            description,
            image_cid,
            image_data_url,
            voice_data_url,
            chain_id,
            contract_address,
            nft_token_id,
            created_at
          FROM atlas_memories
          ORDER BY created_at DESC
          LIMIT ${DEFAULT_LIMIT}
        `;

    return NextResponse.json({ memories: rows.map(toMemoryResponse) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Atlas memories.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MemoryPayload;
    const txHash = cleanText(body.txHash);
    const creatorAddress = cleanText(body.creatorAddress);
    const title = cleanText(body.title);
    const country = cleanText(body.country);
    const kind = cleanText(body.kind);
    const description = cleanText(body.description);
    const imageCid = cleanText(body.imageCid);
    const imageDataUrl = cleanDataURL(body.imageDataUrl);
    const voiceDataUrl = cleanDataURL(body.voiceDataUrl);
    const contractAddress = cleanText(body.contractAddress);
    const nftTokenId = cleanText(body.nftTokenId);

    if (!isTransactionHash(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash." }, { status: 400 });
    }

    if (!isAddress(creatorAddress)) {
      return NextResponse.json({ error: "Invalid creator address." }, { status: 400 });
    }

    if (!title || !country || !kind || !description) {
      return NextResponse.json(
        { error: "Title, country, kind, and description are required." },
        { status: 400 },
      );
    }

    if (!imageCid) {
      return NextResponse.json({ error: "Image reference is required." }, { status: 400 });
    }

    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Image data is required." }, { status: 400 });
    }

    if (imageDataUrl.length > MAX_MEDIA_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Image data is too large." }, { status: 400 });
    }

    if (voiceDataUrl && !voiceDataUrl.startsWith("data:audio/")) {
      return NextResponse.json({ error: "Voice data must be audio." }, { status: 400 });
    }

    if (voiceDataUrl.length > MAX_MEDIA_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Voice data is too large." }, { status: 400 });
    }

    if (contractAddress && !isAddress(contractAddress)) {
      return NextResponse.json({ error: "Invalid contract address." }, { status: 400 });
    }

    if (nftTokenId && !/^\d+$/.test(nftTokenId)) {
      return NextResponse.json({ error: "Invalid NFT token ID." }, { status: 400 });
    }

    await ensureMemoriesTable();
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO atlas_memories (
        tx_hash,
        creator_address,
        title,
        country,
        kind,
        description,
        image_cid,
        image_data_url,
        voice_data_url,
        chain_id,
        contract_address,
        nft_token_id
      )
      VALUES (
        ${txHash},
        ${creatorAddress},
        ${title},
        ${country},
        ${kind},
        ${description},
        ${imageCid},
        ${imageDataUrl},
        ${voiceDataUrl},
        43113,
        ${contractAddress || null},
        ${nftTokenId}
      )
      ON CONFLICT (tx_hash) DO UPDATE SET
        title = EXCLUDED.title,
        country = EXCLUDED.country,
        kind = EXCLUDED.kind,
        description = EXCLUDED.description,
        image_cid = EXCLUDED.image_cid,
        image_data_url = EXCLUDED.image_data_url,
        voice_data_url = EXCLUDED.voice_data_url,
        creator_address = EXCLUDED.creator_address,
        contract_address = EXCLUDED.contract_address,
        nft_token_id = EXCLUDED.nft_token_id
      RETURNING
        id,
        tx_hash,
        creator_address,
        title,
        country,
        kind,
        description,
        image_cid,
        image_data_url,
        voice_data_url,
        chain_id,
        contract_address,
        nft_token_id,
        created_at
    `;

    return NextResponse.json({ memory: toMemoryResponse(rows[0]) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save Atlas memory.",
      },
      { status: 500 },
    );
  }
}
