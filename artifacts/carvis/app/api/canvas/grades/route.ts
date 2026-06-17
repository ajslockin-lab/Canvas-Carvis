import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { gradesTable, coursesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/server/auth";

export async function GET(request: NextRequest) {
  const [user, err] = await requireAuth(request);
  if (err) return err;

  try {
    const grades = await db
      .select({
        courseId: gradesTable.courseId,
        name: coursesTable.name,
        currentScore: gradesTable.currentScore,
        finalScore: gradesTable.finalScore,
        letterGrade: gradesTable.letterGrade,
      })
      .from(gradesTable)
      .innerJoin(coursesTable, eq(gradesTable.courseId, coursesTable.id))
      .where(eq(gradesTable.userId, user.id));

    return NextResponse.json({ grades });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch grades" },
      { status: 500 }
    );
  }
}
