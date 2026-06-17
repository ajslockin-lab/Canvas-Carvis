import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { assignmentsTable, coursesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/server/auth";
import { ToggleAssignmentCompleteParams } from "@workspace/api-zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, err] = await requireAuth(request);
  if (err) return err;

  const { id: rawId } = await params;
  const parsed = ToggleAssignmentCompleteParams.safeParse({ id: rawId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment ID" },
      { status: 400 }
    );
  }

  try {
    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .innerJoin(coursesTable, eq(assignmentsTable.courseId, coursesTable.id))
      .where(
        and(
          eq(assignmentsTable.id, parsed.data.id),
          eq(coursesTable.userId, user.id)
        )
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(assignmentsTable)
      .set({
        completed: !assignment.assignments.completed,
        updatedAt: new Date(),
      })
      .where(eq(assignmentsTable.id, parsed.data.id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const course = await db
      .select({ name: coursesTable.name })
      .from(coursesTable)
      .where(eq(coursesTable.id, updated.courseId))
      .limit(1);

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      dueDate: updated.dueDate?.toISOString() || null,
      points: updated.points,
      url: updated.url,
      completed: updated.completed,
      courseId: updated.courseId,
      courseName: course[0]?.name || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}
