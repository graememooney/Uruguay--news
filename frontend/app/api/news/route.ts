import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // HARDCODED: Directly pointing to your Render Backend
    const backendUrl = "https://mercosur-backend.onrender.com"; 
    
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
      // This will verify we are using the new address if it fails again
      debug_backend_used: "https://mercosur-backend.onrender.com" 
    }, { status: 500 });
  }
}