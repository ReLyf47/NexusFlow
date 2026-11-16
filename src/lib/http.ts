// REST controller helper: auth + error envelope for every route handler.
import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType, ZodTypeDef } from 'zod';
import { requireActor, type Actor } from './auth';
import { badRequest, toErrorBody } from './errors';

type Ctx<P> = { req: NextRequest; params: P; actor: Actor };

export function api<P = Record<string, string>>(
  handler: (ctx: Ctx<P>) => Promise<unknown>,
  opts: { status?: number; auth?: boolean } = {}
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const actor = opts.auth === false ? (null as unknown as Actor) : await requireActor();
      const data = await handler({ req, params: ((await ctx?.params) ?? {}) as P, actor });
      if (data instanceof Response) return data;
      if (data === undefined) return new NextResponse(null, { status: 204 });
      return NextResponse.json(data, { status: opts.status ?? 200 });
    } catch (e) {
      const error = toErrorBody(e);
      return NextResponse.json({ error }, { status: error.status });
    }
  };
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest('Body harus berupa JSON yang valid.');
  }
  return schema.parse(raw);
}

export const query = (req: NextRequest, key: string) => req.nextUrl.searchParams.get(key) ?? undefined;
