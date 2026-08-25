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
  chrome.contextMenus.create({ id: "context", title: "Know Context", contexts: ["selection"] });
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
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Makoto</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0d1117;color:#e6edf3}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#172554 0,#0d1117 38%);min-width:300px}.panel{padding:20px 16px 32px;max-width:640px;margin:auto}header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #263244;padding-bottom:16px;margin-bottom:20px}h1{font-size:25px;margin:2px 0 0;letter-spacing:-.04em}h2{font-size:14px;margin:24px 0 8px;color:#c9d4e0}.eyebrow{font-size:10px;letter-spacing:.15em;color:#8b9bb0;margin:0}.status{font-size:11px;border:1px solid #334155;border-radius:999px;padding:5px 9px;color:#9fb0c5}.status-success{color:#7ee2a8;border-color:#23603e}.status-error{color:#ff9b9b;border-color:#713b43}.empty,.loading,.error{border:1px solid #263244;border-radius:14px;padding:24px;text-align:center;background:#121a26}.icon{font-size:30px;color:#7dd3fc}.empty p,.loading small,.error p,.muted{color:#93a4b8;line-height:1.5;font-size:13px}.spinner{width:24px;height:24px;border:3px solid #334155;border-top-color:#7dd3fc;border-radius:50%;margin:0 auto 14px;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}button{background:#38bdf8;color:#082f49;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}.error{border-color:#713b43;text-align:left}.evidence{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}.evidence span,.strength,.verdict{font-size:11px;border:1px solid #334155;border-radius:999px;padding:5px 8px;color:#aebed0}.strength{font-weight:700;text-transform:capitalize}.strength-high{color:#7ee2a8;border-color:#23603e}.strength-medium{color:#f7cf75;border-color:#70551d}.strength-low{color:#ffad8f;border-color:#713b43}.verdict{display:inline-block;text-transform:capitalize;font-weight:700;margin:2px 0 8px}.verdict-true{color:#7ee2a8;border-color:#23603e}.verdict-false{color:#ff9b9b;border-color:#713b43}.verdict-misleading{color:#f7cf75;border-color:#70551d}p{font-size:14px;line-height:1.6;margin:8px 0}ul{padding-left:20px;color:#c6d2df;font-size:13px;line-height:1.6}.sources{display:grid;gap:8px}.source{display:grid;gap:4px;text-decoration:none;color:#dce7f3;border:1px solid #263244;border-radius:10px;padding:11px;background:#111923}.source:hover{border-color:#38bdf8}.source strong{font-size:13px}.source span{font-size:11px;color:#7dd3fc}.source small{font-size:11px;color:#91a1b4;line-height:1.4}
</style></head><body><main id="app"></main><script src="sidepanel.js"></script></body></html>`,
);

await writeFile(
	join(out, "options.html"),
	`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Makoto Settings</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#111315;color:#d9dde3}*{box-sizing:border-box}body{margin:0;background:#111315;min-height:100vh}.page{width:min(100% - 32px,760px);margin:auto;padding:42px 0 56px}.hero{margin-bottom:24px}.eyebrow{margin:0 0 8px;color:#8b949e;font-size:10px;font-weight:500;letter-spacing:.12em}.hero h1{margin:0;font-size:30px;font-weight:600;letter-spacing:normal}.hero p,.card>p,.hint{color:#8f98a4;line-height:1.5;font-size:13px}.card{margin:12px 0;padding:22px;border:1px solid #2b3037;border-radius:10px;background:#191c20}.card h2{margin:0 0 6px;font-size:16px;font-weight:600}.field{display:grid;gap:8px;margin:16px 0}.field:first-of-type{margin-top:0}label{font-size:13px;font-weight:500}.input-wrap{display:flex;gap:8px}.input-wrap input{flex:1}input,select{width:100%;border:1px solid #343a42;border-radius:7px;background:#121416;color:#e5e7eb;padding:10px 11px;font:inherit}input:focus,select:focus{outline:2px solid #7182a055;outline-offset:1px;border-color:#7182a0}.icon-button{width:40px;border:1px solid #343a42;border-radius:7px;background:transparent;color:#8f98a4;cursor:pointer}.icon-button:hover{color:#c4ccd6;border-color:#566276}.eye{width:16px;height:16px;display:block;margin:auto}.checks{display:grid;gap:9px}.check,.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 0;border-top:1px solid #272c32}.check:first-child,.toggle-row:first-child{border-top:0;padding-top:0}.check label{display:flex;align-items:center;gap:10px}.check input{width:16px;height:16px;accent-color:#7182a0}.toggle-row{align-items:flex-start}.toggle-row label{display:grid;gap:4px}.toggle-row small{color:#7d8793;font-size:12px;font-weight:400}.switch{position:relative;width:40px;height:22px;flex:none}.switch input{opacity:0;width:0;height:0}.slider{position:absolute;inset:0;border-radius:999px;background:#3a4048;cursor:pointer}.slider:before{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;border-radius:50%;background:#c7cdd5;transition:.15s}.switch input:checked+.slider{background:#677997}.switch input:checked+.slider:before{transform:translateX(18px);background:#f0f2f4}.actions{display:flex;align-items:center;gap:10px;margin-top:20px}button{border:0;border-radius:7px;background:#7182a0;color:#101318;padding:10px 15px;font-weight:600;cursor:pointer}button:hover{filter:brightness(1.08)}button.secondary{background:transparent;color:#aeb7c3;border:1px solid #3a414a}.status{min-height:20px;color:#9aaa91;font-size:13px}.about{display:flex;justify-content:space-between;color:#7f8995;font-size:13px}.about a{color:#9daac0;text-decoration:none}.about a:hover{color:#c0c9d5}
