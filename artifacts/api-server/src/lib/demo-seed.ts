const now = new Date();

function daysFromNow(n: number): string {
  const d = new Date(now.getTime() + n * 86_400_000);
  return d.toISOString();
}

export const DEMO_USER = {
  id: "demo_user",
  email: "alex.rivera@demo.carvis.dev",
  name: "Alex Rivera",
  canvasBaseUrl: "https://demo.instructure.com",
  canvasConnected: true,
};

export const DEMO_COURSES = [
  { id: "demo_c1", name: "Algorithms & Data Structures", code: "CSCI 301", color: "#4F46E5" },
  { id: "demo_c2", name: "Cognitive Psychology", code: "PSYC 202", color: "#0891B2" },
  { id: "demo_c3", name: "Linear Algebra", code: "MATH 341", color: "#059669" },
  { id: "demo_c4", name: "Technical Writing for Engineers", code: "ENGL 215", color: "#D97706" },
];

export const DEMO_GRADES = [
  { courseId: "demo_c1", name: "Algorithms & Data Structures", currentScore: 94.2, finalScore: 94.2, letterGrade: "A" },
  { courseId: "demo_c2", name: "Cognitive Psychology", currentScore: 88.5, finalScore: 88.5, letterGrade: "B+" },
  { courseId: "demo_c3", name: "Linear Algebra", currentScore: 91.0, finalScore: 91.0, letterGrade: "A-" },
  { courseId: "demo_c4", name: "Technical Writing for Engineers", currentScore: 95.7, finalScore: 95.7, letterGrade: "A" },
];

export const DEMO_ASSIGNMENTS: {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  points: number;
  url: string | null;
  completed: boolean;
  courseId: string;
  courseName: string;
}[] = [
  {
    id: "demo_a1",
    name: "Dynamic Programming Problem Set",
    description: "Solve 5 DP problems from the course packet.",
    dueDate: daysFromNow(-8),
    points: 100,
    url: null,
    completed: false,
    courseId: "demo_c1",
    courseName: "Algorithms & Data Structures",
  },
  {
    id: "demo_a2",
    name: "Graph Traversal Lab",
    description: "Implement BFS and DFS in Python.",
    dueDate: daysFromNow(-3),
    points: 50,
    url: null,
    completed: false,
    courseId: "demo_c1",
    courseName: "Algorithms & Data Structures",
  },
  {
    id: "demo_a3",
    name: "Memory and Cognition Essay",
    description: "2000-word essay on working memory models.",
    dueDate: daysFromNow(-1),
    points: 75,
    url: null,
    completed: false,
    courseId: "demo_c2",
    courseName: "Cognitive Psychology",
  },
  {
    id: "demo_a4",
    name: "Midterm Exam",
    description: null,
    dueDate: daysFromNow(3),
    points: 200,
    url: null,
    completed: false,
    courseId: "demo_c3",
    courseName: "Linear Algebra",
  },
  {
    id: "demo_a5",
    name: "Eigenvalues Problem Set",
    description: "Chapter 5 exercises 1–20.",
    dueDate: daysFromNow(6),
    points: 80,
    url: null,
    completed: false,
    courseId: "demo_c3",
    courseName: "Linear Algebra",
  },
  {
    id: "demo_a6",
    name: "Attention and Perception Reading Quiz",
    description: null,
    dueDate: daysFromNow(7),
    points: 25,
    url: null,
    completed: false,
    courseId: "demo_c2",
    courseName: "Cognitive Psychology",
  },
  {
    id: "demo_a7",
    name: "Technical Report Draft",
    description: "First draft of the semester technical report.",
    dueDate: daysFromNow(10),
    points: 100,
    url: null,
    completed: false,
    courseId: "demo_c4",
    courseName: "Technical Writing for Engineers",
  },
  {
    id: "demo_a8",
    name: "Algorithm Complexity Analysis",
    description: "Big-O analysis for 10 provided algorithms.",
    dueDate: daysFromNow(14),
    points: 60,
    url: null,
    completed: false,
    courseId: "demo_c1",
    courseName: "Algorithms & Data Structures",
  },
  {
    id: "demo_a9",
    name: "Sorting Algorithms Quiz",
    description: null,
    dueDate: daysFromNow(-15),
    points: 30,
    url: null,
    completed: true,
    courseId: "demo_c1",
    courseName: "Algorithms & Data Structures",
  },
  {
    id: "demo_a10",
    name: "Introduction Essay",
    description: null,
    dueDate: daysFromNow(-20),
    points: 50,
    url: null,
    completed: true,
    courseId: "demo_c4",
    courseName: "Technical Writing for Engineers",
  },
];

export const completionOverrides = new Map<string, boolean>(
  DEMO_ASSIGNMENTS.map((a) => [a.id, a.completed])
);

export function getDemoAssignments() {
  return DEMO_ASSIGNMENTS.map((a) => ({
    ...a,
    completed: completionOverrides.get(a.id) ?? a.completed,
  }));
}
