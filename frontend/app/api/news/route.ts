import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country') || 'uruguay';

  // We are forcing the bridge to talk ONLY to the new /news path
  const BACKEND_URL = `https://mercosur-backend-2-0.onrender.com/news?country=${country}`;

  try {
    const response = await fetch(BACKEND_URL, { cache: 'no-store' });
    
    // If the backend says 404, it means the backend code is definitely the old version
    if (response.status === 404) {
      return NextResponse.json({ 
        ok: false, 
        error: "Backend is still running old code. Please check Render logs for 'Fetching Brasil'." 
      }, { status: 404 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Connection Failed' }, { status: 500 });
  }
}