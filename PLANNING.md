# Flam Frontend Assignment — Planning Doc

**Project chosen:** Trip Planner
**Format:** free-form trip description → AI-generated day-by-day itinerary → interactive cards (expand, remove, reorder)
**Constraint:** must not read as a chatbot. Structured data in, real UI state out.

This doc is a working planning reference — questions we asked ourselves before writing code, and the decision made for each, with the reasoning. Update it as decisions change.

**AI tools & roles**
- Claude was used for planning and QA throughout the project.
- GitHub Copilot was used for debugging issues and errors, and for writing this document.

---

## 1. How do we get input without this looking like a chatbot?

**Q:** The spec requires one free-form text input. Doesn't that make it look like a chat box no matter what?

**A:** No — what makes something read as a chatbot is the *conversational loop* (scrolling message log, back-and-forth turns, replies rendered as chat bubbles), not the presence of a text field.

**Decision:**
- Input is a single form field ("Describe your trip"), submitted once via a button labeled **"Generate Itinerary"**, not "Send."
- On submit, the input does not get appended to a growing log. It collapses into a small, editable "trip brief" summary at the top of the itinerary view.
- Output is never printed back as text. It only ever becomes UI state (cards, days, tabs).

---

## 2. How do we handle the master prompt? How do we make output consistent across sections?

**Q:** LLMs drift across long, multi-section outputs (per-day, per-stop). How do we keep the schema uniform across an entire itinerary in one generation?

**A:** Three levers, ranked by actual impact:

1. **Structured output mode, not prompt-asking.** Use the provider's schema-constrained generation (OpenAI `strict` json_schema / tool calling, Gemini `responseSchema`, Ollama `format`) instead of "please return JSON only." Constrained decoding makes shape a decoding constraint, not a request the model can ignore. This is the single biggest lever.
2. **Closed vocabularies wherever possible.** `category` is an enum (`"sightseeing" | "food" | "transport" | "lodging" | "activity" | "other"`), not a free string — free strings are where inconsistency actually breaks the UI (icon/color lookups, filters).
3. **Low temperature + one worked example in the prompt + repeat the "strict JSON, matching this exact schema" instruction immediately before the schema** (recency bias — the last instruction has more pull than the first).

**Single call vs. decomposed calls (skeleton first, then per-day):**
- Single call: simpler, cheaper, one failure surface, but longer generations drift more per-field.
- Decomposed: better per-section consistency, but more round trips, more correlation logic across responses, more surface for stale/partial failures.

**Decision:** Single call + strict schema + enums + low temperature, given the 8-hour cap. Decomposition noted in the README as a "with more time" improvement, not built now.

---

## 3. How do we show the cards? (UI)

**Decision:**
- Days rendered as tabs (or a vertical stack if tab-state isn't worth the time).
- Stops inside a day rendered as a card list — a timeline/Trello-board visual vocabulary, never chat bubbles or a message feed.
- Each card colored/iconed by its `category` enum (same enum from Q2 — designed once, used twice: for generation consistency and for render consistency).
- Reorder via drag handle or up/down buttons (buttons are lower implementation risk for the same functional credit — pick based on time remaining).
- Expand-on-click for stop details (accordion or slide-over).
- Remove via a delete icon per card.

---

## 4. Adding a stop manually — should that call the AI?

**Q:** If the user manually adds a stop, is it better to still call the AI to "generate" it?

**A:** No. Principle: **call the AI only to fill a gap the user hasn't specified precisely. Never call it for data the user is handing you directly.** If the user already knows the name/time/category, that's a plain form write to local state — calling the AI here adds latency, cost, and a new failure surface for zero benefit.

**Decision — two distinct entry paths into the same stop array:**
- **"Add manually"** → small form matching the stop schema → direct state update. No network call.
- **"Suggest a stop"** → the only path that calls the AI after initial generation (see Q5).

---

## 5. If AI-adding a stop: how do we add "obvious" filler stops (food, etc.) vs. main stops?

**Q:** Main stops come from the initial generation. What about inserting something like lunch between two existing stops?

**Decision:**
- Initial generation call produces the **anchor stops** — what the trip description was actually about.
- A **mid-trip insert** call is scoped, not a repeat of full generation: send the AI the day's neighboring stops (what's before/after, the time gap) and ask for exactly **one** stop object in the same schema. Neighboring context prevents nonsense placement (e.g., another museum right after a museum instead of lunch).
- Before calling the AI, let the user narrow it with a small category select (Food / Activity / Rest / Transport / Surprise me) next to "Suggest a stop." This is the Q2 consistency trick applied at micro scale, and it reinforces "not a chatbot" — the user picks a structured option, not types a request.
- The single-stop AI response goes through the **exact same** validate → error/loading → render pipeline as the initial generation. No second bespoke path.

**Open decision:** stop schema needs a `dayIndex` (or equivalent) decided now — cross-day reordering (stretch goal) depends on it existing from the start.

---

## 6. Backend — what does "small backend to hold the API key" actually mean?

**Q:** Is this a full Node/Express module, or just a file?

**A:** Depends on the deploy target:

