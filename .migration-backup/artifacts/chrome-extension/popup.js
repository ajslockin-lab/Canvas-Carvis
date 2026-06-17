/**
 * Carvis Popup — controls the extension popup UI.
 */

const DEFAULT_API_BASE = "https://carvis.replit.app";

// ─── DOM refs ──────────────────────────────────────────────────────────────
const authScreen     = document.getElementById("auth-screen");
const mainScreen     = document.getElementById("main-screen");
const notCanvasMsg   = document.getElementById("not-canvas-msg");
const statusBadge    = document.getElementById("status-badge");
const cmdInput       = document.getElementById("cmd-input");
const sendBtn        = document.getElementById("send-btn");
const micBtn         = document.getElementById("mic-btn");
const responseArea   = document.getElementById("response-area");
const responseLabel  = document.getElementById("response-label");
const openCarvisLink = document.getElementById("open-carvis-link");
const openDashboard  = document.getElementById("open-dashboard");
const openOptions    = document.getElementById("open-options");
const signOutBtn     = document.getElementById("sign-out-btn");
const statDue        = document.getElementById("stat-due");
const statOverdue    = document.getElementById("stat-overdue");
const statGrade      = document.getElementById("stat-grade");

let isOnCanvas = false;
let isProcessing = false;
let recognition = null;
let isListening = false;
let apiBase = DEFAULT_API_BASE;

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.storage.sync.get(["apiBase"]);
  if (stored.apiBase) apiBase = stored.apiBase.replace(/\/$/, "");

  openCarvisLink.href = apiBase;
  openCarvisLink.onclick = () => { chrome.tabs.create({ url: apiBase }); return false; };
  openDashboard.onclick  = () => chrome.tabs.create({ url: `${apiBase}/dashboard` });

  // Check if we're on a Canvas page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  isOnCanvas = tab?.url?.includes(".instructure.com") || false;

  // Check auth
  const authResult = await chrome.runtime.sendMessage({ type: "CHECK_AUTH" });

  if (!authResult.authed) {
    authScreen.style.display = "flex";
    mainScreen.style.display = "none";
    statusBadge.textContent  = "OFFLINE";
    statusBadge.className    = "status-badge";
    return;
  }

  authScreen.style.display = "none";
  mainScreen.style.display = "block";
  statusBadge.textContent  = "ONLINE";
  statusBadge.className    = "status-badge online";

  if (!isOnCanvas) {
    notCanvasMsg.style.display = "block";
    sendBtn.disabled = true;
    micBtn.disabled  = true;
  }

  // Load dashboard stats
  loadStats(authResult.user);

  setupSpeechRecognition();
}

// ─── Stats ─────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const session = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
    const token   = session?.token;
    const res = await fetch(`${apiBase}/api/canvas/dashboard`, {
      headers: token ? { "x-session-token": token } : {},
      credentials: "include",
    });
    if (!res.ok) return;
    const data = await res.json();
    statDue.textContent     = data.upcomingCount ?? "—";
    statOverdue.textContent = data.overdueCount  ?? "—";
    statGrade.textContent   = data.avgGrade != null ? `${Math.round(data.avgGrade)}%` : "—";
  } catch {
    // silently fail — stats are non-critical
  }
}

// ─── Command dispatch ──────────────────────────────────────────────────────

async function runCommand(text) {
  if (!text.trim() || isProcessing || !isOnCanvas) return;

  isProcessing = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner"></span>RUNNING';

  setResponse(`Processing: "${text}"`, false, true);

  try {
    // Scrape the page from the active Canvas tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let pageContext;
    try {
      const scrapeResult = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_PAGE" });
      pageContext = scrapeResult;
    } catch {
      // Content script not yet injected — inject it
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const scrapeResult = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_PAGE" });
      pageContext = scrapeResult;
    }

    // Send to Carvis API
    const agentResult = await chrome.runtime.sendMessage({
      type:        "AGENT_COMMAND",
      command:     text,
      pageContext,
    });

    setResponse(agentResult.response, agentResult.blocked);

    // Execute the action on the Canvas tab if not blocked
    if (agentResult.action && !agentResult.blocked) {
      await chrome.tabs.sendMessage(tab.id, {
        type:   "EXECUTE_ACTION",
        action: agentResult.action,
      });
    }

    // Show toast on Canvas tab
    if (agentResult.response) {
      chrome.tabs.sendMessage(tab.id, {
        type:    "SHOW_RESPONSE",
        text:    agentResult.response,
        blocked: agentResult.blocked,
      }).catch(() => {});
    }

    cmdInput.value = "";
  } catch (err) {
    setResponse("Connection error — is the Carvis app running?", false);
    console.error(err);
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "RUN";
  }
}

function setResponse(text, blocked, loading = false) {
  responseArea.textContent = text;
  responseArea.className   = blocked ? "blocked" : loading ? "empty" : "";
  responseLabel.textContent = blocked ? "CARVIS // BLOCKED" : "CARVIS //";
  responseLabel.className   = blocked ? "response-label blocked" : "response-label";
}

// ─── Voice input ───────────────────────────────────────────────────────────

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = "none";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = "en-US";

  recognition.onstart  = () => { isListening = true;  micBtn.classList.add("listening"); };
  recognition.onend    = () => { isListening = false; micBtn.classList.remove("listening"); };
  recognition.onerror  = () => { isListening = false; micBtn.classList.remove("listening"); };

  recognition.onresult = (event) => {
    const transcript = event.results[event.resultIndex][0].transcript;
    cmdInput.value = transcript;
    if (event.results[event.resultIndex].isFinal) {
      runCommand(transcript);
    }
  };
}

// ─── Event listeners ───────────────────────────────────────────────────────

sendBtn.addEventListener("click", () => runCommand(cmdInput.value));

cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runCommand(cmdInput.value);
});

micBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (isListening) {
    recognition.stop();
  } else {
    cmdInput.value = "";
    recognition.start();
  }
});

openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

signOutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("sessionToken");
  authScreen.style.display = "flex";
  mainScreen.style.display = "none";
  statusBadge.textContent  = "OFFLINE";
  statusBadge.className    = "status-badge";
});

// ─── Boot ──────────────────────────────────────────────────────────────────
init();
