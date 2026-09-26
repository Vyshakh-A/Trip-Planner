import React from "react";

function DayTabs({ days, activeDay, onChange }) {
  return (
    <nav className="day-tabs" aria-label="Itinerary days">
      {days.map((day, index) => (
        <button
          key={`${day.label}-${index}`}
          type="button"
          className={index === activeDay ? "day-tab is-active" : "day-tab"}
          aria-current={index === activeDay ? "page" : undefined}
          onClick={() => onChange(index)}
        >
          <span className="day-tab-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="day-tab-content">
            <strong>{day.label}</strong>
            <small>
              {day.stops.length} {day.stops.length === 1 ? "stop" : "stops"}
            </small>
          </span>
        </button>
      ))}
    </nav>
  );
}

export default DayTabs;