</style></head><body><main class="page"><header class="hero"><p class="eyebrow">MAKOTO</p><h1>Extension Settings</h1><p>Connect your providers and control how Makoto gathers evidence. API keys are stored locally in this browser.</p></header><form id="settings"><section class="card"><h2>AI Providers</h2><p>Keys are sent only with analysis requests and are never stored by the backend.</p><div class="field"><label for="geminiApiKey">Gemini API Key</label><div class="input-wrap"><input id="geminiApiKey" type="password" autocomplete="off" placeholder="Paste your Gemini API key"><button class="icon-button" type="button" data-target="geminiApiKey" aria-label="Show geminiApiKey"><svg class="eye eye-open" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><svg class="eye eye-off" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path fill="none" stroke="currentColor" stroke-width="1.8" d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.8M6.4 6.5C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5"/></svg></button></div></div><div class="field"><label for="braveApiKey">Brave Search API Key</label><div class="input-wrap"><input id="braveApiKey" type="password" autocomplete="off" placeholder="Paste your Brave Search API key"><button class="icon-button" type="button" data-target="braveApiKey" aria-label="Show braveApiKey"><svg class="eye eye-open" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><svg class="eye eye-off" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path fill="none" stroke="currentColor" stroke-width="1.8" d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.8M6.4 6.5C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5"/></svg></button></div></div><div class="field"><label for="tavilyApiKey">Tavily API Key</label><div class="input-wrap"><input id="tavilyApiKey" type="password" autocomplete="off" placeholder="Paste your Tavily API key"><button class="icon-button" type="button" data-target="tavilyApiKey" aria-label="Show Tavily API key"><svg class="eye eye-open" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><svg class="eye eye-off" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path fill="none" stroke="currentColor" stroke-width="1.8" d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.8M6.4 6.5C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5"/></svg></button></div></div><div class="toggle-row"><label for="showKeys">Show API keys<small>Reveal keys while you verify them.</small></label><label class="switch"><input id="showKeys" type="checkbox"><span class="slider"></span></label></div></section><section class="card"><h2>Models</h2><p>Choose the model used for grounded summaries and claim reasoning.</p><div class="field"><label for="aiProvider">Provider</label><select id="aiProvider"><option value="gemini">Gemini</option></select></div><div class="field"><label for="geminiModel">Model</label><select id="geminiModel"><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.0-flash">Gemini 2.0 Flash</option></select></div></section><section class="card"><h2>Search</h2><p>Select one active search provider and choose the source limit.</p><div class="checks"><div class="check"><label><input id="useBrave" type="checkbox"> Use Brave</label></div><div class="check"><label><input id="useTavily" type="checkbox"> Use Tavily</label></div></div><div class="field"><label for="maxSources">Maximum Sources</label><input id="maxSources" type="number" min="1" max="20" step="1" value="5"><p class="hint">Higher values can improve coverage but use more search requests.</p></div></section><section class="card"><h2>Privacy</h2><div class="toggle-row"><label for="storeLocally">Store locally only<small>Keep provider keys in this browser profile.</small></label><label class="switch"><input id="storeLocally" type="checkbox" checked disabled><span class="slider"></span></label></div></section><section class="card"><h2>About</h2><div class="about"><span>Makoto v0.0.1</span><a href="https://github.com/HyperAfnan/Makoto" target="_blank" rel="noreferrer">GitHub ↗</a></div></section><div class="actions"><button type="submit">Save settings</button><button class="secondary" id="clear" type="button">Clear API keys</button><p id="status" class="status" role="status"></p></div></form></main><script src="options.js"></script></body></html>`,
);

await writeFile(
	join(out, "options.js"),
	`
