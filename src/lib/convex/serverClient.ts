import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

export function getConvexUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "Missing Convex deployment URL. Set NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL) in .env.local.",
    );
  }
  return convexUrl;
}

export function createConvexHttpClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}

export { anyApi as convexApi };
