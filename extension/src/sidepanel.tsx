import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Action, AnalysisResponse, ApiSettings, TweetContext } from "./shared";

const API = process.env.CONTEXT_API_URL ?? process.env.PLASMO_PUBLIC_API_URL ?? "http://localhost:8787";

type Message = { type?: string; action?: Action; context?: TweetContext };

const getSettings = (): Promise<ApiSettings | undefined> =>
	new Promise((resolve) => chrome.storage.local.get("apiSettings", ({ apiSettings }) => resolve(apiSettings)));

function safeString(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(safeString).join("\n");
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		return String(obj.text ?? obj.claim ?? obj.summary ?? obj.content ?? JSON.stringify(value));
	}
	return String(value ?? "");
}

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("[Makoto] SidePanel UI error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<main className="panel">
					<header>
						<div>
							<p className="eyebrow">EVIDENCE ENGINE</p>
							<h1>Makoto</h1>
						</div>
						<span className="status status-error" role="status">
							Error
						</span>
					</header>
					<div className="error">
						<strong>Rendering Error</strong>
						<p>{this.state.error?.message ?? "An error occurred while displaying results."}</p>
						<button onClick={() => this.setState({ hasError: false, error: null })}>Try again</button>
					</div>
				</main>
			);
		}
		return this.props.children;
	}
}

function Evidence({ response }: { response: AnalysisResponse }) {
	const evidence = response.evidence ?? {
		strength: "low" as const,
		independentDomains: 0,
		officialSources: 0,
		agreementRatio: 0,
		conflicts: 0,
	};
	const images = response.input?.images ?? [];
	return (
		<section className="evidence" aria-label="Evidence summary">
			<div className={`strength strength-${evidence.strength}`}>{evidence.strength} evidence</div>
			<span>{evidence.independentDomains} independent domains</span>
			<span>{evidence.officialSources} official sources</span>
			<span>{Math.round((evidence.agreementRatio || 0) * 100)}% agreement</span>
			{evidence.conflicts > 0 && <span>{evidence.conflicts} conflicting sources</span>}
			{images.length > 0 && (
				<span>
					📷 {images.length} image{images.length > 1 ? "s" : ""} analyzed
				</span>
			)}
		</section>
	);
}

function Result({ response }: { response: AnalysisResponse }) {
	const analysis = response.analysis ?? { summary: "", background: "", related: [] };
	const search = response.search ?? { results: [] };
	const results = Array.isArray(search.results) ? search.results : [];
	const rawClaims = analysis.claims;
	const claims = Array.isArray(rawClaims) ? rawClaims : rawClaims ? [rawClaims] : [];

	return (
		<>
			<Evidence response={response} />
			{analysis.verdict && (
				<div className={`verdict verdict-${analysis.verdict}`}>{safeString(analysis.verdict)}</div>
			)}
			{analysis.claimType && <p className="muted">Claim type: {safeString(analysis.claimType)}</p>}
			<h2>{response.action === "claim" ? "Analysis" : "Summary"}</h2>
			<p>{safeString(analysis.summary)}</p>
			{analysis.reasoning && (
				<>
					<h2>Reasoning</h2>
					<p>{safeString(analysis.reasoning)}</p>
				</>
			)}
			{analysis.background && (
				<>
					<h2>Background</h2>
					<p>{safeString(analysis.background)}</p>
				</>
			)}
			{claims.length > 0 && (
				<>
					<h2>Claims checked</h2>
					<ul>
						{claims.map((claim, index) => (
							<li key={index}>{safeString(claim)}</li>
						))}
					</ul>
				</>
			)}
			<h2>Citation ({results.length})</h2>
			<div className="sources">
				{results.map((source, index) => (
					<a className="source" href={source.url} target="_blank" rel="noreferrer" key={source.url || index}>
						<strong>{source.title || source.domain}</strong>
						<span>{source.domain}</span>
						<small>{source.snippet}</small>
					</a>
				))}
			</div>
		</>
	);
}

