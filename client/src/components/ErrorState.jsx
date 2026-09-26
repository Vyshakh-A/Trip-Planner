import React from "react";

function ErrorState({ message, onRetry }) {
  return (
    <section
      className="status-panel error-panel"
      role="alert"
      aria-live="assertive"
    >
      <div className="error-symbol" aria-hidden="true">
        !
      </div>
      <div>
        <p className="status-kicker">The plan needs another pass</p>
        <h2>We couldn&apos;t build that itinerary.</h2>
        <p className="status-copy">
          {message || "Something went wrong while preparing your trip."}
        </p>
        <button type="button" className="secondary-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    </section>
  );
}

export default ErrorState;
