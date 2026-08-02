import { useEffect, useState } from "react";
import type { Action, TweetContext } from "@context/shared";

const API = process.env.PLASMO_PUBLIC_API_URL ?? "http://localhost:8787";

export default function SidePanel() {
  const [state, setState] = useState("Idle");
  const [result, setResult] = useState("");

  useEffect(() => {
    const listener = async (message: { type?: string; action?: Action; context?: TweetContext }) => {
      if (message.type !== "tweet-context" || !message.action || !message.context) return;
      setState("Loading");
      setResult("");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${API}/api/${message.action}`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({ ...message.context, action: message.action }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const chunk = await reader.read();
          buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const type = event.match(/^event: (.+)$/m)?.[1];
            const data = event.match(/^data: (.+)$/m)?.[1];
            if (!data) continue;
            const payload = JSON.parse(data) as { message?: string; requestId?: string };
            if (type === "status") setState(payload.message ?? "Loading");
            if (type === "completed") {
              setState("Success");
              setResult(JSON.stringify(payload, null, 2));
            }
            if (type === "error") throw new Error(payload.message ?? "Analysis failed");
          }
          if (chunk.done) break;
        }
      } catch (error) {
        setState("Error");
        setResult(error instanceof DOMException && error.name === "AbortError" ? "Request timed out" : error instanceof Error ? error.message : "Request failed");
      } finally {
        clearTimeout(timeout);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 16 }}>
      <h1>Context</h1>
      <p role="status">{state}</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
    </main>
  );
}
