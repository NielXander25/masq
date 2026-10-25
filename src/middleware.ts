import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (!user) {
    const url = new URL("/signin", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (user.banned) {
    // Sign the banned user out everywhere, then show the suspended page.
    await db.session.deleteMany({ where: { userId: user.id } });
    const res = NextResponse.redirect(new URL("/suspended", req.nextUrl));
    for (const name of SESSION_COOKIES) res.cookies.delete(name);
    return res;
  }

  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Database sessions need Prisma, so run middleware on Node.js, not the edge.
  runtime: "nodejs",
  matcher: ["/dashboard/:path*", "/call/:path*", "/c/:path*", "/admin/:path*"],
};
