import { Router } from "express";
import { DEMO_USER, DEMO_GRADES, DEMO_COURSES, getDemoAssignments, completionOverrides } from "../lib/demo-seed.js";
import { classifyIntent, generateResponse } from "../lib/nlu.js";

const router = Router();

const now = () => new Date();

router.get("/auth/me", (_req, res) => {
  res.json(DEMO_USER);
});

router.post("/auth/canvas/pat", (_req, res) => {
  res.json({ success: true, user: DEMO_USER });
});

router.post("/auth/canvas/start", (_req, res) => {
  res.status(400).json({ error: "OAuth not available in demo mode — PAT login is disabled too. Refresh to use the demo." });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("carvis_session", { path: "/" });
  res.json({ success: true });
});

router.post("/canvas/sync", (_req, res) => {
  const assignments = getDemoAssignments();
  res.json({ success: true, courseCount: DEMO_COURSES.length, assignmentCount: assignments.length, message: "Demo mode — sync is not connected to a real Canvas instance." });
});

router.get("/canvas/grades", (_req, res) => {
  res.json({ grades: DEMO_GRADES });
});

router.get("/canvas/dashboard", (_req, res) => {
  const assignments = getDemoAssignments();
  const n = now();

  const upcoming = assignments.filter((a) => !a.completed && a.dueDate && new Date(a.dueDate) >= n);
  const overdue = assignments.filter((a) => !a.completed && a.dueDate && new Date(a.dueDate) < n);
  const completed = assignments.filter((a) => a.completed);

  const nextDueRaw = upcoming.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0] ?? null;
  const nextDue = nextDueRaw
    ? { ...nextDueRaw, dueDate: nextDueRaw.dueDate }
    : null;

  const avgGrade =
    DEMO_GRADES.length > 0
      ? DEMO_GRADES.reduce((s, g) => s + g.currentScore, 0) / DEMO_GRADES.length
      : null;

  res.json({
    upcomingCount: upcoming.length,
    overdueCount: overdue.length,
    completedCount: completed.length,
    totalAssignments: assignments.length,
    avgGrade,
    nextDue,
    courseCount: DEMO_COURSES.length,
  });
});

router.patch("/canvas/assignments/:id/complete", (req, res) => {
  const { id } = req.params as { id: string };
  const assignments = getDemoAssignments();
  const assignment = assignments.find((a) => a.id === id);

  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  const current = completionOverrides.get(id) ?? assignment.completed;
  completionOverrides.set(id, !current);

  res.json({ ...assignment, completed: !current });
});

router.post("/voice/command", async (req, res) => {
  const text = (req.body as { text?: string })?.text ?? "";

  if (!text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  try {
    const allAssignments = getDemoAssignments();
    const n = now();
    const assignments = allAssignments
      .filter((a) => !a.completed)
      .map((a) => ({
        id: a.id,
        name: a.name,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        courseName: a.courseName,
        overdue: !!a.dueDate && new Date(a.dueDate) < n,
      }));

    const nlu = await classifyIntent(text);
    const response = await generateResponse(nlu.intent, nlu.entities, { assignments });

    res.json({ intent: nlu.intent, response, confidence: nlu.confidence });
  } catch {
    res.status(500).json({ error: "Voice command processing failed" });
  }
});

router.get("/voice/history", (_req, res) => {
  res.json({ messages: [] });
});

router.get("/canvas/courses", (_req, res) => {
  res.json({ courses: DEMO_COURSES });
});

export default router;
