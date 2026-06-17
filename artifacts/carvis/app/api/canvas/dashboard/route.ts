import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { coursesTable, assignmentsTable, gradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/server/auth";

export async function GET(request: NextRequest) {
  const [user, err] = await requireAuth(request);
  if (err) return err;

  try {
    const now = new Date();

    const courses = await db
      .select({ id: coursesTable.id })
      .from(coursesTable)
      .where(eq(coursesTable.userId, user.id));

    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) {
      return NextResponse.json({
        upcomingCount: 0,
        overdueCount: 0,
        completedCount: 0,
        totalAssignments: 0,
        avgGrade: null,
        nextDue: null,
        courseCount: 0,
      });
    }

    const allAssignments = await db
      .select({
        id: assignmentsTable.id,
        name: assignmentsTable.name,
        description: assignmentsTable.description,
        dueDate: assignmentsTable.dueDate,
        points: assignmentsTable.points,
        url: assignmentsTable.url,
        completed: assignmentsTable.completed,
        courseId: assignmentsTable.courseId,
        courseName: coursesTable.name,
      })
      .from(assignmentsTable)
      .innerJoin(coursesTable, eq(assignmentsTable.courseId, coursesTable.id))
      .where(eq(coursesTable.userId, user.id));

    const upcoming = allAssignments.filter(
      (a) => !a.completed && a.dueDate && a.dueDate >= now
    );
    const overdue = allAssignments.filter(
      (a) => !a.completed && a.dueDate && a.dueDate < now
    );
    const completed = allAssignments.filter((a) => a.completed);

    const nextDueAssignment =
      upcoming.sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )[0] || null;

    const grades = await db
      .select({ currentScore: gradesTable.currentScore })
      .from(gradesTable)
      .where(eq(gradesTable.userId, user.id));

    const scoredGrades = grades.filter((g) => g.currentScore !== null);
    const avgGrade =
      scoredGrades.length > 0
        ? scoredGrades.reduce((s, g) => s + (g.currentScore ?? 0), 0) /
          scoredGrades.length
        : null;

    return NextResponse.json({
      upcomingCount: upcoming.length,
      overdueCount: overdue.length,
      completedCount: completed.length,
      totalAssignments: allAssignments.length,
      avgGrade,
      nextDue: nextDueAssignment
        ? {
            id: nextDueAssignment.id,
            name: nextDueAssignment.name,
            description: nextDueAssignment.description,
            dueDate: nextDueAssignment.dueDate?.toISOString() || null,
            points: nextDueAssignment.points,
            url: nextDueAssignment.url,
            completed: nextDueAssignment.completed,
            courseId: nextDueAssignment.courseId,
            courseName: nextDueAssignment.courseName,
          }
        : null,
      courseCount: courseIds.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
