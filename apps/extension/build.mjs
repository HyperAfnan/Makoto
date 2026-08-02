import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "build", "chrome-mv3-prod");
const apiUrl = process.env.CONTEXT_API_URL ?? "http://localhost:8787";
await mkdir(join(out, "contents"), { recursive: true });
await copyFile(join(root, "assets", "manifest.json"), join(out, "manifest.json"));

await writeFile(
  join(out, "background.js"),
  `
const actions = { context: "context", claim: "claim" };
let pendingResult = null;
function deliverPendingResult() { if (pendingResult) chrome.runtime.sendMessage(pendingResult).catch(() => undefined); }
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({ id: "context", title: "Know the Context", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "claim", title: "Analyze Claim", contexts: ["selection"] });
}));
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = actions[String(info.menuItemId)];
  if (!action || !tab?.id) return;
  pendingResult = null;
  try { await chrome.sidePanel.open({ tabId: tab.id }); await chrome.tabs.sendMessage(tab.id, { type: "analyze", action }); setTimeout(deliverPendingResult, 250); } catch {}
});
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "tweet-context" && message.action && message.context) { pendingResult = message; deliverPendingResult(); }
  if (message.type === "sidepanel-ready") deliverPendingResult();
});
`,
);

await writeFile(
  join(out, "contents", "x.js"),
  `
function extract(selection) {
  const selected = window.getSelection()?.anchorNode;
  const article = (selected instanceof Element ? selected.closest("article") : null) || document.querySelector("article");
  const link = article?.querySelector('a[href*="/status/"]');
  const time = article?.querySelector("time");
  const author = article?.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || article?.querySelector('a[href^="/"]:not([href*="/status/"])')?.textContent?.trim() || "";
  const tweet = article?.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || article?.innerText?.trim().slice(0, 5000) || selection;
  return { selection: selection.slice(0, 2000), tweet, url: link?.href || location.href, author, timestamp: time?.dateTime || "", platform: "x" };
}
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "analyze" || !message.action) return;
  chrome.runtime.sendMessage({ type: "tweet-context", action: message.action, context: extract(window.getSelection()?.toString().trim() || "") }).catch(() => undefined);
});
`,
);

await writeFile(
  join(out, "sidepanel.html"),
  `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Context</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0d1117;color:#e6edf3}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#172554 0,#0d1117 38%);min-width:300px}.panel{padding:20px 16px 32px;max-width:640px;margin:auto}header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #263244;padding-bottom:16px;margin-bottom:20px}h1{font-size:25px;margin:2px 0 0;letter-spacing:-.04em}h2{font-size:14px;margin:24px 0 8px;color:#c9d4e0}.eyebrow{font-size:10px;letter-spacing:.15em;color:#8b9bb0;margin:0}.status{font-size:11px;border:1px solid #334155;border-radius:999px;padding:5px 9px;color:#9fb0c5}.status-success{color:#7ee2a8;border-color:#23603e}.status-error{color:#ff9b9b;border-color:#713b43}.empty,.loading,.error{border:1px solid #263244;border-radius:14px;padding:24px;text-align:center;background:#121a26}.icon{font-size:30px;color:#7dd3fc}.empty p,.loading small,.error p,.muted{color:#93a4b8;line-height:1.5;font-size:13px}.spinner{width:24px;height:24px;border:3px solid #334155;border-top-color:#7dd3fc;border-radius:50%;margin:0 auto 14px;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}button{background:#38bdf8;color:#082f49;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}.error{border-color:#713b43;text-align:left}.evidence{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}.evidence span,.strength,.verdict{font-size:11px;border:1px solid #334155;border-radius:999px;padding:5px 8px;color:#aebed0}.strength{font-weight:700;text-transform:capitalize}.strength-high{color:#7ee2a8;border-color:#23603e}.strength-medium{color:#f7cf75;border-color:#70551d}.strength-low{color:#ffad8f;border-color:#713b43}.verdict{display:inline-block;text-transform:capitalize;font-weight:700;margin:2px 0 8px}.verdict-true{color:#7ee2a8;border-color:#23603e}.verdict-false{color:#ff9b9b;border-color:#713b43}.verdict-misleading{color:#f7cf75;border-color:#70551d}p{font-size:14px;line-height:1.6;margin:8px 0}ul{padding-left:20px;color:#c6d2df;font-size:13px;line-height:1.6}.sources{display:grid;gap:8px}.source{display:grid;gap:4px;text-decoration:none;color:#dce7f3;border:1px solid #263244;border-radius:10px;padding:11px;background:#111923}.source:hover{border-color:#38bdf8}.source strong{font-size:13px}.source span{font-size:11px;color:#7dd3fc}.source small{font-size:11px;color:#91a1b4;line-height:1.4}
</style></head><body><main id="app"></main><script src="sidepanel.js"></script></body></html>`,
);

