import type { Action, TweetContext } from "@context/shared";

function extract(selection: string): TweetContext {
  const article = document.querySelector("article");
  const link = article?.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  const time = article?.querySelector("time");
  const author = article?.querySelector('[data-testid="User-Name"]')?.textContent?.trim() ?? "";
  return {
    selection: selection.slice(0, 2000),
    tweet:
      article?.querySelector('[data-testid="tweetText"]')?.textContent?.trim() ??
      article?.innerText?.trim() ??
      selection,
    url: link?.href ?? location.href,
    author,
    timestamp: time?.dateTime ?? "",
    platform: "x",
  };
}

chrome.runtime.onMessage.addListener((message: { type?: string; action?: Action }) => {
  if (message.type !== "analyze" || !message.action) return;
  const selection = window.getSelection()?.toString().trim() ?? "";
  chrome.runtime
    .sendMessage({ type: "tweet-context", action: message.action, context: extract(selection) })
    .catch(() => undefined);
});
