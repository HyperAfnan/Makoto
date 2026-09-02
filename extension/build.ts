import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "build", "chrome-mv3-prod");
const apiUrl = process.env.CONTEXT_API_URL ?? "http://localhost:8787";

async function build() {
	await mkdir(join(out, "contents"), { recursive: true });

	// Copy static assets
	const assets = ["manifest.json", "sidepanel.html", "sidepanel.css", "options.html", "options.css"];
	for (const asset of assets) {
		await cp(join(root, "assets", asset), join(out, asset), { force: true });
	}

	// Bundle scripts using Bun.build
	const result = await Bun.build({
		entrypoints: [
			join(root, "src", "background.ts"),
			join(root, "src", "contents", "x.ts"),
			join(root, "src", "contents", "instagram.ts"),
			join(root, "src", "contents", "reddit.ts"),
			join(root, "src", "sidepanel.tsx"),
			join(root, "src", "options.ts"),
		],
		outdir: out,
		root: join(root, "src"),
		target: "browser",
		format: "esm",
		minify: process.env.NODE_ENV === "production",
		define: {
			"process.env.CONTEXT_API_URL": JSON.stringify(apiUrl),
			"process.env.PLASMO_PUBLIC_API_URL": JSON.stringify(apiUrl),
		},
	});

	if (!result.success) {
		console.error("Build failed:", result.logs);
		process.exit(1);
	}

	console.log(`Successfully built extension to ${out}`);
}

await build();

if (process.argv.includes("--watch")) {
	console.log("Watching for changes in src/ and assets/...");
	const chokidar = await import("node:fs");
	const watchDirs = [join(root, "src"), join(root, "assets")];
	for (const dir of watchDirs) {
		chokidar.watch(dir, { recursive: true }, async (_event, filename) => {
			if (!filename) return;
			console.log(`Change detected in ${filename}, rebuilding...`);
			try {
				await build();
			} catch (err) {
				console.error("Rebuild error:", err);
			}
		});
	}
}
