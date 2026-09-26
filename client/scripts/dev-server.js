import "dotenv/config";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import process from "node:process";
import handler from "../api/generate.js";

const port = Number(process.env.API_PORT || 3001);
const apiPath = "/api/generate";

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function createResponseAdapter(response) {
  return {
    setHeader: response.setHeader.bind(response),
    status(status) {
      response.statusCode = status;
      return this;
    },
    json(body) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(body));
    },
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url || "/", "http://localhost").pathname;
  if (requestPath !== apiPath) {
    return sendJson(response, 404, { error: "Not found." });
  }

  let body = {};
  if (request.method === "POST") {
    try {
      body = await readJsonBody(request);
    } catch {
      return sendJson(response, 400, {
        error: "Request body must be valid JSON.",
      });
    }
  }

  try {
    await handler(
      { method: request.method, body },
      createResponseAdapter(response),
    );
  } catch {
    if (!response.headersSent) {
      sendJson(response, 500, { error: "The local API server failed." });
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local API listening at http://127.0.0.1:${port}${apiPath}`);
});
