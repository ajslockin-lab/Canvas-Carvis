/**
 * Carvis — Chrome Extension Service Worker
 * Manages session storage and relays agent commands to the Carvis API.
 */

const DEFAULT_API_BASE = "https://carvis.replit.app";

async function getApiBase() {
  const result = await chrome.storage.sync.get(["apiBase"]);
  return (result.apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
}

async function getSessionToken() {
  const result = await chrome.storage.local.get(["sessionToken"]);
  return result.sessionToken || null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AGENT_COMMAND") {
    handleAgentCommand(message.command, message.pageContext)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "CHECK_AUTH") {
    checkAuth().then(sendResponse).catch(() => sendResponse({ authed: false }));
    return true;
  }

  if (message.type === "SET_SESSION") {
    chrome.storage.local.set({ sessionToken: message.token }, () =>
      sendResponse({ ok: true })
    );
    return true;
  }

  if (message.type === "GET_SESSION") {
    getSessionToken().then((t) => sendResponse({ token: t }));
    return true;
  }
});

async function checkAuth() {
  const apiBase = await getApiBase();
  const token = await getSessionToken();
  if (!token) return { authed: false };

  const res = await fetch(`${apiBase}/api/auth/me`, {
    headers: { "x-session-token": token },
    credentials: "include",
  });
  if (!res.ok) return { authed: false };
  const user = await res.json();
  return { authed: true, user };
}

async function handleAgentCommand(command, pageContext) {
  const apiBase = await getApiBase();
  const token = await getSessionToken();

  const res = await fetch(`${apiBase}/api/extension/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ command, pageContext }),
  });

  if (!res.ok) {
    if (res.status === 401) return { response: "Not signed in — open Carvis and connect your Canvas account first.", blocked: null };
    return { response: "Could not reach Carvis API. Check your connection.", blocked: null };
  }

  return res.json();
}