function SidePanel() {
	const [status, setStatus] = useState("Idle");
	const [response, setResponse] = useState<AnalysisResponse | null>(null);
	const [error, setError] = useState("");
	const [lastMessage, setLastMessage] = useState<Message | null>(null);

	useEffect(() => {
		chrome.runtime.sendMessage({ type: "sidepanel-ready" }).catch(() => undefined);
		const listener = async (message: Message) => {
			if (message.type !== "tweet-context" || !message.action || !message.context) return;
			setLastMessage(message);
			setStatus("Loading");
			setError("");
			setResponse(null);
			const controller = new AbortController();
			const timeout = setTimeout(
				() => controller.abort(),
				message.context.platform === "instagram" ? 120_000 : 35_000,
			);
			try {
				const result = await fetch(`${API}/api/${message.action}`, {
					method: "POST",
					headers: { "content-type": "application/json", accept: "text/event-stream" },
					body: JSON.stringify({ ...message.context, action: message.action, settings: await getSettings() }),
					signal: controller.signal,
				});
				if (!result.ok || !result.body) throw new Error(`Request failed (${result.status})`);
				const reader = result.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				while (true) {
					const chunk = await reader.read();
					buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
					const events = buffer.split("\n\n");
					buffer = events.pop() ?? "";
					for (const event of events) {
						if (!event.trim()) continue;
						const typeMatch = event.match(/^event:\s*(.+)$/m);
						const dataMatch = event.match(/^data:\s*([\s\S]+)$/m);
						const type = typeMatch?.[1]?.trim();
						const data = dataMatch?.[1]?.trim();
						if (!data) continue;
						try {
							const payload = JSON.parse(data) as AnalysisResponse & { message?: string };
							if (type === "status") setStatus(payload.message ?? "Loading");
							if (type === "completed") {
								setStatus("Success");
								setResponse(payload);
							}
							if (type === "error") throw new Error(payload.message ?? "Analysis failed");
						} catch (parseErr) {
							if (type === "error") throw parseErr;
							console.warn("[Makoto] SSE event parse error:", parseErr, data);
						}
					}
					if (chunk.done) break;
				}
			} catch (caught) {
				setStatus("Error");
				setError(
					caught instanceof DOMException && caught.name === "AbortError"
						? "Request timed out. Try again."
						: caught instanceof Error
							? caught.message
							: "Request failed",
				);
			} finally {
				clearTimeout(timeout);
			}
		};
		chrome.runtime.onMessage.addListener(listener);
		return () => chrome.runtime.onMessage.removeListener(listener);
	}, []);

	const retry = () => {
		if (!lastMessage?.action) return;
		chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
			if (tab.id)
				chrome.tabs.sendMessage(tab.id, { type: "analyze", action: lastMessage.action }).catch(() => undefined);
		});
	};

	return (
		<main className="panel">
			<header>
				<div>
					<p className="eyebrow">EVIDENCE ENGINE</p>
					<h1>Makoto</h1>
				</div>
				<span className={`status status-${status.toLowerCase().replace(/\s/g, "-")}`} role="status">
					{status}
				</span>
			</header>
			{!response && status === "Idle" && (
				<div className="empty">
					<div className="icon">✦</div>
					<h2>Make a claim clear</h2>
					<p>Select text or right-click an image in an X post, and choose Know Context or Analyze Claim.</p>
				</div>
			)}
			{!response && status !== "Idle" && status !== "Error" && (
				<div className="loading">
					<div className="spinner" />
					<p>{status}</p>
					<small>Searching independent sources and building an evidence-backed answer.</small>
				</div>
			)}
			{error && (
				<div className="error">
					<strong>Couldn’t complete the analysis</strong>
					<p>{error}</p>
					<button onClick={retry}>Try again</button>
				</div>
			)}
			{response && <Result response={response} />}
		</main>
	);
}

const container = document.getElementById("app");
if (container) {
	const root = createRoot(container);
	root.render(
		<ErrorBoundary>
			<SidePanel />
		</ErrorBoundary>,
	);
}