await writeFile(
  join(out, "sidepanel.js"),
  `
const API = ${JSON.stringify(apiUrl)};
const app = document.querySelector("#app");
let lastMessage = null;
const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#39;"}[char]));
const shell = (status) => '<main class="panel"><header><div><p class="eyebrow">EVIDENCE ENGINE</p><h1>Context</h1></div><span class="status status-' + status.toLowerCase().replace(/\\s/g,"-") + '" role="status">' + escape(status) + '</span></header>';
function renderEmpty() { app.innerHTML = shell("Idle") + '<div class="empty"><div class="icon">✦</div><h2>Make a claim clear</h2><p>Select text in an X post, right-click, and choose Know the Context or Analyze Claim.</p></div></main>'; }
function renderLoading(status) { app.innerHTML = shell(status) + '<div class="loading"><div class="spinner"></div><p>' + escape(status) + '</p><small>Searching independent sources and building an evidence-backed answer.</small></div></main>'; }
function renderError(message) { app.innerHTML = shell("Error") + '<div class="error"><strong>Couldn’t complete the analysis</strong><p>' + escape(message) + '</p><button id="retry">Try again</button></div></main>'; document.querySelector("#retry").onclick = () => { if (!lastMessage?.action) return; chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => { if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "analyze", action: lastMessage.action }).catch(() => undefined); }); }; }
function renderResult(response) {
  const e = response.evidence, a = response.analysis, sources = response.search.results || [];
  const sourceHtml = sources.map((source) => '<a class="source" href="' + escape(source.url) + '" target="_blank" rel="noreferrer"><strong>' + escape(source.title || source.domain) + '</strong><span>' + escape(source.domain) + '</span><small>' + escape(source.snippet) + '</small></a>').join("");
  app.innerHTML = shell("Success") + '<section class="evidence"><div class="strength strength-' + e.strength + '">' + e.strength + ' evidence</div><span>' + e.independentDomains + ' independent domains</span><span>' + e.officialSources + ' official sources</span><span>' + Math.round(e.agreementRatio * 100) + '% agreement</span>' + (e.conflicts ? '<span>' + e.conflicts + ' conflicting sources</span>' : '') + '</section>' + (a.verdict ? '<div class="verdict verdict-' + a.verdict + '">' + escape(a.verdict) + '</div>' : '') + (a.claimType ? '<p class="muted">Claim type: ' + escape(a.claimType) + '</p>' : '') + '<h2>' + (response.action === "claim" ? "Analysis" : "Summary") + '</h2><p>' + escape(a.summary) + '</p>' + (a.reasoning ? '<h2>Reasoning</h2><p>' + escape(a.reasoning) + '</p>' : '') + (a.background ? '<h2>Background</h2><p>' + escape(a.background) + '</p>' : '') + '<h2>Sources (' + sources.length + ')</h2><div class="sources">' + sourceHtml + '</div></main>';
}
renderEmpty();
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type !== "tweet-context" || !message.action || !message.context) return;
  lastMessage = message; renderLoading("Loading");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API + "/api/" + message.action, { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify({ ...message.context, action: message.action }), signal: controller.signal });
    if (!response.ok || !response.body) throw new Error("Request failed (" + response.status + ")");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    while (true) { const chunk = await reader.read(); buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done }); const events = buffer.split("\\n\\n"); buffer = events.pop() || ""; for (const event of events) { const type = event.match(/^event: (.+)$/m)?.[1]; const raw = event.match(/^data: (.+)$/m)?.[1]; if (!raw) continue; const payload = JSON.parse(raw); if (type === "status") renderLoading(payload.message || "Loading"); if (type === "completed") renderResult(payload); if (type === "error") throw new Error(payload.message || "Analysis failed"); } if (chunk.done) break; }
  } catch (error) { renderError(error.name === "AbortError" ? "Request timed out. Try again." : error.message || "Request failed"); } finally { clearTimeout(timeout); }
});
`,
);

console.log(`Built ${out}`);
