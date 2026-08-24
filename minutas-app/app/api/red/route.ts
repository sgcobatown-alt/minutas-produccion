import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  
  let url = `http://localhost:3000`;
  
  if (host && host.includes('app.github.dev')) {
    url = `${proto}://${host}`;
  } else {
    const os = await import('os');
    const interfaces = os.networkInterfaces();
    let ip = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ip = iface.address;
        }
      }
    }
    url = `http://${ip}:3000`;
  }
  
  return NextResponse.json({ url });
}
