import { NextResponse } from "next/server"
import { requireUserUid } from "@/lib/server-auth"
import { getSupabaseConnection } from "@/lib/supabase-management"
import { mapRouteError } from "@/lib/orchestrator/route-utils"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const uid = await requireUserUid(req)
    const connection = await getSupabaseConnection(uid)
    
    const connected = !!connection?.accessToken
    return NextResponse.json({ connected })
  } catch (err: unknown) {
    return mapRouteError(err)
  }
}
