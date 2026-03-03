/**
 * Traefik ForwardAuth: Keycloak JWT 검증
 * Traefik이 이 서비스로 인증 요청을 보내고, 2xx면 통과, 401/403이면 거부.
 * Authorization: Bearer <token> 또는 Cookie 내 토큰 검증.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();
const PORT = process.env.PORT || 3005;

const KEYCLOAK_ISSUER =
  process.env.KEYCLOAK_ISSUER ||
  (process.env.KEYCLOAK_URL
    ? `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM || 'yss'}`
    : 'http://keycloak:8080/auth/realms/yss');
const KEYCLOAK_JWKS_URI =
  process.env.KEYCLOAK_JWKS_URI ||
  `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`;

const jwks = jwksClient({
  cache: true,
  rateLimit: true,
  jwksUri: KEYCLOAK_JWKS_URI,
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.publicKey || key?.rsaPublicKey;
    callback(null, signingKey);
  });
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && /^Bearer\s+/i.test(auth)) return auth.slice(7);
  const cookie = req.headers.cookie;
  if (cookie) {
    const m = cookie.match(/(?:^|;\s*)keycloak-token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

app.use(express.json());

app.all('*', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).set('X-Forwarded-User', '').end();
    return;
  }
  jwt.verify(
    token,
    getKey,
    {
      algorithms: ['RS256'],
      issuer: KEYCLOAK_ISSUER,
      audience: ['account', 'express-services', 'flask-service', 'next-app'],
      ignoreExpiration: false,
    },
    (err, decoded) => {
      if (err) {
        res.status(401).set('X-Forwarded-User', '').end();
        return;
      }
      const preferred = decoded.preferred_username || decoded.sub || '';
      const roles = (decoded.realm_access?.roles || []).concat(decoded.resource_access?.['express-services']?.roles || []);
      res
        .status(200)
        .set('X-Forwarded-User', preferred)
        .set('X-Forwarded-Roles', roles.join(','))
        .set('X-Forwarded-Preferred-Username', preferred)
        .end();
    }
  );
});

app.listen(PORT, () => {
  console.log(`ForwardAuth listening on ${PORT}, KEYCLOAK_ISSUER=${KEYCLOAK_ISSUER}`);
});
