import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "animind-backend-production-2.up.railway.app";

/**
 * Proxy POST to the backend /generate-question-animation endpoint.
 * The backend now enqueues a job and returns { job_id } almost instantly,
 * so this only needs a short timeout — actual generation happens via polling.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.question || !String(body.question).trim()) {
    return NextResponse.json(
      { detail: "'question' field cannot be empty" },
      { status: 400 }
    );
  }

  const MAX_RETRIES = 2;
  let lastError: string = "Unknown error";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_URL}/generate-question-animation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000), // just enqueuing — should be near-instant
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({
          detail: `Server error ${res.status}`,
        }));
        return NextResponse.json(err, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json(data);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : "Connection failed";
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  return NextResponse.json(
    {
      detail: `Backend is starting up (cold start). Please wait 30-60 seconds and try again. Error: ${lastError}`,
    },
    { status: 503 }
  );
}
