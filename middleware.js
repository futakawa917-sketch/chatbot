// Vercel Edge Middleware: ダッシュボードページにBasic認証をかける

export const config = {
  matcher: ['/', '/index.html', '/dashboard.html', '/sales.html', '/logs.html', '/dashboard', '/sales', '/logs'],
};

const COOKIE_NAME = 'dashboard_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24時間

async function sign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  try {
    const expected = await sign(payload, secret);
    if (expected !== signature) return false;
    const ts = parseInt(payload, 10);
    if (isNaN(ts)) return false;
    if (Date.now() - ts > COOKIE_MAX_AGE * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

async function createToken(secret) {
  const payload = String(Date.now());
  const signature = await sign(payload, secret);
  return `${payload}.${signature}`;
}

export default async function middleware(request) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  // 環境変数未設定なら認証スキップ（事故防止）
  if (!username || !password) {
    return new Response(null, { status: 200 });
  }

  const url = new URL(request.url);
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k)
  );

  // 既存Cookieが有効ならパス
  if (cookies[COOKIE_NAME]) {
    const valid = await verifyToken(cookies[COOKIE_NAME], password);
    if (valid) {
      return new Response(null, { status: 200 });
    }
  }

  // Basic認証ヘッダを確認
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.substring(6));
      const [user, pass] = decoded.split(':');
      if (user === username && pass === password) {
        // 認証成功 → Cookie発行してリダイレクト
        const token = await createToken(password);
        return new Response(null, {
          status: 302,
          headers: {
            'Location': url.pathname,
            'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
          },
        });
      }
    } catch {}
  }

  // 認証要求
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Dashboard"',
      'Content-Type': 'text/plain',
    },
  });
}
