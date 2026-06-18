import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable, assignmentsTable, conversationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { classifyIntent, generateResponse } from "../lib/nlu.js";
import { VoiceCommandBody } from "@workspace/api-zod";

const router = Router();

router.post("/voice/command", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const parsed = VoiceCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }

  const { text } = parsed.data;

  try {
    const now = new Date();
    const courses = await db
      .select({ id: coursesTable.id, name: coursesTable.name })
      .from(coursesTable)
      .where(eq(coursesTable.userId, user.id));

    const assignments = (
      await Promise.all(
        courses.map(async (c) => {
          const items = await db
            .select()
            .from(assignmentsTable)
            .where(and(eq(assignmentsTable.courseId, c.id), eq(assignmentsTable.completed, false)));
          return items.map((a) => ({ ...a, courseName: c.name, overdue: !!a.dueDate && a.dueDate < now }));
        })
      )
    ).flat();

    const nlu = await classifyIntent(text);
    const response = await generateResponse(nlu.intent, nlu.entities, { assignments });

    try {
      await db.insert(conversationsTable).values({ userId: user.id, role: "user", message: text, intent: nlu.intent });
      await db.insert(conversationsTable).values({ userId: user.id, role: "assistant", message: response });
    } catch (err) {
      req.log.warn({ err }, "Could not save conversation");
    }

    res.json({ intent: nlu.intent, response, confidence: nlu.confidence });
  } catch (err) {
    req.log.error({ err }, "Voice command error");
    res.status(500).json({ error: "Voice command processing failed" });
  }
});

router.get("/voice/history", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const messages = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.userId, user.id))
      .orderBy(desc(conversationsTable.createdAt))
      .limit(50);

    res.json({
      messages: messages.reverse().map((m) => ({
        id: m.id,
        role: m.role,
        message: m.message,
        intent: m.intent,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Conversation history error");
    res.status(500).json({ error: "Failed to fetch conversation history" });
  }
});

export default router;
