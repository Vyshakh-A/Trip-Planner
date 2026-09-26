import React from "react";

function LoadingState({ message = "Building your itinerary" }) {
  return (
    <section
      className="status-panel loading-panel"
      role="status"
      aria-live="polite"
    >
      <span className="loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <div>
        <p className="status-kicker">One moment</p>
        <h2>{message}</h2>
        <p className="status-copy">
          Gathering places, pacing, and practical details.
        </p>
      </div>
    </section>
  );
}

export default LoadingState;
