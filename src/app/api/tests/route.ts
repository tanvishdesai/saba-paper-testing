import { NextResponse } from "next/server";

import { convexApi, createConvexHttpClient } from "@/lib/convex/serverClient";
import type { StoredTestSummary } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const client = createConvexHttpClient();
    const tests = (await client.query(convexApi.tests.listTests, {})) as StoredTestSummary[];

    return NextResponse.json({ tests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch tests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
