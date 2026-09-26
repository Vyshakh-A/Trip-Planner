import { useEffect, useRef, useState } from "react";
import ErrorState from "./components/ErrorState";
import ItineraryView from "./components/ItineraryView";
import LoadingState from "./components/LoadingState";
import PromptInput from "./components/PromptInput";
import { generateItinerary } from "./lib/api";
import { validateResult } from "./lib/validateResult";
import "./App.css";

const HISTORY_KEY = "flam-trip-history";

function createStopId() {
  return (
    globalThis.crypto?.randomUUID?.() || `stop-${Date.now()}-${Math.random()}`
  );
}

function readHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    return undefined;
  }
}

function addClientIds(itinerary) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({ ...stop, id: createStopId() })),
    })),
  };
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [tripBrief, setTripBrief] = useState("");
  const [itinerary, setItinerary] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);
  const [history, setHistory] = useState(readHistory);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const requestId = useRef(0);
  const abortController = useRef(null);
  const suggestionAbortController = useRef(null);

  useEffect(
    () => () => {
      abortController.current?.abort();
      suggestionAbortController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    writeHistory(history);
  }, [history]);

  async function generate(promptValue, validationError = "") {
    const id = ++requestId.current;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setStatus("loading");
    setError(null);

    try {
      const rawResult = await generateItinerary(promptValue, {
        signal: controller.signal,
        validationError,
      });
      if (id !== requestId.current) return;

      const checkedResult = validateResult(rawResult);
      if (!checkedResult.valid && !validationError) {
        await generate(promptValue, checkedResult.error);
        return;
      }
      if (!checkedResult.valid) {
        throw new Error(checkedResult.error);
      }

      const nextItinerary = addClientIds(checkedResult.value);
      // console.log("LLM plan output", nextItinerary);
      const historyEntry = {
        id: createStopId(),
        prompt: promptValue,
        itinerary: nextItinerary,
        savedAt: new Date().toISOString(),
      };
      setItinerary(nextItinerary);
      setTripBrief(promptValue);
      setActiveHistoryId(historyEntry.id);
      setHistory((currentHistory) =>
        [
          historyEntry,
          ...currentHistory.filter((entry) => entry.prompt !== promptValue),
        ].slice(0, 12),
      );
      setStatus("ready");
    } catch (caughtError) {
      if (id !== requestId.current) return;
      if (caughtError?.code === "aborted") return;
      console.log("[flam] itinerary request failed", {
        code: caughtError?.code || "unknown",
        message: caughtError?.message || "We could not prepare your itinerary.",
      });
      setError(caughtError?.message || "We could not prepare your itinerary.");
      setStatus("error");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!prompt.trim()) return;
    void generate(prompt.trim());
  }

  function startNewTrip() {
    abortController.current?.abort();
    suggestionAbortController.current?.abort();
    suggestionAbortController.current = null;
    requestId.current += 1;
    setItinerary(null);
    setTripBrief("");
    setError(null);
    setStatus("idle");
    setIsSuggesting(false);
    setSuggestionError(null);
    setPrompt("");
    setActiveHistoryId(null);
  }

  function openHistoryEntry(entry) {
    abortController.current?.abort();
    suggestionAbortController.current?.abort();
    suggestionAbortController.current = null;
    requestId.current += 1;
    setItinerary(entry.itinerary);
    setTripBrief(entry.prompt);
    setActiveHistoryId(entry.id);
    setError(null);
    setStatus("ready");
    setIsSuggesting(false);
    setSuggestionError(null);
  }

  function handleItineraryChange(nextItinerary) {
    const updateItinerary =
      typeof nextItinerary === "function" ? nextItinerary : () => nextItinerary;
    setItinerary(updateItinerary);
    setHistory((currentHistory) =>
      currentHistory.map((entry) =>
        entry.id === activeHistoryId
          ? { ...entry, itinerary: updateItinerary(entry.itinerary) }
          : entry,
      ),
    );
  }

  async function suggestStop(dayIndex, category) {
    const day = itinerary?.days[dayIndex];
    if (!day || isSuggesting) return;

    const controller = new AbortController();
    suggestionAbortController.current = controller;
    setIsSuggesting(true);
    setSuggestionError(null);

    const existingStops =
      day.stops.map((stop) => `${stop.name} (${stop.category})`).join(", ") ||
      "None";
    const requestedCategory =
      category === "other" ? "Choose the best-fitting category" : category;
    const suggestionPrompt = [
      `Original trip description: ${tripBrief}`,
      `Selected day: ${day.label}`,
      `Requested stop category: ${requestedCategory}`,
      `Stops already planned for this day: ${existingStops}`,
      "Suggest exactly one additional stop that fits this day. Do not repeat an existing stop.",
      "Return the normal itinerary JSON structure with this day and exactly one stop in its stops array.",
    ].join("\n");

    try {
      const rawResult = await generateItinerary(suggestionPrompt, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const checkedResult = validateResult(rawResult);
      if (!checkedResult.valid) throw new Error(checkedResult.error);

      const suggestedStop = checkedResult.value.days.flatMap(
        (suggestedDay) => suggestedDay.stops,
      )[0];
      if (!suggestedStop) {
        throw new Error("No stop was returned. Please try again.");
      }

      const stopWithId = { ...suggestedStop, id: createStopId() };
      handleItineraryChange((currentItinerary) => ({
        ...currentItinerary,
        days: currentItinerary.days.map((currentDay, index) =>
          index === dayIndex
            ? { ...currentDay, stops: [...currentDay.stops, stopWithId] }
            : currentDay,
        ),
      }));
    } catch (caughtError) {
      if (!controller.signal.aborted && caughtError?.code !== "aborted") {
        setSuggestionError(
          caughtError?.message ||
            "We could not suggest a stop. Please try again.",
        );
      }
    } finally {
      if (suggestionAbortController.current === controller) {
        suggestionAbortController.current = null;
        setIsSuggesting(false);
      }
    }
  }

  function formatHistoryDate(savedAt) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(savedAt));
  }

  const isLoading = status === "loading";

  return (
    <main className="app-shell">
      <header className="site-header">
        <button type="button" className="brand" onClick={startNewTrip}>
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>flam</span>
        </button>
        <span className="header-note">AI trip planning, made tangible</span>
      </header>

      {status === "idle" && (
        <section className="landing-view">
          <div className="eyebrow">
            <span /> Plan a trip worth remembering
          </div>
          <h1>
            Go somewhere
            <br />
            <em>with intention.</em>
          </h1>
          <p className="landing-copy">
            Turn a loose idea into a day-by-day route with room for the places
            you discover along the way.
          </p>
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
          <div className="landing-footnote">
            <span>STRUCTURED PLANS</span>
            <span>YOUR TRIP, YOUR EDITS</span>
            <span>NO CHAT WINDOW</span>
          </div>
          {history.length > 0 && (
            <section
              className="history-section"
              aria-labelledby="history-title"
            >
              <div className="history-heading">
                <div>
                  <p className="status-kicker">Your saved routes</p>
                  <h2 id="history-title">History</h2>
                </div>
                <span>
                  {history.length} {history.length === 1 ? "trip" : "trips"}
                </span>
              </div>
              <div className="history-list">
                {history.map((entry) => {
                  const stopCount = entry.itinerary.days.reduce(
                    (total, day) => total + day.stops.length,
                    0,
                  );
                  return (
                    <button
                      type="button"
                      className="history-entry"
                      key={entry.id}
                      onClick={() => openHistoryEntry(entry)}
                    >
                      <span className="history-entry-arrow" aria-hidden="true">
                        ↗
                      </span>
                      <span className="history-entry-copy">
                        <strong>{entry.itinerary.tripTitle}</strong>
                        <small>{entry.prompt}</small>
                      </span>
                      <span className="history-entry-meta">
                        <span>
                          {entry.itinerary.days.length} days · {stopCount} stops
                        </span>
                        <span>{formatHistoryDate(entry.savedAt)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </section>
      )}

      {isLoading && (
        <section className="content-wrap">
          <LoadingState />
        </section>
      )}

      {status === "error" && (
        <section className="content-wrap">
          <ErrorState
            message={error}
            onRetry={() => void generate(tripBrief || prompt)}
          />
        </section>
      )}

      {status === "ready" && itinerary && (
        <section className="content-wrap">
          <div className="trip-brief">
            <span className="brief-label">TRIP BRIEF</span>
            <p>{tripBrief}</p>
            <button type="button" onClick={startNewTrip}>
              Edit
            </button>
          </div>
          <ItineraryView
            itinerary={itinerary}
            onChange={handleItineraryChange}
            onSuggestStop={suggestStop}
            isSuggesting={isSuggesting}
            suggestionError={suggestionError}
          />
        </section>
      )}
    </main>
  );
}

export default App;
