const MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function getApiKey() {
  const processObject = globalThis.process;
  if (processObject?.env?.GEMINI_API_KEY)
    return processObject.env.GEMINI_API_KEY;

  if (typeof processObject?.loadEnvFile === "function") {
    try {
      processObject.loadEnvFile(".env");
    } catch {
      return undefined;
    }
  }

  return processObject?.env?.GEMINI_API_KEY;
}

const itinerarySchema = {
  type: "object",
  // Tested against gemini-3.6-flash: this does not reliably block extra fields on this model; validateResult.js's strip logic is the actual enforcement layer, not this. Applies to the nested day and stop objects too.
  additionalProperties: false,
  properties: {
    tripTitle: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          stops: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                category: {
                  type: "string",
                  enum: [
                    "sightseeing",
                    "food",
                    "transport",
                    "lodging",
                    "activity",
                    "rest",
                    "other",
                  ],
                },
                time: { type: ["string", "null"] },
                durationMinutes: { type: ["number", "null"] },
                description: { type: "string" },
                location: { type: ["string", "null"] },
              },
              required: [
                "name",
                "category",
                "time",
                "durationMinutes",
                "description",
                "location",
              ],
            },
          },
        },
        required: ["label", "stops"],
      },
    },
  },
  required: ["tripTitle", "days"],
};

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function buildPrompt(prompt, validationError) {
  const correction = validationError
    ? `\nA previous response failed validation for this reason: ${validationError}. Correct that issue in this response.`
    : "";

  return `You are generating structured travel-planning data for an interactive itinerary UI.
Return only the itinerary object described by the response schema. Do not include prose, markdown, or commentary.
Create a practical day-by-day plan from the user's trip description. Use null when a time, duration, or location is genuinely unspecified. Use 24-hour HH:MM time strings when a time is known. Keep every stop description concise and useful. Include empty stops only for a legitimate rest day.
${correction}

User trip description:
${prompt}`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, {
      error: "Only POST requests are supported.",
    });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return sendJson(response, 500, {
      error: "The Gemini API key is not configured.",
    });
  }

  const { prompt, validationError } = request.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendJson(response, 400, {
      error: "A trip description is required.",
    });
  }

  try {
    const geminiResponse = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(prompt.trim(), validationError) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: itinerarySchema,
        },
      }),
    });

    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      const providerMessage =
        payload.error?.message || "Gemini could not generate the itinerary.";
      return sendJson(
        response,
        geminiResponse.status >= 500 ? 502 : geminiResponse.status,
        {
          error: providerMessage,
        },
      );
    }

    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== "string" || !rawText.trim()) {
      return sendJson(response, 502, {
        error: "Gemini returned an empty itinerary.",
      });
    }

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      return sendJson(response, 502, {
        error: "Gemini returned malformed itinerary JSON.",
      });
    }

    return sendJson(response, 200, { result });
  } catch {
    return sendJson(response, 502, {
      error: "The itinerary provider could not be reached.",
    });
  }
}