- **Serverless function** (Vercel/Netlify function, Cloudflare Worker) — closest to "just a file." The platform provides the HTTP server and routing; you export a handler from one file (matches the doc's `server/generate.ts`). Still needs `package.json` + `.env` for the key, but no `app.listen`, no server lifecycle to manage.
- **Small Express server** — needs `app.listen(port)` and CORS middleware (frontend dev server and backend are different origins), but can still be one `server.js` file: one route, one job.

**Decision:** Backend does exactly three things — hold the key, forward the prompt to the LLM, return the result. Shape validation can live here too (so malformed output never reaches the browser looking trustworthy). No controllers/services/models layering — that's over-engineering for this scope.

---

## 7. Database — do we need one?

**Q:** Do we need persistence?

**A:** No. No auth, no cross-device requirement in the core spec. The only place this comes up is the optional "save and reload sessions" stretch goal, and the cheapest correct answer there is **`localStorage`** — store the generated itinerary JSON keyed by an id, reload on return. Zero backend state, zero DB, zero auth.

**Decision:** No database. If persistence is attempted as a stretch goal, use `localStorage`, not a DB — a real DB only becomes justified by cross-device sync, which is explicitly out of scope.

---

## 8. Final stop JSON schema

```json
{
  "tripTitle": "string",
  "days": [
    {
      "label": "string (e.g. \"Day 1 — Arrival\")",
      "stops": [
        {
          "name": "string, required, non-empty",
          "category": "sightseeing | food | transport | lodging | activity | rest | other",
          "time": "string \"HH:MM\" (24h) or null if unspecified",
          "durationMinutes": "number | null",
          "description": "string, required, non-empty",
          "location": "string | null"
        }
      ]
    }
  ]
}
```

**`id` and `dayIndex` are NOT part of the AI-generated schema.**
- `id`: generate client-side (`crypto.randomUUID()`) right after parsing, one per stop. The LLM has no reason to produce stable/unique IDs.
- `dayIndex`: don't ask the model for it — it's redundant with array position (`days[i]`). Asking for it anyway means validating that it agrees with position, an extra self-consistency failure mode for no benefit. Derive it client-side when flattening for reorder logic.

**Validation rules (`validateResult.ts`):** `days` non-empty array; each day's `stops` is an array (empty allowed — a rest day is valid, don't fail on it); `name`/`description` non-empty strings; `category` in the fixed enum (reject or coerce to `other`); `time` matches `HH:MM` or is `null`; `durationMinutes` positive number or `null`.

**Empirical finding (tested against gemini-3.6-flash, real generation calls):** `additionalProperties: false`, correctly set at all three schema levels in proper JSON Schema format, does NOT reliably block extra fields — the model still emitted `id` on every stop despite the schema saying it shouldn't. Required fields, types, and enum values were all correctly enforced; only the "no extra fields" guarantee failed to hold. Conclusion: `additionalProperties: false` is kept in the schema (harmless, may help on other providers) but is not relied on. `validateResult.ts`'s allowlist-reconstruction (strip unknown fields) is the actual enforcement layer for this, not a defensive backstop on top of a working schema constraint. This is the accurate story to give if asked why validation still strips fields the schema was "supposed to" prevent.

## 9. Serverless function vs. small Express server

**Decision: serverless function (Vercel/Netlify), not standalone Express.**

If the API route lives under `/api` on the same deployment as the frontend, it's same-origin — no CORS middleware, no CORS debugging. A separately-deployed Express server (Render/Railway) is cross-origin from both the Vite dev server and the deployed frontend, needs `cors()` configured correctly in both environments, and free-tier hosts sleep/cold-start, which surfaces "slow response" handling more than wanted in a demo. Serverless also ships frontend + API as one deploy instead of two coordinated ones — matches the doc's "deployment preferred."

## 10. Drag-and-drop library vs. up/down buttons

**Decision: up/down buttons for the core submission; `dnd-kit` only as a stretch once everything else is solid.**

A real drag library (`@dnd-kit/core` — not `react-beautiful-dnd`, which is unmaintained) demos better but costs real hours (sensors, drag overlay, keyboard-accessible drag). Up/down buttons are array index swaps — correct in a few lines, no new dependency, keyboard-accessible for free. Simpler logic is also safer for the live "fix a bug / add a feature" interview stage. Per the doc's step 9: core solid first, then upgrade if time remains.

## 11. Retry policy on validation/transport failure

| Failure type | Automatic retry | Reasoning |
|---|---|---|
| Transport (timeout, 5xx, network) | 1 automatic retry, then manual "Try again" | Transient — likely to succeed unchanged on retry. |
| Validation (malformed/wrong shape) | 1 automatic retry, but only self-correcting — feed the validation error back into the next prompt | Retrying the identical prompt risks the identical failure, especially on weaker models. A conditioned retry is the only one worth automating. |
| Either, after 1 automatic retry | Stop — surface error state with manual retry | Caps total automatic attempts at 2; avoids the silent/unbounded retry loop the doc warns against. |

Manual retry after that point is unlimited.

## Still open / to decide before coding

- [ ] Exact wording of the master prompt (schema description + example + strict-JSON instruction)
- [ ] Whether "Suggest a stop" category picker ships in the core submission or as a stretch
- [ ] Time-string format edge cases (multi-day spans, overnight stops crossing midnight)