import { NextResponse } from "next/server";
import { availableProviders } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const providers = availableProviders();
  return NextResponse.json({
    providers,
    configured: providers.length > 0,
  });
}
