import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "build", "chrome-mv3-prod");
await mkdir(out, { recursive: true });
await copyFile(join(root, "assets", "manifest.json"), join(out, "manifest.json"));

await writeFile(
  join(out, "background.js"),
  `
const actions = { context: "context", claim: "claim" };
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({ id: "context", title: "Know the Context", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "claim", title: "Analyze Claim", contexts: ["selection"] });
}));
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = actions[String(info.menuItemId)];
  if (!action || !tab?.id) return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.tabs.sendMessage(tab.id, { type: "analyze", action });
  } catch {}
});
`,
);

await mkdir(join(out, "contents"), { recursive: true });
await writeFile(
  join(out, "contents", "x.js"),
  `
function extract(selection) {
  const article = document.querySelector("article");
  const link = article?.querySelector('a[href*="/status/"]');
  const time = article?.querySelector("time");
  const author = article?.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || "";
  return { selection: selection.slice(0, 2000), tweet: article?.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || article?.innerText?.trim() || selection, url: link?.href || location.href, author, timestamp: time?.dateTime || "", platform: "x" };
}
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "analyze" || !message.action) return;
  chrome.runtime.sendMessage({ type: "tweet-context", action: message.action, context: extract(window.getSelection()?.toString().trim() || "") }).catch(() => undefined);
});
`,
);

await writeFile(
  join(out, "sidepanel.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>Context</title></head><body><main id="app"></main><script src="sidepanel.js"></script></body></html>`,
);
await writeFile(
  join(out, "sidepanel.js"),
  `
const app = document.querySelector("#app");
const API = "http://localhost:8787";
app.innerHTML = '<h1>Context</h1><p id="status" role="status">Idle</p><pre id="result"></pre>';
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type !== "tweet-context" || !message.action || !message.context) return;
  const status = document.querySelector("#status"); const result = document.querySelector("#result");
  status.textContent = "Loading"; result.textContent = "";
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(API + "/api/" + message.action, { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify({ ...message.context, action: message.action }), signal: controller.signal });
    if (!response.ok || !response.body) throw new Error("Request failed (" + response.status + ")");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    while (true) {
      const chunk = await reader.read(); buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
      const events = buffer.split("\\n\\n"); buffer = events.pop() || "";
      for (const event of events) {
        const type = event.match(/^event: (.+)$/m)?.[1]; const raw = event.match(/^data: (.+)$/m)?.[1]; if (!raw) continue;
        const payload = JSON.parse(raw); if (type === "status") status.textContent = payload.message || "Loading";
        if (type === "completed") { status.textContent = "Success"; result.textContent = JSON.stringify(payload, null, 2); }
        if (type === "error") throw new Error(payload.message || "Analysis failed");
      }
      if (chunk.done) break;
    }
  } catch (error) { status.textContent = "Error"; result.textContent = error.name === "AbortError" ? "Request timed out" : error.message || "Request failed"; }
  finally { clearTimeout(timeout); }
});
`,
);

console.log(`Built ${out}`);
