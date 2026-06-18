interface NLUResult {
  intent: string;
  entities: {
    courseName?: string;
    assignmentName?: string;
    dueDate?: string;
    timeDuration?: string;
  };
  confidence: number;
  rawText: string;
}

type AssignmentCtx = { id: string; name: string; dueDate: Date | null; courseName?: string; overdue?: boolean };

let groqClient: {
  chat: {
    completions: {
      create: (params: {
        messages: { role: string; content: string }[];
        model: string;
        temperature: number;
        max_tokens: number;
      }) => Promise<{ choices: { message: { content: string } }[] }>;
    };
  };
} | null = null;

async function getGroq() {
  if (!groqClient && process.env["GROQ_API_KEY"]) {
    try {
      const { default: Groq } = await import("groq-sdk");
      groqClient = new Groq({ apiKey: process.env["GROQ_API_KEY"] }) as unknown as typeof groqClient;
    } catch {
      groqClient = null;
    }
  }
  return groqClient;
}

export async function classifyIntent(text: string): Promise<NLUResult> {
  const groq = await getGroq();
  if (!groq) return { intent: "general", entities: {}, confidence: 0, rawText: text };
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            'You are an intent classifier for a Canvas LMS voice assistant. Classify the query into one of: "check_deadlines", "upcoming_assignments", "set_reminder", "study_plan", "tutor", "social", "general". Return ONLY valid JSON: {"intent": "...", "entities": {...}, "confidence": 0.95, "rawText": "..."}. No markdown, no code blocks.',
        },
        { role: "user", content: `Classify this query: "${text}"` },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 384,
    });
    const content = completion.choices[0]?.message?.content || "";
    try {
      const result = JSON.parse(content) as NLUResult;
      return {
        intent: result.intent || "general",
        entities: result.entities || {},
        confidence: result.confidence || 0.5,
        rawText: text,
      };
    } catch {
      return { intent: "general", entities: {}, confidence: 0.3, rawText: text };
    }
  } catch {
    return { intent: "general", entities: {}, confidence: 0, rawText: text };
  }
}

export async function generateResponse(
  intent: string,
  entities: NLUResult["entities"],
  context: { assignments?: AssignmentCtx[] }
): Promise<string> {
  const assignments = context.assignments || [];
  const overdue = assignments.filter((a) => a.overdue);
  const upcoming = assignments.filter((a) => !a.overdue);
  const summary = [
    ...overdue.map((a) => {
      const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "unknown";
      return `- [OVERDUE] ${a.name}${a.courseName ? ` (${a.courseName})` : ""} — was due ${due}`;
    }),
    ...upcoming.map((a) => {
      const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "soon";
      return `- ${a.name}${a.courseName ? ` (${a.courseName})` : ""} — due ${due}`;
    }),
  ].slice(0, 10);

  const groq = await getGroq();
  if (!groq) return fallbackResponse(intent, summary, overdue.length, upcoming.length);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are CARVIS, a helpful academic assistant for Canvas students. Respond in a friendly, concise way (1-2 sentences for voice).",
        },
        {
          role: "user",
          content: `Intent: ${intent}. Recent assignments:\n${summary.join("\n")}\nUser entities: ${JSON.stringify(entities)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 300,
    });
    return completion.choices[0]?.message?.content || "I'm not sure about that. Could you rephrase?";
  } catch {
    return fallbackResponse(intent, summary, overdue.length, upcoming.length);
  }
}

function fallbackResponse(intent: string, summary: string[], overdueCount: number, upcomingCount: number): string {
  switch (intent) {
    case "check_deadlines":
    case "upcoming_assignments": {
      const parts: string[] = [];
      if (overdueCount > 0) parts.push(`${overdueCount} overdue`);
      if (upcomingCount > 0) parts.push(`${upcomingCount} upcoming`);
      if (parts.length === 0) return "You have no pending assignments right now.";
      const first = summary[0]?.replace(/^- (\[OVERDUE\] )?/, "") ?? "";
      return `You have ${parts.join(" and ")} assignment${overdueCount + upcomingCount > 1 ? "s" : ""}. ${overdueCount > 0 ? "Most urgent: " : "Next up: "}${first}.`;
    }
    case "study_plan":
      if (overdueCount > 0) return `You have ${overdueCount} overdue assignment${overdueCount > 1 ? "s" : ""} to clear first, then focus on upcoming deadlines.`;
      return "Based on your upcoming deadlines, I'd suggest focusing on your most urgent assignments first.";
    case "tutor":
      return "I can help you understand your course material. What topic would you like to review?";
    default:
      return "I can help you manage your Canvas assignments and deadlines. Try asking about upcoming work or your grades.";
  }
}
