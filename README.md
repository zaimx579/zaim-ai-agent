# ZAIM AI Agent — Starter Architecture

Arabic-first chat UI for a hybrid cloud + local agent.

## Architecture

- `public/index.html`: Arabic RTL chat UI and Settings dialog.
- `server.js`: Node.js API gateway. Calls OpenRouter server-side and does not log API keys.
- `local-agent.js`: optional local computer agent on the user's own machine. It exposes a small, authenticated API for listing/reading/writing files in a dedicated workspace and running a conservative set of commands.
- `workspace/`: isolated working directory for local projects.

## Requirements

- Node.js 20+
- An OpenRouter API key
- Internet connection for model calls
- Optional local computer execution: run `local-agent.js` on the computer where files/build tools should be accessed.

## Run the chat gateway

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

Enter your OpenRouter API key in Settings. The browser keeps it in localStorage for convenience; this is acceptable only for a personal local prototype, not a public/shared deployment. For a production cloud deployment, use a server-side secret manager and remove browser key entry.

## Run the local agent (optional)

In another terminal:

```bash
npm run local-agent
```

Copy the local-agent token printed on first run into Settings > Local computer agent URL/token. Keep it bound to `127.0.0.1`; do not expose it to the public internet.

## Important limitations in this starter

This is a secure-oriented foundation, not a fully autonomous coding agent yet. It provides the chat, OpenRouter connection, and a restricted local workspace bridge. It does not yet install Android SDKs automatically, control a graphical desktop, or guarantee APK builds. Those require additional sandboxed workers, explicit permissions, and browser/emulator integration.

Before allowing real command execution, keep commands allowlisted and require approval for installs, destructive changes, network downloads, publishing, or access outside the workspace.
