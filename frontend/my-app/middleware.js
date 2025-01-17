export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Get the current URL path
    const path = req.nextUrl.pathname;

    // If there's no session and we're not on the auth page
    if (!session && path !== '/auth' && path !== '/auth/callback') {
      return NextResponse.redirect(new URL('/auth', req.url));
    }

    // If there is a session and we're on the auth page
    if (session && path === '/auth') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return res;
  } catch (e) {
    console.error('Middleware error:', e);
    // On error, redirect to auth page
    return NextResponse.redirect(new URL('/auth', req.url));
  }
}

// Update matcher to include api routes but exclude static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};