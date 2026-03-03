import { auth } from "@/auth";

export default auth((req) => {
  const isSignedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/api/auth");
  const isHealth = pathname === "/api/health";
  if (isAuthPage || isHealth) return;
  if (!isSignedIn && pathname !== "/") {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }
  // "/" 는 리다이렉트하지 않고 페이지에서 로그인 링크 표시
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
