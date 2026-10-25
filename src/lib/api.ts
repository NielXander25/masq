import { NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/auth";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Session user for route handlers, or null if signed out or banned. */
export async function apiUser() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.banned) return null;
  return user;
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return schema.safeParse(body);
}
