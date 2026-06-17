import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { coursesTable, assignmentsTable, conversationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/server/auth";
import { classifyIntent, generateResponse } from "@/server/nlu";
import { VoiceCommandBody } from "@workspace/api-zod";

export async function POST(request: NextRequest) {
  const [user, err] = await requireAuth(request);
  if (err) return err;

  const body = await request.json().catch(() => null);
  const parsed = VoiceCommandBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
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
            .where(
              and(
                eq(assignmentsTable.courseId, c.id),
                eq(assignmentsTable.completed, false)
              )
            );
          return items.map((a) => ({ ...a, courseName: c.name }));
        })
      )
    )
      .flat()
      .filter((a) => !a.dueDate || a.dueDate >= now);

    const nlu = await classifyIntent(text);
    const response = await generateResponse(nlu.intent, nlu.entities, {
      assignments,
    });

    try {
      await db.insert(conversationsTable).values({
        userId: user.id,
        role: "user",
        message: text,
        intent: nlu.intent,
      });
      await db.insert(conversationsTable).values({
        userId: user.id,
        role: "assistant",
        message: response,
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      intent: nlu.intent,
      response,
      confidence: nlu.confidence,
    });
  } catch {
    return NextResponse.json(
      { error: "Voice command processing failed" },
      { status: 500 }
    );
  }
}
