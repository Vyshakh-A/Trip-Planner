# Itinerary Generation Call Flow

This document follows a trip request from the form in `src/App.jsx` to the
Gemini API and back to the itinerary UI.

## Flow at a glance

```text
PromptInput form
  -> App.handleSubmit
  -> App.generate
  -> generateItinerary (src/lib/api.js)
  -> requestItinerary
  -> POST /api/generate
  -> handler (api/generate.js)
  -> Gemini generateContent API
  <- structured itinerary JSON
  <- validateResult
  -> itinerary state and history
```

## Functions and responsibilities

### 1. Form submission: `src/components/PromptInput.jsx`

- **`PromptInput`** renders the trip-description form. Its form's `onSubmit`
  calls the `onSubmit` prop supplied by `App`; it does not call Gemini itself.
- **`App.handleSubmit(event)`** prevents the browser's default form submission,
  ignores a blank prompt, trims the text, and starts `App.generate`.

### 2. Client request: `src/App.jsx` and `src/lib/api.js`

- **`App.generate(promptValue, validationError)`** starts a loading state,
  aborts any previous request, and creates an `AbortController`. It calls
  `generateItinerary` with the prompt, abort signal, and optional validation
  feedback. When a result returns, it checks that the request is still current
  and passes the result to `validateResult`.
- **`generateItinerary(prompt, options)`** rejects an empty prompt and retries
  one time if the request fails with a retryable error. It delegates each
  attempt to `requestItinerary`.
- **`requestItinerary(prompt, validationError, signal)`** sends a JSON `POST`
  to `/api/generate` with the prompt and optional validation feedback. It
  applies the 30-second timeout, connects the caller's abort signal, parses the
  response, and converts network, timeout, cancellation, empty-response,
  malformed-JSON, and server failures into `ApiError` values.
- **`getServerMessage(payload, fallback)`** uses the server's error message
  when available, otherwise it supplies a fallback message.
- **`ApiError`** carries a stable error `code`, whether the error is
  `retryable`, and an optional HTTP status. This lets the client decide whether
  to retry and the UI display an error.

### 3. Serverless endpoint: `api/generate.js`

The `/api/generate` route is handled by the default exported **`handler(request,
response)`** in `api/generate.js` for Vercel deployments. Local development
imports that same handler through `scripts/dev-server.js`.

#### How the handler is hosted

Vercel uses file-based serverless routing in production: with `client` as the
project root, it maps `api/generate.js` to `/api/generate` and invokes the
exported handler for each request. Locally, `scripts/dev-server.js` imports that
same handler and mounts it at `/api/generate` using Node's HTTP server. It is
kept outside `api/` so Vercel does not discover it as a deployment function.
Vite's proxy forwards browser requests from the frontend to this local endpoint. The
`npm start` and `npm run dev` scripts start Vite and the local API server
together, without requiring a Vercel account or linked project. The local API
server loads `GEMINI_API_KEY` from `.env` using `dotenv`; deployment continues
to use the server-side environment variable configured in Vercel.

- **`handler`** accepts only `POST`, checks that the API key and prompt are
  present, then sends a request to Gemini. It returns Gemini failures as JSON
  errors, parses the generated itinerary JSON, and responds with
  `{ result: ... }` on success.
- **`getApiKey()`** reads `GEMINI_API_KEY` from the server environment. During
  local development it attempts to load `.env` if needed. The key stays on the
  server and is not sent by the browser.
- **`buildPrompt(prompt, validationError)`** combines the user's trip request
  with instructions to produce a practical itinerary. If validation feedback
  is supplied, it asks Gemini to correct that issue in its new response.
- **`sendJson(response, status, body)`** sends a JSON response with the given
  HTTP status.
- **`itinerarySchema`** is the JSON schema sent in Gemini's generation config.
  It defines the required trip, day, and stop fields and allowed categories.

### 4. Gemini request and response

The handler posts to the `generateContent` endpoint for the configured
`gemini-3.6-flash` model. It sends `buildPrompt(...)` as user content, asks for
`application/json`, supplies `itinerarySchema`, and uses a low temperature
(`0.2`). Gemini's text response is parsed as JSON. The handler then returns
`{ result }` to the browser.

### 5. Validation and rendering: `src/lib/validateResult.js` and `src/App.jsx`

- **`validateResult(result)`** checks that the response has a title and at
  least one day, then validates and normalizes each day and stop.
- **`validateStop(stop, dayIndex, stopIndex)`** checks each stop's required
  text and time/duration values, normalizes its fields, and changes unknown
  categories to `other`.
- **`isNonEmptyString(value)`** checks required text fields.
- **`warnUnexpectedFields(value, allowedFields, context)`** warns in development
  about extra fields, which validation strips from its returned value.
- If validation fails, **`App.generate`** makes one correction request by
  calling itself with the validation error. That feedback travels through
  `generateItinerary` and `requestItinerary` to `buildPrompt`, then back to
  Gemini. If the corrected result is still invalid, the app shows an error.
- **`createStopId()`** creates client-side IDs; **`addClientIds(itinerary)`**
  adds an ID to each stop after validation. The model does not generate these
  IDs.
- On success, **`App.generate`** saves the itinerary in React state and local
  history, then marks the app as ready for the itinerary view.

## Error and retry behavior

There are two separate retry paths:

1. **Request retry:** `generateItinerary` retries once for retryable transport
   or server errors, such as a timeout, network failure, server error, or HTTP
   429 response.
2. **Output correction:** `App.generate` asks Gemini once more if the response
   came back successfully but failed client-side itinerary validation. The
   validation message is included in the second request's prompt.

Non-retryable server errors and user cancellation return to `App.generate`'s
error handling without starting another request.
