// middleware.js
import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const path = req.nextUrl.pathname;

    if (!session && path !== '/auth' && path !== '/auth/callback') {
      return NextResponse.redirect(new URL('/auth', req.url));
    }

    if (session && path === '/auth') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return res;
  } catch (e) {
    console.error('Middleware error:', e);
    return NextResponse.redirect(new URL('/auth', req.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};