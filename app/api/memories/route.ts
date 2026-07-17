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
  contractAddress?: string;
};

const MAX_TEXT_LENGTH = 2_000;
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
      chain_id INTEGER NOT NULL DEFAULT 43113,
      contract_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
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
    chainId: row.chain_id,
    contractAddress: row.contract_address,
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
            chain_id,
            contract_address,
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
            chain_id,
            contract_address,
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
    const contractAddress = cleanText(body.contractAddress);

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

    if (contractAddress && !isAddress(contractAddress)) {
      return NextResponse.json({ error: "Invalid contract address." }, { status: 400 });
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
        chain_id,
        contract_address
      )
      VALUES (
        ${txHash},
        ${creatorAddress},
        ${title},
        ${country},
        ${kind},
        ${description},
        43113,
        ${contractAddress || null}
      )
      ON CONFLICT (tx_hash) DO UPDATE SET
        title = EXCLUDED.title,
        country = EXCLUDED.country,
        kind = EXCLUDED.kind,
        description = EXCLUDED.description,
        creator_address = EXCLUDED.creator_address,
        contract_address = EXCLUDED.contract_address
      RETURNING
        id,
        tx_hash,
        creator_address,
        title,
        country,
        kind,
        description,
        chain_id,
        contract_address,
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
