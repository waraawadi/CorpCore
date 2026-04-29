import { NextResponse, type NextRequest } from 'next/server'

const AUTH_COOKIE_KEY = 'corpcore_access_token'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasToken = Boolean(request.cookies.get(AUTH_COOKIE_KEY)?.value)

  if (pathname.startsWith('/dashboard') && !hasToken) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', `${pathname}${search || ''}`)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/login' && hasToken) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
