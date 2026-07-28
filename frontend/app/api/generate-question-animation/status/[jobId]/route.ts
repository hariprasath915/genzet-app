import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://animind-backend-y07f.onrender.com";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  try {
    const res = await fetch(
      `${API_URL}/generate-question-animation/status/${encodeURIComponent(jobId)}`,
      { signal: AbortSignal.timeout(20_000) }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Server error ${res.status}` }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.json({ detail: `Status check failed: ${msg}` }, { status: 502 });
  }
}
