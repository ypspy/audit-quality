import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { customFetch } from "@auth/core";
import type { JWT } from "next-auth/jwt";

// 외부 issuer URL (브라우저 접근용, discovery 문서의 issuer와 일치해야 함)
const issuer =
  process.env.AUTH_KEYCLOAK_ISSUER ?? "http://localhost/auth/realms/yss";

// 컨테이너 내부 Keycloak URL (server-side OIDC 통신용)
const internalUrl =
  process.env.AUTH_KEYCLOAK_INTERNAL_URL ??
  "http://keycloak:8080/auth/realms/yss";

// server-side fetch interceptor: 외부 issuer URL → 내부 Docker URL로 교체
// discovery / token / jwks 등 Auth.js server-side 호출에만 적용됨
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const keycloakOptions: any = {
  clientId: process.env.AUTH_KEYCLOAK_ID ?? "next-app",
  clientSecret: process.env.AUTH_KEYCLOAK_SECRET ?? "",
  issuer,
};
keycloakOptions[customFetch] = (
  input: RequestInfo | URL,
  init?: RequestInit
) => {
  const url =
    input instanceof URL
      ? input.href
      : typeof input === "string"
        ? input
        : (input as Request).url;
  return fetch(url.replace(issuer, internalUrl), init);
};

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const tokenEndpoint = `${internalUrl}/protocol/openid-connect/token`;
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.AUTH_KEYCLOAK_ID ?? "next-app",
        client_secret: process.env.AUTH_KEYCLOAK_SECRET ?? "",
        refresh_token: token.refresh_token as string,
      }),
    });
    const refreshed = await response.json();
    if (!response.ok) throw refreshed;
    return {
      ...token,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (refreshed.expires_in as number),
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Keycloak(keycloakOptions)],
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at; // seconds since epoch
        const payload = JSON.parse(
          Buffer.from((account.access_token as string).split(".")[1], "base64").toString()
        );
        const roles = payload.realm_access?.roles;
        token.roles = Array.isArray(roles) ? roles : [];
        return token;
      }
      // 아직 유효하면 그대로 반환
      if (Date.now() < (token.expires_at as number) * 1000) {
        return token;
      }
      // 만료 → refresh_token으로 갱신
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        const roles = token.roles;
        (session.user as { roles?: string[] }).roles = Array.isArray(roles) ? roles : [];
        (session.user as { access_token?: string }).access_token = token.access_token as string | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});
