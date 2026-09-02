import type { Action, TweetContext } from "../shared";

let lastContextTarget: HTMLElement | null = null;

document.addEventListener(
	"contextmenu",
	(event) => {
		if (event.target instanceof HTMLElement) {
			lastContextTarget = event.target;
		}
	},
	true,
);

function extractRedditContext(action: Action, srcUrl?: string): TweetContext {
	const selection = window.getSelection()?.toString().trim() || "";

	// Find the closest post or comment container
	const shredditPost =
		lastContextTarget?.closest<HTMLElement>("shreddit-post") || document.querySelector<HTMLElement>("shreddit-post");

	const newRedditPost =
		lastContextTarget?.closest<HTMLElement>('div[data-testid="post-container"]') ||
		document.querySelector<HTMLElement>('div[data-testid="post-container"]');

	const oldRedditPost =
		lastContextTarget?.closest<HTMLElement>("div.thing.link") ||
		document.querySelector<HTMLElement>("div.thing.link");

	const commentEl =
		lastContextTarget?.closest<HTMLElement>("shreddit-comment") ||
		lastContextTarget?.closest<HTMLElement>('div[data-testid="comment"]');

	let title = "";
	let body = "";
	let author = "";
	let subreddit = "";
	let timestamp = "";
	let url = window.location.href;

	if (shredditPost) {
		title = shredditPost.getAttribute("post-title") || shredditPost.querySelector("h1")?.textContent?.trim() || "";

		author = shredditPost.getAttribute("author") ? `u/${shredditPost.getAttribute("author")}` : "";
		subreddit =
			shredditPost.getAttribute("subreddit-prefixed-name") || shredditPost.getAttribute("subreddit-name") || "";
		timestamp = shredditPost.getAttribute("created-timestamp") || "";

		const permalink = shredditPost.getAttribute("permalink");
		if (permalink) {
			url = permalink.startsWith("http") ? permalink : `https://www.reddit.com${permalink}`;
		}

		const textSlot = shredditPost.querySelector<HTMLElement>('[slot="text-body"], div[id*="-post-rtjson-content"]');
		body = textSlot?.textContent?.trim() || "";
	} else if (newRedditPost) {
		title = newRedditPost.querySelector("h1, h2, h3")?.textContent?.trim() || "";
		const authorEl = newRedditPost.querySelector('a[href*="/user/"], a[href*="/u/"]');
		author = authorEl?.textContent?.trim() || "";
		const subEl = newRedditPost.querySelector('a[href*="/r/"]');
		subreddit = subEl?.textContent?.trim() || "";
		const timeEl = newRedditPost.querySelector("time");
		timestamp = timeEl?.getAttribute("datetime") || "";
		const textEl = newRedditPost.querySelector('div[data-click-id="text"]');
		body = textEl?.textContent?.trim() || "";
	} else if (oldRedditPost) {
		title = oldRedditPost.querySelector("a.title")?.textContent?.trim() || "";
		const authorEl = oldRedditPost.querySelector("a.author");
		author = authorEl?.textContent?.trim() ? `u/${authorEl.textContent.trim()}` : "";
		const subEl = oldRedditPost.querySelector("a.subreddit");
		subreddit = subEl?.textContent?.trim() || "";
		const timeEl = oldRedditPost.querySelector("time");
		timestamp = timeEl?.getAttribute("datetime") || "";
		const textEl = oldRedditPost.querySelector("div.usertext-body");
		body = textEl?.textContent?.trim() || "";
	}

	// If clicked on a specific comment, capture the comment body
	if (commentEl) {
		const commentText = commentEl.querySelector("p")?.textContent?.trim() || commentEl.textContent?.trim() || "";
		if (commentText) {
			body = body ? `${body}\n\nComment: ${commentText}` : commentText;
		}
	}

	// Collect images from post/comment or clicked target
	const imagesSet = new Set<string>();
	if (srcUrl && srcUrl.startsWith("http") && !srcUrl.includes("styles.redditmedia.com/snoovatar")) {
		imagesSet.add(srcUrl);
	}

	const container = shredditPost || newRedditPost || oldRedditPost || document.body;
	const imgs = container.querySelectorAll<HTMLImageElement>("img");
	for (const img of imgs) {
		const src = img.src || img.getAttribute("src") || "";
		if (
			src &&
			src.startsWith("http") &&
			!src.includes("icon") &&
			!src.includes("avatar") &&
			!src.includes("snoovatar") &&
			!src.includes("emoji")
		) {
			imagesSet.add(src);
			if (imagesSet.size >= 4) break;
		}
	}

	const images = Array.from(imagesSet).slice(0, 4);
	const postText = [title, body].filter(Boolean).join("\n\n");
	const effectiveSelection = selection || title || body || "Reddit post discussion";

	const context: TweetContext = {
		selection: effectiveSelection.slice(0, 2000),
		tweet: postText || effectiveSelection,
		url,
		author,
		timestamp: timestamp || new Date().toISOString(),
		platform: "reddit",
		subreddit,
		...(images.length > 0 ? { images } : {}),
	};

	console.log("[Makoto] Extracted Reddit context:", context);
	return context;
}

chrome.runtime.onMessage.addListener((message) => {
	if (message.type !== "analyze" || !message.action) return;
	const context = extractRedditContext(message.action, message.srcUrl);
	chrome.runtime.sendMessage({
		type: "tweet-context",
		action: message.action,
		context,
	});
});
