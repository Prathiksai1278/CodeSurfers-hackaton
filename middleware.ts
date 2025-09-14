import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()

  // Protected API routes
  const protectedRoutes = [
    '/api/scans',
    '/api/progress',
    '/api/analytics',
    '/api/quizzes/*/submit',
  ]

  // Admin only routes
  const adminRoutes = [
    '/api/analytics',
    '/api/textbooks',
  ]

  // Teacher/Admin routes
  const teacherRoutes = [
    '/api/textbooks',
    '/api/quizzes',
  ]

  const { pathname } = request.nextUrl

  // Check if route requires authentication
  const requiresAuth = protectedRoutes.some(route => 
    pathname.startsWith(route.replace('*', ''))
  )

  if (requiresAuth && !session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Check admin routes
  if (session && adminRoutes.some(route => pathname.startsWith(route))) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
  }

  // Check teacher routes (for POST requests)
  if (session && request.method === 'POST' && 
      teacherRoutes.some(route => pathname.startsWith(route))) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!user || !['teacher', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Teacher or admin access required' },
        { status: 403 }
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    '/api/((?!auth|_next/static|_next/image|favicon.ico).*)',
  ],
}