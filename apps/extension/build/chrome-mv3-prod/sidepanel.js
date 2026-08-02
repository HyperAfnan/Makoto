
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
      const events = buffer.split("\n\n"); buffer = events.pop() || "";
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
