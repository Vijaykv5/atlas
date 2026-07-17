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

function dataURLToImageResponse(dataURL: string) {
  const match = dataURL.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  const [, contentType, base64Data] = match;
  const bytes = Buffer.from(base64Data, "base64");

  return new Response(bytes, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const { mediaId } = await params;

    if (!/^[0-9a-f]{64}$/i.test(mediaId)) {
      return NextResponse.json({ error: "Invalid media ID." }, { status: 400 });
    }

    const sql = getSQL();
    const legacyReference = `db:${mediaId}`;
    const urlSuffix = `%/${mediaId}`;
    const rows = await sql`
      SELECT image_data_url
      FROM atlas_memories
      WHERE image_cid = ${legacyReference}
        OR image_cid LIKE ${urlSuffix}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const imageDataUrl = String(rows[0]?.image_data_url || "");
    const imageResponse = dataURLToImageResponse(imageDataUrl);

    if (!imageResponse) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    return imageResponse;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load Atlas memory image.",
      },
      { status: 500 },
    );
  }
}
