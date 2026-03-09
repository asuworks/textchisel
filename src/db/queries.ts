import { eq, desc } from "drizzle-orm";
import { getDb } from "./index";
import { sessions, promptVersions } from "@shared/schema";
import type { Session, PromptVersion } from "@shared/types";

// --- Session CRUD ---

export async function createSession(intent: string): Promise<Session> {
  const db = getDb();
  const result = await db.insert(sessions).values({ intent }).returning();
  return result[0];
}

export async function getSession(id: string): Promise<Session | null> {
  const db = getDb();
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
}): Promise<PromptVersion> {
  const db = getDb();
  const result = await db.insert(promptVersions).values(data).returning();
  return result[0];
}

export async function getNextVersionNum(sessionId: string): Promise<number> {
  const db = getDb();
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
  const db = getDb();
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.sessionId, sessionId))
    .orderBy(desc(promptVersions.versionNum));
}
