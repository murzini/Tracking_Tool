import { NextResponse } from 'next/server';
import { getSql, SCHEMA } from '../../../lib/prototype/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const sql = getSql();

    const [{ count: sessionCount }] = await sql.query(
      `SELECT COUNT(*) AS count FROM "${SCHEMA}".sessions`
    );
    const [{ count: eventCount }] = await sql.query(
      `SELECT COUNT(*) AS count FROM "${SCHEMA}".events`
    );

    const sessionCols = await sql.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'sessions'
       ORDER BY ordinal_position`,
      [SCHEMA]
    );
    const eventCols = await sql.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'events'
       ORDER BY ordinal_position`,
      [SCHEMA]
    );

    return NextResponse.json({
      ok: true,
      schema: SCHEMA,
      tables: {
        sessions: { rows: Number(sessionCount), columns: sessionCols },
        events:   { rows: Number(eventCount),   columns: eventCols   },
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
