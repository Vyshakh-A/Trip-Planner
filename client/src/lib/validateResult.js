const CATEGORIES = new Set([
  "sightseeing",
  "food",
  "transport",
  "lodging",
  "activity",
  "rest",
  "other",
]);

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function warnUnexpectedFields(value, allowedFields, context) {
  if (!import.meta.env.DEV || !value || typeof value !== "object") return;

  const unexpectedFields = Object.keys(value).filter(
    (field) => !allowedFields.has(field),
  );
  if (unexpectedFields.length > 0) {
    console.warn(
      `Stripping unexpected field(s) from ${context}: ${unexpectedFields.join(", ")}`,
    );
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStop(stop, dayIndex, stopIndex) {
  if (!stop || typeof stop !== "object" || Array.isArray(stop)) {
    return {
      valid: false,
      error: `Stop ${stopIndex + 1} on day ${dayIndex + 1} is invalid.`,
    };
  }

  warnUnexpectedFields(
    stop,
    new Set([
      "name",
      "category",
      "time",
      "durationMinutes",
      "description",
      "location",
    ]),
    `stop ${stopIndex + 1} on day ${dayIndex + 1}`,
  );

  if (!isNonEmptyString(stop.name)) {
    return {
      valid: false,
      error: `Stop ${stopIndex + 1} on day ${dayIndex + 1} needs a name.`,
    };
  }

  if (!isNonEmptyString(stop.description)) {
    return {
      valid: false,
      error: `Stop ${stopIndex + 1} on day ${dayIndex + 1} needs a description.`,
    };
  }

  if (
    stop.time !== null &&
    (typeof stop.time !== "string" || !TIME_PATTERN.test(stop.time))
  ) {
    return {
      valid: false,
      error: `Stop ${stopIndex + 1} on day ${dayIndex + 1} has an invalid time.`,
    };
  }

  if (
    stop.durationMinutes !== null &&
    (typeof stop.durationMinutes !== "number" ||
      !Number.isFinite(stop.durationMinutes) ||
      stop.durationMinutes <= 0)
  ) {
    return {
      valid: false,
      error: `Stop ${stopIndex + 1} on day ${dayIndex + 1} has an invalid duration.`,
    };
  }

  return {
    valid: true,
    value: {
      name: stop.name.trim(),
      category: CATEGORIES.has(stop.category) ? stop.category : "other",
      time: stop.time,
      durationMinutes: stop.durationMinutes,
      description: stop.description.trim(),
      location:
        stop.location === null
          ? null
          : String(stop.location || "").trim() || null,
    },
  };
}

export function validateResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { valid: false, error: "The itinerary response was not an object." };
  }

  if (!isNonEmptyString(result.tripTitle)) {
    return { valid: false, error: "The itinerary is missing a title." };
  }

  if (!Array.isArray(result.days) || result.days.length === 0) {
    return { valid: false, error: "The itinerary did not contain any days." };
  }

  warnUnexpectedFields(result, new Set(["tripTitle", "days"]), "itinerary");

  const days = [];
  for (let dayIndex = 0; dayIndex < result.days.length; dayIndex += 1) {
    const day = result.days[dayIndex];
    if (
      !day ||
      typeof day !== "object" ||
      Array.isArray(day) ||
      !isNonEmptyString(day.label)
    ) {
      return { valid: false, error: `Day ${dayIndex + 1} is missing a label.` };
    }

    warnUnexpectedFields(
      day,
      new Set(["label", "stops"]),
      `day ${dayIndex + 1}`,
    );

    if (!Array.isArray(day.stops)) {
      return {
        valid: false,
        error: `Stops for day ${dayIndex + 1} must be an array.`,
      };
    }

    const stops = [];
    for (let stopIndex = 0; stopIndex < day.stops.length; stopIndex += 1) {
      const stopResult = validateStop(
        day.stops[stopIndex],
        dayIndex,
        stopIndex,
      );
      if (!stopResult.valid) return stopResult;
      stops.push(stopResult.value);
    }

    days.push({ label: day.label.trim(), stops });
  }

  return {
    valid: true,
    value: {
      tripTitle: result.tripTitle.trim(),
      days,
    },
  };
}

export { CATEGORIES };
