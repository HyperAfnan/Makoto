
const API = "http://localhost:8787";
const app = document.querySelector("#app");
let lastMessage = null;
const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const shell = (status) => '<main class="panel"><header><div><p class="eyebrow">EVIDENCE ENGINE</p><h1>Context</h1></div><span class="status status-' + status.toLowerCase().replace(/\s/g,"-") + '" role="status">' + escape(status) + '</span></header>';
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
    while (true) { const chunk = await reader.read(); buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done }); const events = buffer.split("\n\n"); buffer = events.pop() || ""; for (const event of events) { const type = event.match(/^event: (.+)$/m)?.[1]; const raw = event.match(/^data: (.+)$/m)?.[1]; if (!raw) continue; const payload = JSON.parse(raw); if (type === "status") renderLoading(payload.message || "Loading"); if (type === "completed") renderResult(payload); if (type === "error") throw new Error(payload.message || "Analysis failed"); } if (chunk.done) break; }
  } catch (error) { renderError(error.name === "AbortError" ? "Request timed out. Try again." : error.message || "Request failed"); } finally { clearTimeout(timeout); }
});
