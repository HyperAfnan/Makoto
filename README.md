# Makoto

Evidence-based analysis and claim verification for X.

## Setup

Requires Node 22+ and a network connection for the first install.

Run commands independently per project:

```bash
bun install --cwd backend
bun run --cwd backend typecheck
bun run --cwd backend test

bun install --cwd extension
bun run --cwd extension build
```

Start the backend:

```bash
bun --cwd backend dev
```

Start the extension in another terminal:

```bash
bun --cwd extension dev
```

Load `extension/build/chrome-mv3-prod` in Chrome, open `https://x.com`, select tweet text, and use either context-menu action. The panel shows the summary, verdict, evidence strength, and clickable sources.

The backend performs search and streams Week 3 analysis events. Open the extension Options page to configure provider keys; without them, the API returns explicit deterministic fallbacks.

Swagger API documentation is available at `http://localhost:8787/api-docs` when `SWAGGER_ENABLED=true`.

Build a Chrome package:

```bash
bun --cwd extension package
```

For Docker deployment and the beta checklist, see [`docs/deployment.md`](docs/deployment.md) and [`docs/beta-checklist.md`](docs/beta-checklist.md).

## Search

Configure a search provider and its key in the extension Options page. The API searches up to three rounds, runs two queries in parallel per round, normalizes results, and removes duplicate URLs.
