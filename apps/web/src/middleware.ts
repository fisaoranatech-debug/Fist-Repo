import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED = ["/appareils", "/alertes", "/parametres"];

/** Redirige vers la page de connexion si la session est absente ou invalide. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const token = req.cookies.get("retrouve_session")?.value;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET), { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch {
      /* jeton expiré ou falsifié */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = `?suite=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/appareils/:path*", "/alertes/:path*", "/parametres/:path*"] };
