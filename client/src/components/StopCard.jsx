import { useState } from "react";

const CATEGORY_LABELS = {
  sightseeing: "Sightseeing",
  food: "Food",
  transport: "Transport",
  lodging: "Lodging",
  activity: "Activity",
  rest: "Rest",
  other: "Other",
};

function StopCard({ stop, index, total, onMoveUp, onMoveDown, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const categoryLabel = CATEGORY_LABELS[stop.category] || CATEGORY_LABELS.other;

  return (
    <article className={`stop-card category-${stop.category}`}>
      <div className="stop-card-marker" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="stop-card-main">
        <div className="stop-card-heading">
          <div>
            <div className="stop-meta">
              <span className="category-pill">{categoryLabel}</span>
              {stop.time && <span>{stop.time}</span>}
              {stop.durationMinutes && <span>{stop.durationMinutes} min</span>}
            </div>
            <h3>{stop.name}</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={
              isExpanded ? `Collapse ${stop.name}` : `Expand ${stop.name}`
            }
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((expanded) => !expanded)}
          >
            <span aria-hidden="true">{isExpanded ? "-" : "+"}</span>
          </button>
        </div>

        <p className="stop-summary">{stop.description}</p>

        {isExpanded && (
          <div className="stop-details">
            {stop.location && (
              <p>
                <span className="detail-label">Location</span>
                {stop.location}
              </p>
            )}
            <div className="stop-actions">
              <div
                className="reorder-actions"
                aria-label={`Reorder ${stop.name}`}
              >
                <button
                  type="button"
                  className="icon-button subtle"
                  onClick={onMoveUp}
                  disabled={index === 0}
                  aria-label={`Move ${stop.name} earlier`}
                >
                  <span aria-hidden="true">&#8593;</span>
                </button>
                <button
                  type="button"
                  className="icon-button subtle"
                  onClick={onMoveDown}
                  disabled={index === total - 1}
                  aria-label={`Move ${stop.name} later`}
                >
                  <span aria-hidden="true">&#8595;</span>
                </button>
              </div>
              <button
                type="button"
                className="remove-button"
                onClick={onRemove}
              >
                <span aria-hidden="true">&#215;</span>
                Remove stop
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default StopCard;
