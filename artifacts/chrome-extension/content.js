/**
 * Carvis — Content Script
 * Runs on Canvas pages. Scrapes interactive elements and executes agent actions.
 * Also injects the Carvis HUD overlay.
 */

(function () {
  "use strict";

  if (window.__carvisInjected) return;
  window.__carvisInjected = true;

  // ─── Page element scraper ──────────────────────────────────────────────────

  function scrapePageContext() {
    const elements = [];
    const seen = new Set();

    const selectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='menuitem']",
      "[role='tab']",
    ];

    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      const text = (el.textContent || el.value || "").trim().slice(0, 120);
      const ariaLabel = el.getAttribute("aria-label") || null;
      const placeholder = el.getAttribute("placeholder") || null;
      const href = el.getAttribute("href") || null;
      const tag = el.tagName.toLowerCase();

      const key = `${tag}:${text}:${href}`;
      if (seen.has(key) || (!text && !ariaLabel && !placeholder)) return;
      seen.add(key);

      const id = el.id || `carvis-el-${elements.length}`;
      if (!el.id) el.dataset.carvisId = id;

      elements.push({ id, tag, text, ariaLabel, placeholder, href });
    });

    return {
      url: window.location.href,
      title: document.title,
      elements: elements.slice(0, 200),
    };
  }

  // ─── Action executor ───────────────────────────────────────────────────────

  function executeAction(action) {
    if (!action || !action.type) return;

    switch (action.type) {
      case "click": {
        const el = findElement(action.elementId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => el.click(), 200);
          flashElement(el);
        }
        break;
      }
      case "fill": {
        const el = findElement(action.elementId);
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
          el.focus();
          el.value = action.value || "";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          flashElement(el);
        }
        break;
      }
      case "scroll": {
        const amount = action.direction === "up" ? -400 : 400;
        window.scrollBy({ top: amount, behavior: "smooth" });
        break;
      }
      case "navigate": {
        if (action.url) window.location.href = action.url;
        break;
      }
    }
  }

  function findElement(id) {
    if (!id) return null;
    return (
      document.getElementById(id) ||
      document.querySelector(`[data-carvis-id="${id}"]`) ||
      null
    );
  }

  function flashElement(el) {
    const prev = el.style.outline;
    el.style.outline = "2px solid #FF4444";
    el.style.outlineOffset = "2px";
    setTimeout(() => {
      el.style.outline = prev;
      el.style.outlineOffset = "";
    }, 1200);
  }

  // ─── Message bridge ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SCRAPE_PAGE") {
      sendResponse(scrapePageContext());
      return true;
    }
    if (message.type === "EXECUTE_ACTION") {
      executeAction(message.action);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "SHOW_RESPONSE") {
      showToast(message.text, message.blocked);
      sendResponse({ ok: true });
      return true;
    }
  });

  // ─── Toast notification ────────────────────────────────────────────────────

  function showToast(text, blocked) {
    const existing = document.getElementById("carvis-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "carvis-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 2147483647;
      max-width: 320px;
      padding: 12px 16px;
      background: #0a0d14;
      border: 1px solid ${blocked ? "#FF8800" : "#FF4444"};
      color: #e8eaf0;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      border-radius: 0;
      box-shadow: 0 0 20px rgba(255,68,68,0.2);
      animation: carvisSlideIn 0.2s ease;
    `;

    const label = document.createElement("div");
    label.style.cssText = `
      font-size: 10px;
      color: ${blocked ? "#FF8800" : "#FF4444"};
      letter-spacing: 0.1em;
      margin-bottom: 6px;
      text-transform: uppercase;
    `;
    label.textContent = blocked ? "CARVIS // BLOCKED" : "CARVIS //";

    const content = document.createElement("div");
    content.textContent = text;

    toast.appendChild(label);
    toast.appendChild(content);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes carvisSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
})();