const form = document.querySelector("#settings");
const status = document.querySelector("#status");
const setStatus = (message) => { status.textContent = message; };
const setSearchProvider = (provider) => { document.querySelector("#useBrave").checked = provider === "brave"; document.querySelector("#useTavily").checked = provider === "tavily"; };
chrome.storage.local.get("apiSettings", ({ apiSettings }) => { if (!apiSettings) return setSearchProvider("brave"); for (const field of ["geminiApiKey", "braveApiKey", "tavilyApiKey", "geminiModel", "maxSources"]) if (apiSettings[field] !== undefined) document.querySelector("#" + field).value = apiSettings[field]; setSearchProvider(apiSettings.searchProvider || "brave"); });
for (const id of ["useBrave", "useTavily"]) document.querySelector("#" + id).addEventListener("change", (event) => { if (event.target.checked) setSearchProvider(id === "useBrave" ? "brave" : "tavily"); else event.target.checked = true; });
const setVisible = (id, visible) => { const input = document.querySelector("#" + id); input.type = visible ? "text" : "password"; const button = document.querySelector('[data-target="' + id + '"]'); button.querySelector(".eye-open").style.display = visible ? "none" : "block"; button.querySelector(".eye-off").style.display = visible ? "block" : "none"; };\nfor (const button of document.querySelectorAll("[data-target]")) button.addEventListener("click", () => setVisible(button.dataset.target, document.querySelector("#" + button.dataset.target).type === "password"));
document.querySelector("#showKeys").addEventListener("change", (event) => { for (const id of ["geminiApiKey", "braveApiKey", "tavilyApiKey"]) setVisible(id, event.target.checked); });
form.addEventListener("submit", async (event) => { event.preventDefault(); await chrome.storage.local.set({ apiSettings: { searchProvider: document.querySelector("#useBrave").checked ? "brave" : "tavily", geminiApiKey: document.querySelector("#geminiApiKey").value.trim(), braveApiKey: document.querySelector("#braveApiKey").value.trim(), tavilyApiKey: document.querySelector("#tavilyApiKey").value.trim(), geminiModel: document.querySelector("#geminiModel").value, maxSources: Number(document.querySelector("#maxSources").value) } }); setStatus("Settings saved."); });
document.querySelector("#clear").addEventListener("click", async () => { for (const id of ["geminiApiKey", "braveApiKey", "tavilyApiKey"]) document.querySelector("#" + id).value = ""; await chrome.storage.local.remove("apiSettings"); setStatus("API keys cleared."); });
`,
);

await writeFile(
	join(out, "sidepanel.js"),
	`
const API = ${JSON.stringify(apiUrl)};
const app = document.querySelector("#app");
let lastMessage = null;
const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#39;"}[char]));
const shell = (status) => '<main class="panel"><header><div><p class="eyebrow">EVIDENCE ENGINE</p><h1>Makoto</h1></div><span class="status status-' + status.toLowerCase().replace(/\\s/g,"-") + '" role="status">' + escape(status) + '</span></header>';
function renderEmpty() { app.innerHTML = shell("Idle") + '<div class="empty"><div class="icon">✦</div><h2>Make a claim clear</h2><p>Select text in an X post, right-click, and choose Know Makoto or Analyze Claim.</p></div></main>'; }
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
    const settings = await new Promise((resolve) => chrome.storage.local.get("apiSettings", ({ apiSettings }) => resolve(apiSettings)));
    const response = await fetch(API + "/api/" + message.action, { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify({ ...message.context, action: message.action, settings }), signal: controller.signal });
    if (!response.ok || !response.body) throw new Error("Request failed (" + response.status + ")");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    while (true) { const chunk = await reader.read(); buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done }); const events = buffer.split("\\n\\n"); buffer = events.pop() || ""; for (const event of events) { const type = event.match(/^event: (.+)$/m)?.[1]; const raw = event.match(/^data: (.+)$/m)?.[1]; if (!raw) continue; const payload = JSON.parse(raw); if (type === "status") renderLoading(payload.message || "Loading"); if (type === "completed") renderResult(payload); if (type === "error") throw new Error(payload.message || "Analysis failed"); } if (chunk.done) break; }
  } catch (error) { renderError(error.name === "AbortError" ? "Request timed out. Try again." : error.message || "Request failed"); } finally { clearTimeout(timeout); }
});
`,
);

console.log(`Built ${out}`);
