import { DatabaseSync } from "node:sqlite";

export type PendingAnswer = {
  id: string;
  sessionItemId: string;
  answeredAt: string;
  booleanChoice: boolean | null;
  optionId: string | null;
  writtenText: string | null;
  equivalent: boolean | null;
};

export type StoredSession = {
  localDate: string;
  payload: string;
};

const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS token (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT)",
  "CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK (id = 1), local_date TEXT NOT NULL, payload TEXT NOT NULL)",
  `CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      session_item_id TEXT NOT NULL,
      answered_at TEXT NOT NULL,
      boolean_choice INTEGER,
      option_id TEXT,
      written_text TEXT,
      equivalent INTEGER
    )`,
];

export function openOutbox(path: string) {
  const db = new DatabaseSync(path);
  for (const sql of STATEMENTS) db.prepare(sql).run();

  return {
    saveToken(value: string) {
      db.prepare("INSERT INTO token (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value").run(value);
    },
    loadToken(): string | null {
      const row = db.prepare("SELECT value FROM token WHERE id = 1").get() as { value: string } | undefined;
      return row?.value ?? null;
    },
    clearToken() {
      db.prepare("DELETE FROM token").run();
    },
    saveSession(session: StoredSession) {
      db.prepare(
        "INSERT INTO session (id, local_date, payload) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET local_date = excluded.local_date, payload = excluded.payload",
      ).run(session.localDate, session.payload);
    },
    loadSession(): StoredSession | null {
      const row = db.prepare("SELECT local_date, payload FROM session WHERE id = 1").get() as
        | { local_date: string; payload: string }
        | undefined;
      if (!row) return null;
      return { localDate: row.local_date, payload: row.payload };
    },
    enqueue(answer: PendingAnswer) {
      db.prepare(
        `INSERT INTO outbox (id, session_item_id, answered_at, boolean_choice, option_id, written_text, equivalent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        answer.id,
        answer.sessionItemId,
        answer.answeredAt,
        answer.booleanChoice === null ? null : Number(answer.booleanChoice),
        answer.optionId,
        answer.writtenText,
        answer.equivalent === null ? null : Number(answer.equivalent),
      );
    },
    list(): PendingAnswer[] {
      const rows = db.prepare("SELECT * FROM outbox ORDER BY answered_at, id").all() as Array<{
        id: string;
        session_item_id: string;
        answered_at: string;
        boolean_choice: number | null;
        option_id: string | null;
        written_text: string | null;
        equivalent: number | null;
      }>;
      return rows.map((row) => ({
        id: row.id,
        sessionItemId: row.session_item_id,
        answeredAt: row.answered_at,
        booleanChoice: row.boolean_choice === null ? null : row.boolean_choice === 1,
        optionId: row.option_id,
        writtenText: row.written_text,
        equivalent: row.equivalent === null ? null : row.equivalent === 1,
      }));
    },
    remove(id: string) {
      db.prepare("DELETE FROM outbox WHERE id = ?").run(id);
    },
    close() {
      db.close();
    },
  };
}
