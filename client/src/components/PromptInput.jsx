import React from "react";


function PromptInput({ value, onChange, onSubmit, isLoading }) {
  return (
    <form className="prompt-form" onSubmit={onSubmit}>
      <label htmlFor="trip-description">Describe your trip</label>
      <div className="prompt-field">
        <textarea
          id="trip-description"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="A long weekend in Lisbon with great food, design, and time by the water"
          rows={4}
          maxLength={1000}
          disabled={isLoading}
          required
        />
        <div className="prompt-footer">
          <span>{value.length}/1000</span>
          <button type="submit" disabled={isLoading || !value.trim()}>
            {isLoading ? "Planning..." : "Generate itinerary"}
            <span aria-hidden="true">{isLoading ? "" : " ->"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}

export default PromptInput;
