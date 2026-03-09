import { eq, desc } from "drizzle-orm";
import { ensureDb } from "./index";
import { sessions, promptVersions } from "@shared/schema";
import type { Session, PromptVersion } from "@shared/types";

// --- Session CRUD ---

export async function createSession(intent: string): Promise<Session | null> {
  const db = await ensureDb();
  if (!db) return null;
  const result = await db.insert(sessions).values({ intent }).returning();
  return result[0];
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await ensureDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return result[0] ?? null;
}

// --- Prompt Version CRUD ---

export async function createPromptVersion(data: {
  sessionId: string;
  versionNum: number;
  systemPrompt: string;
  userTemplate: string;
  generatedText?: string | null;
  scores?: Record<string, number> | null;
}): Promise<PromptVersion | null> {
  const db = await ensureDb();
  if (!db) return null;
  const result = await db.insert(promptVersions).values(data).returning();
  return result[0];
}

export async function getNextVersionNum(sessionId: string): Promise<number> {
  const db = await ensureDb();
  if (!db) return 1;
  const result = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.sessionId, sessionId))
    .orderBy(desc(promptVersions.versionNum))
    .limit(1);
  return (result[0]?.versionNum ?? 0) + 1;
}

export async function getVersionsBySession(
  sessionId: string,
): Promise<PromptVersion[]> {
  const db = await ensureDb();
  if (!db) return [];
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.sessionId, sessionId))
    .orderBy(desc(promptVersions.versionNum));
}
