import { useState } from "react";
import DayTabs from "./DayTabs";
import StopCard from "./StopCard";

const EMPTY_STOP = {
  name: "",
  category: "sightseeing",
  time: "",
  durationMinutes: "",
  description: "",
  location: "",
};

function createStopId() {
  return (
    globalThis.crypto?.randomUUID?.() || `stop-${Date.now()}-${Math.random()}`
  );
}

function ItineraryView({
  itinerary,
  onChange,
  onSuggestStop,
  isSuggesting,
  suggestionError,
}) {
  const [activeDay, setActiveDay] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [manualStop, setManualStop] = useState(EMPTY_STOP);
  const [suggestCategory, setSuggestCategory] = useState("food");

  const day = itinerary.days[activeDay] || itinerary.days[0];
  const dayIndex = itinerary.days.indexOf(day);

  function updateDayStops(nextStops) {
    onChange({
      ...itinerary,
      days: itinerary.days.map((currentDay, index) =>
        index === dayIndex ? { ...currentDay, stops: nextStops } : currentDay,
      ),
    });
  }

  function moveStop(index, offset) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= day.stops.length) return;

    const nextStops = [...day.stops];
    [nextStops[index], nextStops[nextIndex]] = [
      nextStops[nextIndex],
      nextStops[index],
    ];
    updateDayStops(nextStops);
  }

  function removeStop(stopIndex) {
    updateDayStops(day.stops.filter((_, index) => index !== stopIndex));
  }

  function submitManualStop(event) {
    event.preventDefault();
    if (!manualStop.name.trim() || !manualStop.description.trim()) return;

    updateDayStops([
      ...day.stops,
      {
        id: createStopId(),
        name: manualStop.name.trim(),
        category: manualStop.category,
        time: manualStop.time || null,
        durationMinutes: manualStop.durationMinutes
          ? Number(manualStop.durationMinutes)
          : null,
        description: manualStop.description.trim(),
        location: manualStop.location.trim() || null,
      },
    ]);
    setManualStop(EMPTY_STOP);
    setIsAdding(false);
  }

  function updateManualStop(field, value) {
    setManualStop((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="itinerary-view" aria-label="Generated itinerary">
      <div className="itinerary-heading">
        <div>
          <p className="status-kicker">Your route is ready</p>
          <h1>{itinerary.tripTitle}</h1>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setIsAdding((adding) => !adding)}
        >
          {isAdding ? "Close form" : "+ Add a stop"}
        </button>
      </div>

      {isAdding && (
        <form className="manual-stop-form" onSubmit={submitManualStop}>
          <div className="form-heading">
            <div>
              <p className="status-kicker">Add to {day.label}</p>
              <h2>Know somewhere worth a stop?</h2>
            </div>
          </div>
          <div className="manual-grid">
            <label>
              Stop name
              <input
                value={manualStop.name}
                onChange={(event) =>
                  updateManualStop("name", event.target.value)
                }
                required
              />
            </label>
            <label>
              Category
              <select
                value={manualStop.category}
                onChange={(event) =>
                  updateManualStop("category", event.target.value)
                }
              >
                <option value="sightseeing">Sightseeing</option>
                <option value="food">Food</option>
                <option value="transport">Transport</option>
                <option value="lodging">Lodging</option>
                <option value="activity">Activity</option>
                <option value="rest">Rest</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Time
              <input
                type="time"
                value={manualStop.time}
                onChange={(event) =>
                  updateManualStop("time", event.target.value)
                }
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                value={manualStop.durationMinutes}
                onChange={(event) =>
                  updateManualStop("durationMinutes", event.target.value)
                }
              />
            </label>
            <label>
              Location
              <input
                value={manualStop.location}
                onChange={(event) =>
                  updateManualStop("location", event.target.value)
                }
              />
            </label>
            <label className="full-width-field">
              Description
              <textarea
                rows="3"
                value={manualStop.description}
                onChange={(event) =>
                  updateManualStop("description", event.target.value)
                }
                required
              />
            </label>
          </div>
          <button type="submit" className="primary-button">
            Add stop
          </button>
        </form>
      )}

      <DayTabs
        days={itinerary.days}
        activeDay={dayIndex}
        onChange={setActiveDay}
      />

      <div className="day-heading">
        <div>
          <p className="status-kicker">Day {dayIndex + 1}</p>
          <h2>{day.label}</h2>
        </div>
        <div className="suggest-controls">
          <select
            value={suggestCategory}
            onChange={(event) => setSuggestCategory(event.target.value)}
            aria-label="Suggested stop category"
            disabled={isSuggesting}
          >
            <option value="food">Food</option>
            <option value="activity">Activity</option>
            <option value="rest">Rest</option>
            <option value="transport">Transport</option>
            <option value="other">Surprise me</option>
          </select>
          <button
            type="button"
            className="suggest-button"
            onClick={() => onSuggestStop?.(dayIndex, suggestCategory)}
            disabled={!onSuggestStop || isSuggesting}
          >
            {isSuggesting ? "Finding..." : "Suggest a stop"}
          </button>
        </div>
      </div>
      {suggestionError && (
        <p className="suggestion-error" role="alert">
          {suggestionError}
        </p>
      )}

      {day.stops.length > 0 ? (
        <div className="stop-list">
          {day.stops.map((stop, index) => (
            <StopCard
              key={stop.id || `${stop.name}-${index}`}
              stop={stop}
              index={index}
              total={day.stops.length}
              onMoveUp={() => moveStop(index, -1)}
              onMoveDown={() => moveStop(index, 1)}
              onRemove={() => removeStop(index)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-day">
          <span className="empty-day-icon" aria-hidden="true">
            +
          </span>
          <h3>A slower day by design</h3>
          <p>
            Add a stop manually or ask for a suggestion when you feel like
            exploring.
          </p>
        </div>
      )}
    </section>
  );
}

export default ItineraryView;
