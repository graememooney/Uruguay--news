import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams.toString();

  // FIX: Always use localhost in Codespaces to avoid GitHub Auth redirects (HTML responses)
  const target = `http://127.0.0.1:8003/news${params ? `?${params}` : ""}`;

  // Longer timeout so RSS doesn’t 504 instantly
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(target, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    // Check if we actually got JSON back
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
       const text = await res.text();
       throw new Error(`Backend returned HTML instead of JSON. Status: ${res.status}. Preview: ${text.slice(0, 100)}`);
    }

    const data = await res.json();

    return NextResponse.json(data, {
      status: res.status,
    });

  } catch (err: any) {
    console.error("Proxy Error:", err);
    const message =
      err?.name === "AbortError"
        ? "Backend request timed out (proxy)"
        : (err?.message || "Proxy error");

    return NextResponse.json(
      { ok: false, error: message, backend: target },
      { status: 500 } // Return 500 so frontend shows the red error box
    );
  } finally {
    clearTimeout(timeout);
  }
}