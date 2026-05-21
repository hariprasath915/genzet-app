import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://animind-backend-1.onrender.com";

/**
 * Proxy POST to the backend /generate-animation endpoint.
 * Includes retry logic for Render cold-start (first attempt may timeout).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const MAX_RETRIES = 2;
  let lastError: string = "Unknown error";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_URL}/generate-animation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000), // 2-minute timeout for AI generation
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Server error ${res.status}` }));
        return NextResponse.json(err, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json(data);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : "Connection failed";

      // Only retry on network/timeout errors (cold start), not on other failures
      if (attempt < MAX_RETRIES) {
        console.log(`[API Proxy] Attempt ${attempt + 1} failed (${lastError}), retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  return NextResponse.json(
    { detail: `⚠️ Backend is starting up (cold start). Please wait 30-60 seconds and try again. Error: ${lastError}` },
    { status: 503 }
  );
}