// Shared-password gate (HTTP Basic Auth) for the whole site. Password comes from the SITE_PASSWORD env var;
// any username is accepted.
export const config = { matcher: '/(.*)' };

export default function middleware(request) {
  const expected = process.env.SITE_PASSWORD;
  const auth = request.headers.get('authorization') || '';
  if (expected && auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      if (pass === expected) return new Response(null, { headers: { 'x-middleware-next': '1' } });
    } catch (e) { /* malformed header */ }
  }
  return new Response('Zugang nur für BITE-Mitarbeitende. Bitte Passwort eingeben.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="BITE Lastenheft", charset="UTF-8"', 'content-type': 'text/plain; charset=utf-8' },
  });
}
