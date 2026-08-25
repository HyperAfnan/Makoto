import { useEffect, useState } from "react";
import type { Action, AnalysisResponse, ApiSettings, TweetContext } from "./shared";

const API = process.env.PLASMO_PUBLIC_API_URL ?? "http://localhost:8787";

type Message = { type?: string; action?: Action; context?: TweetContext };

const _actionNames: Record<Action, string> = { context: "Makoto", claim: "Claim" };
const getSettings = (): Promise<ApiSettings | undefined> =>
	new Promise((resolve) => chrome.storage.local.get("apiSettings", ({ apiSettings }) => resolve(apiSettings)));

function Evidence({ response }: { response: AnalysisResponse }) {
	const { evidence } = response;
	return (
		<section className="evidence" aria-label="Evidence summary">
			<div className={`strength strength-${evidence.strength}`}>{evidence.strength} evidence</div>
			<span>{evidence.independentDomains} independent domains</span>
			<span>{evidence.officialSources} official sources</span>
			<span>{Math.round(evidence.agreementRatio * 100)}% agreement</span>
			{evidence.conflicts > 0 && <span>{evidence.conflicts} conflicting sources</span>}
		</section>
	);
}

function Result({ response }: { response: AnalysisResponse }) {
	const { analysis, search } = response;
	return (
		<>
			<Evidence response={response} />
			{analysis.verdict && <div className={`verdict verdict-${analysis.verdict}`}>{analysis.verdict}</div>}
			{analysis.claimType && <p className="muted">Claim type: {analysis.claimType}</p>}
			<h2>{response.action === "claim" ? "Analysis" : "Summary"}</h2>
			<p>{analysis.summary}</p>
			{analysis.reasoning && (
				<>
					<h2>Reasoning</h2>
					<p>{analysis.reasoning}</p>
				</>
			)}
			{analysis.background && (
				<>
					<h2>Background</h2>
					<p>{analysis.background}</p>
				</>
			)}
			{analysis.claims && analysis.claims.length > 0 && (
				<>
					<h2>Claims checked</h2>
					<ul>
						{analysis.claims.map((claim) => (
							<li key={claim}>{claim}</li>
						))}
					</ul>
				</>
			)}
			<h2>Sources ({search.results.length})</h2>
			<div className="sources">
				{search.results.map((source) => (
					<a className="source" href={source.url} target="_blank" rel="noreferrer" key={source.url}>
						<strong>{source.title || source.domain}</strong>
						<span>{source.domain}</span>
						<small>{source.snippet}</small>
					</a>
				))}
			</div>
		</>
	);
}

export default function SidePanel() {
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
			const timeout = setTimeout(() => controller.abort(), 30_000);
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
						const type = event.match(/^event: (.+)$/m)?.[1];
						const data = event.match(/^data: (.+)$/m)?.[1];
						if (!data) continue;
						const payload = JSON.parse(data) as AnalysisResponse & { message?: string };
						if (type === "status") setStatus(payload.message ?? "Loading");
						if (type === "completed") {
							setStatus("Success");
							setResponse(payload);
						}
						if (type === "error") throw new Error(payload.message ?? "Analysis failed");
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
					<p>Select text in an X post, right-click, and choose Know Context or Analyze Claim.</p>
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
