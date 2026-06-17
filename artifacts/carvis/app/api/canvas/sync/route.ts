import { type NextRequest, NextResponse } from "next/server";
import { db } from "@workspace/db";
import { usersTable, coursesTable, assignmentsTable, gradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getCanvasToken } from "@/server/auth";
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  fetchEnrollmentsWithGrades,
} from "@/server/canvas-fetch";

function letterGrade(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function scopedCourseId(userId: string, canvasCourseId: string) {
  return `${userId}__c${canvasCourseId}`;
}

function scopedAssignmentId(scopedCourse: string, canvasAssignmentId: string) {
  return `${scopedCourse}__a${canvasAssignmentId}`;
}

export async function POST(request: NextRequest) {
  const [user, err] = await requireAuth(request);
  if (err) return err;

  const token = await getCanvasToken(user);
  if (!token || !user.canvasBaseUrl) {
    return NextResponse.json(
      { error: "Canvas not connected — sign in with Canvas first" },
      { status: 400 }
    );
  }

  try {
    const rawCourses = (await fetchCanvasCourses(
      token,
      user.canvasBaseUrl
    )) as Record<string, unknown>[];
    let courseCount = 0;
    let assignmentCount = 0;

    for (const c of rawCourses) {
      if (!c["id"] || c["workflow_state"] !== "available") continue;
      const courseId = scopedCourseId(user.id, String(c["id"]));

      const [existing] = await db
        .select({ id: coursesTable.id })
        .from(coursesTable)
        .where(
          and(
            eq(coursesTable.id, courseId),
            eq(coursesTable.userId, user.id)
          )
        )
        .limit(1);

      const courseData = {
        userId: user.id,
        name: String(c["name"] || "Untitled Course"),
        code: c["course_code"] ? String(c["course_code"]) : null,
        color: c["course_color"] ? String(c["course_color"]) : null,
        lastSynced: new Date(),
      };

      if (existing) {
        await db
          .update(coursesTable)
          .set(courseData)
          .where(
            and(
              eq(coursesTable.id, courseId),
              eq(coursesTable.userId, user.id)
            )
          );
      } else {
        await db.insert(coursesTable).values({ id: courseId, ...courseData });
      }
      courseCount++;

      try {
        const rawAssignments = (await fetchCanvasAssignments(
          token,
          user.canvasBaseUrl,
          String(c["id"])
        )) as Record<string, unknown>[];
        for (const a of rawAssignments) {
          if (!a["id"]) continue;
          const assignmentId = scopedAssignmentId(courseId, String(a["id"]));
          const [existingA] = await db
            .select({ id: assignmentsTable.id })
            .from(assignmentsTable)
            .where(eq(assignmentsTable.id, assignmentId))
            .limit(1);

          const assignmentData = {
            courseId,
            name: String(a["name"] || "Untitled Assignment"),
            description: a["description"] ? String(a["description"]) : null,
            dueDate: a["due_at"] ? new Date(String(a["due_at"])) : null,
            points: a["points_possible"] ? Number(a["points_possible"]) : null,
            url: a["html_url"] ? String(a["html_url"]) : null,
            updatedAt: new Date(),
          };

          if (existingA) {
            await db
              .update(assignmentsTable)
              .set(assignmentData)
              .where(eq(assignmentsTable.id, assignmentId));
          } else {
            await db
              .insert(assignmentsTable)
              .values({ id: assignmentId, ...assignmentData, completed: false });
          }
          assignmentCount++;
        }
      } catch {
        // continue syncing other courses if one fails
      }
    }

    if (user.canvasUserId) {
      try {
        const enrollments = await fetchEnrollmentsWithGrades(
          token,
          user.canvasBaseUrl,
          user.canvasUserId
        );
        for (const eg of enrollments) {
          const scopedCourse = scopedCourseId(user.id, eg.courseId);
          const [course] = await db
            .select({ id: coursesTable.id })
            .from(coursesTable)
            .where(
              and(
                eq(coursesTable.id, scopedCourse),
                eq(coursesTable.userId, user.id)
              )
            )
            .limit(1);
          if (!course) continue;

          const [existingGrade] = await db
            .select({ id: gradesTable.id })
            .from(gradesTable)
            .where(
              and(
                eq(gradesTable.userId, user.id),
                eq(gradesTable.courseId, scopedCourse)
              )
            )
            .limit(1);

          const gradeData = {
            currentScore: eg.currentScore,
            finalScore: eg.finalScore,
            letterGrade: letterGrade(eg.currentScore),
            fetchedAt: new Date(),
          };

          if (existingGrade) {
            await db
              .update(gradesTable)
              .set(gradeData)
              .where(eq(gradesTable.id, existingGrade.id));
          } else {
            await db.insert(gradesTable).values({
              userId: user.id,
              courseId: scopedCourse,
              ...gradeData,
            });
          }
        }
      } catch {
        // grade sync failure is non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      courseCount,
      assignmentCount,
      message: null,
    });
  } catch {
    return NextResponse.json(
      { error: "Sync failed — check Canvas connection" },
      { status: 500 }
    );
  }
}
