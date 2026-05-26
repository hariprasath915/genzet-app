import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://animind-backend-y07f.onrender.com";

/**
 * Proxy POST to the backend /generate-question-animation endpoint.
 * Includes retry logic for Render cold-start (first attempt may timeout).
 * Returns: concept_animation_code, animation_code, quiz_html, quiz_data,
 *          to_find, solution_steps, final_answer, title, category, etc.
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
        signal: AbortSignal.timeout(180_000), // 3-minute timeout (AI pipeline is slow)
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

      // Only retry on network/timeout errors, not on other failures
      if (attempt < MAX_RETRIES) {
        console.log(
          `[QAnim Proxy] Attempt ${attempt + 1} failed (${lastError}), retrying in 3s...`
        );
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
