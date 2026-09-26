
const REQUEST_TIMEOUT_MS = 30000; // 30s

export class ApiError extends Error {
  constructor(message, { code = "request", retryable = false, status } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function getServerMessage(payload, fallback) {
  return payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

async function requestItinerary(prompt, validationError, signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const abortRequest = () => controller.abort();
  signal?.addEventListener("abort", abortRequest, { once: true });

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, validationError }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload;

    if (!responseText.trim()) {
      throw new ApiError("The server returned an empty response.", {
        code: "empty-response",
        retryable: true,
        status: response.status,
      });
    }

    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new ApiError("The server returned malformed JSON.", {
        code: "malformed-json",
        retryable: true,
        status: response.status,
      });
    }

    if (!response.ok) {
      throw new ApiError(
        getServerMessage(payload, "The itinerary request failed."),
        {
          code: "server-error",
          retryable: response.status >= 500 || response.status === 429,
          status: response.status,
        },
      );
    }

    return payload.result ?? payload;
  } catch (error) {
    if (signal?.aborted) {
      throw new ApiError("The itinerary request was cancelled.", {
        code: "aborted",
      });
    }

    if (controller.signal.aborted) {
      throw new ApiError("The itinerary request timed out.", {
        code: "timeout",
        retryable: true,
      });
    }

    if (error instanceof ApiError) throw error;

    throw new ApiError("The itinerary request could not reach the server.", {
      code: "network-error",
      retryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortRequest);
  }
}

export async function generateItinerary(
  prompt,
  { signal, validationError } = {},
) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new ApiError("Describe your trip before generating an itinerary.", {
      code: "invalid-input",
    });
  }

  let attempt = 0;
  while (attempt < 2) {
    try {
      return await requestItinerary(prompt.trim(), validationError, signal);
    } catch (error) {
      if (!error.retryable || attempt === 1 || signal?.aborted) throw error;
      attempt += 1;
    }
  }

  throw new ApiError("The itinerary request failed after retrying.", {
    code: "request-failed",
  });
}
