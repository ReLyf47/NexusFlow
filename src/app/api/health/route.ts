import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { api } from '@/lib/http';

// Real MARIADB_POOL indicator for the status footer
export const GET = api(
  async () => {
    const started = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      return { db: 'up', latencyMs: Date.now() - started };
    } catch {
      return Response.json({ db: 'down' }, { status: 503 });
    }
  },
  { auth: false }
);
