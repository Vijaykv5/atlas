import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

function getPublicAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_ATLAS_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  const url = new URL(request.url);
  return url.origin;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const { mediaId } = await params;

    if (!/^[0-9a-f]{64}$/i.test(mediaId)) {
      return NextResponse.json({ error: "Invalid metadata ID." }, { status: 400 });
    }

    await ensureAssetsTable();
    const sql = getSQL();
    const legacyReference = `db:${mediaId}`;
    const urlSuffix = `%/${mediaId}`;
    const assetRows = await sql`
      SELECT title, description, country, kind
      FROM atlas_memory_assets
      WHERE media_id = ${mediaId}
      LIMIT 1
    `;
    const memoryRows = assetRows.length
      ? []
      : await sql`
          SELECT title, description, country, kind
          FROM atlas_memories
          WHERE image_cid = ${legacyReference}
            OR image_cid LIKE ${urlSuffix}
          ORDER BY created_at DESC
          LIMIT 1
        `;
    const rows = assetRows.length ? assetRows : memoryRows;
    const memory = rows[0];

    if (!memory) {
      return NextResponse.json({ error: "Metadata not found." }, { status: 404 });
    }

    const publicAppUrl = getPublicAppUrl(request);

    return NextResponse.json(
      {
        name: String(memory.title || "Atlas Memory"),
        description: String(memory.description || ""),
        image: `${publicAppUrl}/api/memories/media/${mediaId}`,
        attributes: [
          {
            trait_type: "Country",
            value: String(memory.country || ""),
          },
          {
            trait_type: "Kind",
            value: String(memory.kind || ""),
          },
        ],
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load Atlas memory metadata.",
      },
      { status: 500 },
    );
  }
}
