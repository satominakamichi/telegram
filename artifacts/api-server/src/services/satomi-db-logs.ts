import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";

export interface DbLogEntry {
  id: number;
  username: string;
  question: string;
  response: string;
  created_at: Date;
}

export async function ensureLogsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS satomi_chat_logs (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL,
      question   TEXT NOT NULL,
      response   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info("satomi_chat_logs table ready");
}

export async function persistLog(username: string, question: string, response: string): Promise<void> {
  try {
    await pool.query(
      "INSERT INTO satomi_chat_logs (username, question, response) VALUES ($1, $2, $3)",
      [username, question, response],
    );
  } catch (err) {
    logger.error({ err }, "Failed to persist chat log to DB");
  }
}

export async function getRecentLogs(limit = 5): Promise<DbLogEntry[]> {
  try {
    const result = await pool.query<DbLogEntry>(
      "SELECT id, username, question, response, created_at FROM satomi_chat_logs ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
    return result.rows.reverse(); // oldest first so UI shows in correct order
  } catch (err) {
    logger.error({ err }, "Failed to fetch recent logs from DB");
    return [];
  }
}
