import type { Action, TweetContext } from "../shared";

function extract(selection: string, srcUrl?: string): TweetContext {
	let article: Element | null = null;
	if (srcUrl) {
		const imgEl = Array.from(document.querySelectorAll<HTMLImageElement>("img")).find(
			(img) =>
				img.src === srcUrl || (srcUrl.includes("pbs.twimg.com/media/") && img.src.includes(srcUrl.split("?")[0])),
		);
		article = imgEl?.closest("article") ?? null;
	}
	if (!article) {
		const selected = window.getSelection()?.anchorNode;
		article =
			(selected instanceof Element ? selected.closest("article") : selected?.parentElement?.closest("article")) ??
			document.querySelector("article");
	}

	const link = article?.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
	const time = article?.querySelector("time");
	const author =
		article?.querySelector('[data-testid="User-Name"]')?.textContent?.trim() ??
		article?.querySelector<HTMLAnchorElement>('a[href^="/"]:not([href*="/status/"])')?.textContent?.trim() ??
		"";
	const tweetText =
		article?.querySelector('[data-testid="tweetText"]')?.textContent?.trim() ??
		(article instanceof HTMLElement ? article.innerText.trim().slice(0, 5000) : "") ??
		"";

	const imagesSet = new Set<string>();
	if (srcUrl && srcUrl.startsWith("http")) imagesSet.add(srcUrl);
	if (article) {
		const imgs = article.querySelectorAll<HTMLImageElement>(
			'img[src*="pbs.twimg.com/media/"], [data-testid="tweetPhoto"] img',
		);
		for (const img of imgs) {
			if (img.src && img.src.startsWith("http")) imagesSet.add(img.src);
			if (imagesSet.size >= 4) break;
		}
	}
	const images = Array.from(imagesSet).slice(0, 4);
	if (images.length > 0) {
		console.log("[Makoto] Extracted images:", images);
	}

	const effectiveSelection = selection.trim() || tweetText.slice(0, 2000) || "Image Post";

	return {
		selection: effectiveSelection.slice(0, 2000),
		tweet: tweetText || effectiveSelection,
		url: link?.href ?? location.href,
		author,
		timestamp: time?.dateTime ?? "",
		platform: "x",
		...(images.length > 0 ? { images } : {}),
	};
}

chrome.runtime.onMessage.addListener((message: { type?: string; action?: Action; srcUrl?: string }) => {
	if (message.type !== "analyze" || !message.action) return;
	const selection = window.getSelection()?.toString().trim() ?? "";
	chrome.runtime
		.sendMessage({
			type: "tweet-context",
			action: message.action,
			context: extract(selection, message.srcUrl),
		})
		.catch(() => undefined);
});
