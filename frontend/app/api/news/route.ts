import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // UPDATED: Now pointing to Backend 2.0
    const backendUrl = "https://mercosur-backend-2-0.onrender.com"; 
    
    const endpoint = `${backendUrl}/news?${searchParams.toString()}`;
    
    console.log(`Proxying to: ${endpoint}`);

    const res = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Backend responded with ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      debug_backend_used: "https://mercosur-backend-2-0.onrender.com" 
    }, { status: 500 });
  }
}