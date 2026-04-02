import { NextResponse } from "next/server";

import { convexApi, createConvexHttpClient } from "@/lib/convex/serverClient";
import type { StoredTestDetail } from "@/lib/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const client = createConvexHttpClient();

    const test = (await client.query(convexApi.tests.getTestById, {
      testId: id,
    })) as StoredTestDetail | null;

    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    return NextResponse.json({ test });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch test details.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
