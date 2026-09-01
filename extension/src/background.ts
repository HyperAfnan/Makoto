import type { Action } from "./shared";

const actions: Record<string, Action> = {
	context: "context",
	claim: "claim",
};

let pendingResult: { type: "tweet-context"; action: Action; context: unknown } | null = null;

function deliverPendingResult() {
	if (!pendingResult) return;
	chrome.runtime.sendMessage(pendingResult).catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({ id: "context", title: "Know Context", contexts: ["selection", "image"] });
		chrome.contextMenus.create({ id: "claim", title: "Analyze Claim", contexts: ["selection", "image"] });
	});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	const action = actions[String(info.menuItemId)];
	if (!action || !tab?.id) return;
	pendingResult = null;

	try {
		await chrome.sidePanel.open({ tabId: tab.id });
	} catch (e) {
		console.error(`Unable to open side panel: ${e}`);
	}

	try {
		await chrome.tabs.sendMessage(tab.id, { type: "analyze", action, srcUrl: info.srcUrl });
		setTimeout(deliverPendingResult, 250);
	} catch {
		// Content script may not be loaded if tab existed before extension install/reload
		try {
			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["contents/x.js"],
			});
			await chrome.tabs.sendMessage(tab.id, { type: "analyze", action, srcUrl: info.srcUrl });
			setTimeout(deliverPendingResult, 250);
		} catch (injectErr) {
			console.error(`Unable to communicate with content script: ${injectErr}`);
		}
	}
});

chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "tweet-context" && message.action && message.context) {
		pendingResult = message;
		deliverPendingResult();
	}
	if (message.type === "sidepanel-ready") deliverPendingResult();
});
