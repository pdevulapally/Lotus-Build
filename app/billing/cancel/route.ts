import { NextResponse } from 'next/server'

export function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL
  if (!origin) throw new Error('Missing required public environment variable: NEXT_PUBLIC_APP_URL')
  return NextResponse.redirect(new URL('/pricing', origin), 303)
}
