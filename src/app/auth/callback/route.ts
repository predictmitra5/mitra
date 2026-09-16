import type { NextRequest } from "next/server";
import { completeAuthCallback } from "@/modules/auth/callback";

export function GET(request: NextRequest) {
  return completeAuthCallback(request, "/account");
}
