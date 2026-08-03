# Deployment

## Local Docker

Copy `apps/backend/.env.example` to `apps/backend/.env`, then run:

```bash
docker compose up --build
```

The backend is exposed on port `8787` and Redis on `6379`. Verify with:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/api-docs.json
```

Do not commit `.env` or expose API keys in logs.

## Hosted backend

Provide operational environment variables to the backend container and set `REDIS_URL` to the hosted Redis instance. Configure provider keys in the extension Options page. Put the backend behind HTTPS before beta use.

Update `apps/extension/assets/manifest.json` to allow the deployed backend origin, then build with `CONTEXT_API_URL` set:

```bash
CONTEXT_API_URL=https://api.example.com bun run --cwd apps/extension package
```

Upload `apps/extension/build/context-chrome.zip` as a private Chrome Web Store item or load the unpacked `chrome-mv3-prod` directory during development.
