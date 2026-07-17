import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AssetPayload = {
  mediaId?: string;
  title?: string;
  country?: string;
  kind?: string;
  description?: string;
  imageDataUrl?: string;
  voiceDataUrl?: string;
};

const MAX_TEXT_LENGTH = 2_000;
const MAX_MEDIA_DATA_URL_LENGTH = 7_000_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

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

async function ensureAssetsTable() {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS atlas_memory_assets (
      media_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      country TEXT NOT NULL,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      image_data_url TEXT NOT NULL,
      voice_data_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function cleanDataURL(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssetPayload;
    const mediaId = cleanText(body.mediaId);
    const title = cleanText(body.title);
    const country = cleanText(body.country);
    const kind = cleanText(body.kind);
    const description = cleanText(body.description);
    const imageDataUrl = cleanDataURL(body.imageDataUrl);
    const voiceDataUrl = cleanDataURL(body.voiceDataUrl);

    if (!/^[0-9a-f]{64}$/i.test(mediaId)) {
      return NextResponse.json({ error: "Invalid media ID." }, { status: 400, headers: CORS_HEADERS });
    }

    if (!title || !country || !kind || !description) {
      return NextResponse.json(
        { error: "Title, country, kind, and description are required." },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Image data is required." }, { status: 400, headers: CORS_HEADERS });
    }

    if (imageDataUrl.length > MAX_MEDIA_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Image data is too large." }, { status: 400, headers: CORS_HEADERS });
    }

    if (voiceDataUrl && !voiceDataUrl.startsWith("data:audio/")) {
      return NextResponse.json({ error: "Voice data must be audio." }, { status: 400, headers: CORS_HEADERS });
    }

    if (voiceDataUrl.length > MAX_MEDIA_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Voice data is too large." }, { status: 400, headers: CORS_HEADERS });
    }

    await ensureAssetsTable();
    const sql = getSQL();
    await sql`
      INSERT INTO atlas_memory_assets (
        media_id,
        title,
        country,
        kind,
        description,
        image_data_url,
        voice_data_url
      )
      VALUES (
        ${mediaId},
        ${title},
        ${country},
        ${kind},
        ${description},
        ${imageDataUrl},
        ${voiceDataUrl}
      )
      ON CONFLICT (media_id) DO UPDATE SET
        title = EXCLUDED.title,
        country = EXCLUDED.country,
        kind = EXCLUDED.kind,
        description = EXCLUDED.description,
        image_data_url = EXCLUDED.image_data_url,
        voice_data_url = EXCLUDED.voice_data_url,
        updated_at = NOW()
    `;

    return NextResponse.json({ asset: { mediaId } }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not save Atlas NFT asset.",
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    headers: CORS_HEADERS,
    status: 204,
  });
}
