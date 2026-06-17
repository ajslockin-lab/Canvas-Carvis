import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, coursesTable, assignmentsTable, gradesTable } from "@workspace/db";
import { eq, and, gte, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { fetchCanvasCourses, fetchCanvasAssignments, fetchEnrollmentsWithGrades } from "../lib/canvas-fetch.js";
import { ToggleAssignmentCompleteParams } from "@workspace/api-zod";

const router = Router();

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

router.post("/canvas/sync", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { getCanvasToken } = await import("../lib/auth.js");
  const token = await getCanvasToken(user);
  if (!token || !user.canvasBaseUrl) {
    res.status(400).json({ error: "Canvas not connected — sign in with Canvas first" });
    return;
  }

  try {
    const rawCourses = await fetchCanvasCourses(token, user.canvasBaseUrl) as Record<string, unknown>[];
    let courseCount = 0;
    let assignmentCount = 0;

    for (const c of rawCourses) {
      if (!c["id"] || c["workflow_state"] !== "available") continue;
      const courseId = scopedCourseId(user.id, String(c["id"]));

      const [existing] = await db
        .select({ id: coursesTable.id })
        .from(coursesTable)
        .where(and(eq(coursesTable.id, courseId), eq(coursesTable.userId, user.id)))
        .limit(1);

      const courseData = {
        userId: user.id,
        name: String(c["name"] || "Untitled Course"),
        code: c["course_code"] ? String(c["course_code"]) : null,
        color: c["course_color"] ? String(c["course_color"]) : null,
        lastSynced: new Date(),
      };

      if (existing) {
        await db.update(coursesTable).set(courseData).where(and(eq(coursesTable.id, courseId), eq(coursesTable.userId, user.id)));
      } else {
        await db.insert(coursesTable).values({ id: courseId, ...courseData });
      }
      courseCount++;

      try {
        const rawAssignments = await fetchCanvasAssignments(token, user.canvasBaseUrl, String(c["id"])) as Record<string, unknown>[];
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
            await db.update(assignmentsTable).set(assignmentData).where(eq(assignmentsTable.id, assignmentId));
          } else {
            await db.insert(assignmentsTable).values({ id: assignmentId, ...assignmentData, completed: false });
          }
          assignmentCount++;
        }
      } catch (err) {
        req.log.warn({ err, courseId }, "Assignment sync failed for course");
      }
    }

    if (user.canvasUserId) {
      try {
        const enrollments = await fetchEnrollmentsWithGrades(token, user.canvasBaseUrl, user.canvasUserId);
        for (const eg of enrollments) {
          const scopedCourse = scopedCourseId(user.id, eg.courseId);
          const [course] = await db
            .select({ id: coursesTable.id })
            .from(coursesTable)
            .where(and(eq(coursesTable.id, scopedCourse), eq(coursesTable.userId, user.id)))
            .limit(1);
          if (!course) continue;

          const [existingGrade] = await db
            .select({ id: gradesTable.id })
            .from(gradesTable)
            .where(and(eq(gradesTable.userId, user.id), eq(gradesTable.courseId, scopedCourse)))
            .limit(1);

          const gradeData = {
            currentScore: eg.currentScore,
            finalScore: eg.finalScore,
            letterGrade: letterGrade(eg.currentScore),
            fetchedAt: new Date(),
          };

          if (existingGrade) {
            await db.update(gradesTable).set(gradeData).where(eq(gradesTable.id, existingGrade.id));
          } else {
            await db.insert(gradesTable).values({ userId: user.id, courseId: scopedCourse, ...gradeData });
          }
        }
      } catch (err) {
        req.log.warn({ err }, "Grade sync failed");
      }
    }

    res.json({ success: true, courseCount, assignmentCount, message: null });
  } catch (err) {
    req.log.error({ err }, "Canvas sync error");
    res.status(500).json({ error: "Sync failed — check Canvas connection" });
  }
});

router.get("/canvas/grades", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

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

    res.json({ grades });
  } catch (err) {
    req.log.error({ err }, "Grades fetch error");
    res.status(500).json({ error: "Failed to fetch grades" });
  }
});

router.get("/canvas/dashboard", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const now = new Date();

    const courses = await db
      .select({ id: coursesTable.id })
      .from(coursesTable)
      .where(eq(coursesTable.userId, user.id));

    const courseIds = courses.map((c) => c.id);
    const courseCount = courseIds.length;

    if (courseIds.length === 0) {
      res.json({
        upcomingCount: 0,
        overdueCount: 0,
        completedCount: 0,
        totalAssignments: 0,
        avgGrade: null,
        nextDue: null,
        courseCount: 0,
      });
      return;
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

    const upcoming = allAssignments.filter((a) => !a.completed && a.dueDate && a.dueDate >= now);
    const overdue = allAssignments.filter((a) => !a.completed && a.dueDate && a.dueDate < now);
    const completed = allAssignments.filter((a) => a.completed);

    const nextDueAssignment = upcoming.sort((a, b) =>
      new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
    )[0] || null;

    const grades = await db
      .select({ currentScore: gradesTable.currentScore })
      .from(gradesTable)
      .where(eq(gradesTable.userId, user.id));

    const scoredGrades = grades.filter((g) => g.currentScore !== null);
    const avgGrade = scoredGrades.length > 0
      ? scoredGrades.reduce((s, g) => s + (g.currentScore ?? 0), 0) / scoredGrades.length
      : null;

    const nextDue = nextDueAssignment ? {
      id: nextDueAssignment.id,
      name: nextDueAssignment.name,
      description: nextDueAssignment.description,
      dueDate: nextDueAssignment.dueDate?.toISOString() || null,
      points: nextDueAssignment.points,
      url: nextDueAssignment.url,
      completed: nextDueAssignment.completed,
      courseId: nextDueAssignment.courseId,
      courseName: nextDueAssignment.courseName,
    } : null;

    res.json({
      upcomingCount: upcoming.length,
      overdueCount: overdue.length,
      completedCount: completed.length,
      totalAssignments: allAssignments.length,
      avgGrade,
      nextDue,
      courseCount,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard fetch error");
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.patch("/canvas/assignments/:id/complete", async (req, res): Promise<void> => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleAssignmentCompleteParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid assignment ID" });
    return;
  }

  try {
    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .innerJoin(coursesTable, eq(assignmentsTable.courseId, coursesTable.id))
      .where(and(eq(assignmentsTable.id, params.data.id), eq(coursesTable.userId, user.id)))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const [updated] = await db
      .update(assignmentsTable)
      .set({ completed: !assignment.assignments.completed, updatedAt: new Date() })
      .where(eq(assignmentsTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const course = await db
      .select({ name: coursesTable.name })
      .from(coursesTable)
      .where(eq(coursesTable.id, updated.courseId))
      .limit(1);

    res.json({
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
  } catch (err) {
    req.log.error({ err }, "Toggle assignment error");
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

export default router;
