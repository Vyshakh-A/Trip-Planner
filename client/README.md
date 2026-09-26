# Trip Planner

 A free-form trip description into a day-by-day itinerary you can edit. It is an interactive planning tool, not a chatbot: generated JSON is validated and rendered as day tabs and stop cards rather than shown as a conversation.

## Features

- Generate structured itineraries with Gemini using a schema-constrained JSON response.
- Browse days and expand stop cards to see location details.
- Reorder or remove stops; add a stop manually without an AI request, or ask Gemini to suggest one for a selected day and category.
- Save up to 12 trips in this browser's local storage and reopen them later.
- Show loading, empty-day, and error states. Requests time out after 30 seconds and retry once for transient failures. Invalid generated data gets one correction attempt before an error is shown.

## Run locally

Requirements: Node.js and npm, plus a Gemini API key.

From the `client` directory, copy `.env.example` to `.env` and set the key:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Then install dependencies and start the frontend and local API server:

```bash
npm install
npm start
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The Vite development server proxies `/api/generate` to the Node API server. The server loads the key from `.env`; the key is not included in browser code. Keep `.env` private and do not commit it. Generation will return a configuration error if the key is missing.

## Scripts

```bash
npm start       # Start Vite and the local API server
npm run build   # Create the production frontend build in dist/
npm run preview # Preview the production build locally
npm run lint    # Run ESLint
```

## How it works

The browser sends the trip description to `/api/generate`. The server-side handler in `api/generate.js` calls Gemini and requests this shape:

```json
{
  "tripTitle": "string",
  "days": [
    {
      "label": "string",
      "stops": [
        {
          "name": "string",
          "category": "sightseeing | food | transport | lodging | activity | rest | other",
          "time": "HH:MM or null",
          "durationMinutes": "number or null",
          "description": "string",
          "location": "string or null"
        }
      ]
    }
  ]
}
```

`src/lib/validateResult.js` checks the response before it reaches the itinerary UI. Stop IDs are assigned by the client. A malformed or invalid response is never rendered as if it were a valid plan.

## Deploy to Vercel

Use `client` as the Vercel project root. Set `GEMINI_API_KEY` in the project's environment variables for each environment you deploy, then deploy. Vercel serves the Vite build and the `api/generate.js` serverless function from the same project. Local development does not require a Vercel account.

## Known limitations

- AI-generated routes can contain inaccurate or outdated travel information. Check opening hours, transit details, and venue availability before relying on a plan.
- Suggested stops are added to the end of the selected day; the app does not automatically choose a precise insertion point or reorder stops across days.
- Trip history is stored only in the current browser. Clearing site data or changing browsers removes access to those saved trips.
- The app does not provide accounts, cloud sync, maps, bookings, live availability, or streaming generation.
- A Gemini API key is required for generation; provider quotas and availability apply.


## Planning & design decisions

See [`../PLANNING.md`](../PLANNING.md) for the design questions considered before writing code — input UX vs. chatbot behavior, prompt/schema consistency, the manual-vs-AI stop decision, the JSON schema, and the retry policy, including the tested finding that `additionalProperties: false` doesn't reliably hold on gemini-3.6-flash.

## AI assistance

- Claude was used for planning and QA throughout the project.
- GitHub Copilot was used for debugging issues and errors, and for writing this document.