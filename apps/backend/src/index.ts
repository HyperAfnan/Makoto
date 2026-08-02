import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Action, AnalysisRequest, AnalysisResponse } from "@context/shared";
import { analyzeClaim, analyzeContext } from "./ai.js";
import { createProvider, generateQueries, searchEvidence } from "./search.js";

const port = Number(process.env.PORT ?? 8787);

function validate(body: unknown): { value?: AnalysisRequest; error?: string } {
  if (!body || typeof body !== "object") return { error: "JSON body is required" };
  const input = body as Record<string, unknown>;
  const fields = ["selection", "tweet", "url", "author", "timestamp", "platform"];
  const missing = fields.find((field) => typeof input[field] !== "string" || !input[field]);
  if (missing) return { error: `${missing} is required` };
  if (input.platform !== "x") return { error: "platform must be x" };
  if (String(input.selection).length > 2000) return { error: "selection must be 2000 characters or fewer" };
  if (input.action !== "context" && input.action !== "claim") return { error: "action must be context or claim" };
  return { value: input as unknown as AnalysisRequest };
}

function headers(type = "application/json") {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, accept", "Content-Type": type };
}

async function body(req: IncomingMessage) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 32_000) throw new Error("Request body is too large");
  }
  return JSON.parse(text || "{}");
}

async function analyze(action: Action, req: IncomingMessage, res: ServerResponse) {
  let input: AnalysisRequest;
  try {
    const result = validate({ ...(await body(req)), action });
    if (result.error) {
      res.writeHead(400, headers());
      res.end(JSON.stringify({ error: result.error }));
      return;
    }
    input = result.value!;
  } catch (error) {
    res.writeHead(400, headers());
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid JSON" }));
    return;
  }

  const requestId = randomUUID();
  res.writeHead(200, { ...headers("text/event-stream"), "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    send("status", { requestId, message: "Searching..." });
    const search = await searchEvidence(createProvider(), generateQueries(input.selection, action));
    send("status", { requestId, message: `Found ${search.results.length} sources.` });
    send("status", { requestId, message: "Analyzing..." });
    const analysis = action === "claim" ? await analyzeClaim(input.selection, search.results) : await analyzeContext(input.selection, search.results);
    const response: AnalysisResponse = { requestId, action, status: "completed", message: "Analysis completed.", input, search, analysis };
    send("completed", response);
  } catch (error) {
    send("error", { requestId, message: error instanceof Error ? error.message : "Analysis failed" });
  } finally {
    res.end();
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers());
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, headers());
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "POST" && (url.pathname === "/api/context" || url.pathname === "/api/claim")) {
    await analyze(url.pathname.endsWith("claim") ? "claim" : "context", req, res);
    return;
  }
  res.writeHead(404, headers());
  res.end(JSON.stringify({ error: "Not found" }));
});

if (process.env.NODE_ENV !== "test") server.listen(port, () => console.log(`Context backend listening on http://localhost:${port}`));

export { server, validate };
