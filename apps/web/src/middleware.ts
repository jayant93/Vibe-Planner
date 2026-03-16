import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/stripe/webhook', '/api/gcal', '/api/razorpay'];
const PRO_PATHS = ['/planner/month', '/planner/year'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Auth check via cookie (set by AuthProvider client-side)
  const authToken = request.cookies.get('auth-token');
  if (!authToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Pro gate for premium routes (plan stored in cookie set by AuthProvider)
  const plan = request.cookies.get('user-plan')?.value ?? 'free';
  if (PRO_PATHS.some((p) => pathname.startsWith(p)) && plan !== 'pro') {
    return NextResponse.redirect(new URL('/upgrade', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
