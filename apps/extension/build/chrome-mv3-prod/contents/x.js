
function extract(selection) {
  const selected = window.getSelection()?.anchorNode;
  const article = (selected instanceof Element ? selected.closest("article") : null) || document.querySelector("article");
  const link = article?.querySelector('a[href*="/status/"]');
  const time = article?.querySelector("time");
  const author = article?.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || article?.querySelector('a[href^="/"]:not([href*="/status/"])')?.textContent?.trim() || "";
  const tweet = article?.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || article?.innerText?.trim().slice(0, 5000) || selection;
  return { selection: selection.slice(0, 2000), tweet, url: link?.href || location.href, author, timestamp: time?.dateTime || "", platform: "x" };
}
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "analyze" || !message.action) return;
  chrome.runtime.sendMessage({ type: "tweet-context", action: message.action, context: extract(window.getSelection()?.toString().trim() || "") }).catch(() => undefined);
});
