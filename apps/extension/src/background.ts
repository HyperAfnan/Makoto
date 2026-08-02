import type { Action } from "@context/shared";

const actions: Record<string, Action> = {
  context: "context",
  claim: "claim",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "context", title: "Know the Context", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "claim", title: "Analyze Claim", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = actions[String(info.menuItemId)];
  if (!action || !tab?.id) return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.tabs.sendMessage(tab.id, { type: "analyze", action });
  } catch {
    // The tab may have navigated away before the content script could respond.
  }
});
