import type { Action, TweetContext } from "../shared";

function findActiveReelElement(srcUrl?: string, linkUrl?: string): Element | null {
	if (linkUrl && (linkUrl.includes("/reel/") || linkUrl.includes("/reels/"))) {
		const link = document.querySelector(`a[href*="${new URL(linkUrl).pathname}"]`);
		if (link) return link.closest("article") ?? link.closest('div[role="dialog"]') ?? link.parentElement;
	}

	if (srcUrl) {
		const media = Array.from(document.querySelectorAll<HTMLMediaElement>("video, img")).find(
			(el) => el.src === srcUrl || el.currentSrc === srcUrl,
		);
		if (media) return media.closest("article") ?? media.closest('div[role="dialog"]') ?? media.parentElement;
	}

	// Find the video most centered in the viewport for Reels feed
	const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
	if (videos.length > 0) {
		const windowCenter = window.innerHeight / 2;
		let closestVideo: HTMLVideoElement | null = null;
		let minDistance = Infinity;

		for (const video of videos) {
			const rect = video.getBoundingClientRect();
			const videoCenter = rect.top + rect.height / 2;
			const distance = Math.abs(windowCenter - videoCenter);
			if (rect.height > 0 && distance < minDistance) {
				minDistance = distance;
				closestVideo = video;
			}
		}

		if (closestVideo) {
			return (
				closestVideo.closest("article") ?? closestVideo.closest('div[role="dialog"]') ?? closestVideo.parentElement
			);
		}
	}

	return document.querySelector("article") ?? document.querySelector('div[role="dialog"]');
}

function extractReel(selection: string, srcUrl?: string, linkUrl?: string): TweetContext {
	const container = findActiveReelElement(srcUrl, linkUrl);

	// Find Reel URL
	const reelLink = container?.querySelector<HTMLAnchorElement>('a[href*="/reel/"], a[href*="/reels/"]');
	let url = linkUrl ?? reelLink?.href ?? location.href;
	if (!url.includes("/reel/") && !url.includes("/reels/") && location.pathname.startsWith("/reel/")) {
		url = location.href;
	}

	// Find Creator / Author
	const authorEl =
		container?.querySelector<HTMLAnchorElement>('header a[href^="/"]:not([href*="/reel/"])') ??
		container?.querySelector<HTMLAnchorElement>('a[role="link"][href^="/"]:not([href*="/reel/"])') ??
		container?.querySelector<HTMLAnchorElement>('a[href^="/"]:not([href*="/reel/"]):not([href*="/explore/"])') ??
		document.querySelector<HTMLAnchorElement>('header a[href^="/"]:not([href*="/reel/"])') ??
		document.querySelector<HTMLAnchorElement>(
			'a[role="link"][href^="/"]:not([href*="/reel/"]):not([href*="/explore/"]):not([href*="/direct/"]):not([href*="/stories/"]):not([href*="/p/"])',
		);
	const author = authorEl?.textContent?.trim() || authorEl?.getAttribute("href")?.replace(/\//g, "") || "";

	// Find Caption / Text
	const time =
		container?.querySelector<HTMLTimeElement>("time") ??
		document.querySelector<HTMLTimeElement>("article time, div[role='dialog'] time");
	const captionEl =
		container?.querySelector("h1") ??
		container?.querySelector('article span[dir="auto"]') ??
		container?.querySelector('div[role="dialog"] span[dir="auto"]') ??
		document.querySelector('article span[dir="auto"]') ??
		document.querySelector('div[role="dialog"] span[dir="auto"]');
	const caption = captionEl?.textContent?.trim() ?? container?.textContent?.slice(0, 3000).trim() ?? "";

	// Find Media / Poster
	const imagesSet = new Set<string>();
	const video = container?.querySelector<HTMLVideoElement>("video");
	if (video?.poster && video.poster.startsWith("http")) imagesSet.add(video.poster);
	const imgs = container?.querySelectorAll<HTMLImageElement>("img") ?? [];
	for (const img of imgs) {
		if (img.src && img.src.startsWith("http") && !img.src.includes("profile_pic")) {
			imagesSet.add(img.src);
			if (imagesSet.size >= 4) break;
		}
	}
	const images = Array.from(imagesSet).slice(0, 4);

	const effectiveSelection = selection.trim() || caption.slice(0, 2000) || "Instagram Reel";

	const context: TweetContext = {
		selection: effectiveSelection.slice(0, 2000),
		tweet: caption || effectiveSelection,
		url,
		author,
		timestamp: time?.dateTime ?? time?.getAttribute("datetime") ?? "",
		platform: "instagram",
		...(images.length > 0 ? { images } : {}),
	};

	console.log("[Makoto] Extracted Instagram Reel context:", context);
	return context;
}

chrome.runtime.onMessage.addListener(
	(message: { type?: string; action?: Action; srcUrl?: string; linkUrl?: string }) => {
		if (message.type !== "analyze" || !message.action) return;
		const selection = window.getSelection()?.toString().trim() ?? "";
		chrome.runtime
			.sendMessage({
				type: "tweet-context",
				action: message.action,
				context: extractReel(selection, message.srcUrl, message.linkUrl),
			})
			.catch(() => undefined);
	},
);
