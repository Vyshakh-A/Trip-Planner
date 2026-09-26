# Flam trip planner

## Local development

Copy `.env.example` to `.env` and add your server-only Gemini key:

```env
GEMINI_API_KEY=your_actual_key_here
```

From the `client` directory, install dependencies and start the app:

```bash
npm install && npm start
```

`npm start` runs Vite and the local Node API server together. Vite proxies
`/api/generate` to the local server, which imports the same handler used by the
Vercel deployment. The API server loads `GEMINI_API_KEY` from `.env` with
`dotenv`; no Vercel login or linked project is needed. `npm run dev` starts the
same two local processes. Keep the key in `.env`; without it, the app starts but
itinerary generation returns a configuration error.

## Production build

```bash
npm run build
```

## Deploy to Vercel

This project is ready for Vercel deployment with `client` as the project root.
Vercel serves the Vite build from `dist` and maps `api/generate.js` to
`/api/generate`. Set `GEMINI_API_KEY` in the Vercel project's Environment
Variables for the environments you deploy (Production and, if used, Preview).
Do not commit `.env`; it is only for local development. The local server in
`scripts/dev-server.js` is outside `api/`, so Vercel does not deploy it as an
extra function. No Vercel-specific configuration file is required for this
layout.

To publish, import the repository in the Vercel dashboard, set the Root
Directory to `client`, add the API key, and deploy. Publishing requires access
to a Vercel account; local startup does not.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
