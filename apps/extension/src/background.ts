import type { Action } from "@context/shared";

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
    chrome.contextMenus.create({ id: "context", title: "Know the Context", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "claim", title: "Analyze Claim", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = actions[String(info.menuItemId)];
  if (!action || !tab?.id) return;
  pendingResult = null;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.tabs.sendMessage(tab.id, { type: "analyze", action });
    setTimeout(deliverPendingResult, 250);
  } catch {
    // The tab may have navigated away before the content script could respond.
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "tweet-context" && message.action && message.context) {
    pendingResult = message;
    deliverPendingResult();
  }
  if (message.type === "sidepanel-ready") deliverPendingResult();
});
