import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler, defaultServerCallContextBuilder } from "@a2a-js/sdk/server";
import { Role } from "@a2a-js/sdk";

const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

function inputText(message) {
  return (message?.parts || []).map((part) => {
    if (part?.content?.$case === "text") return part.content.value;
    if (typeof part?.text === "string") return part.text;
    return "";
  }).join("\n").trim();
}

function resultMessage(value, contextId) {
  return {
    messageId: randomUUID(),
    contextId,
    taskId: "",
    role: Role.ROLE_AGENT,
    parts: [{ content: { $case: "text", value: JSON.stringify(value) }, metadata: undefined }],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: [],
  };
}

export function createReadOnlyA2AExecutor(actions) {
  return {
    async execute(requestContext, eventBus) {
      const command = inputText(requestContext.userMessage);
      let result;
      try {
        const action = actions[command];
        result = action
          ? await action()
          : { status: "unsupported_request", supportedRequests: Object.keys(actions) };
      } catch {
        result = { status: "unavailable", message: "The requested read-only Countercheck check is unavailable." };
      }
      eventBus.publish(AgentEvent.message(resultMessage(result, requestContext.contextId)));
      eventBus.finished();
    },
    async cancelTask() {},
  };
}

export function createA2AJsonRpcHandler({ cardPath, actions }) {
  const card = JSON.parse(readFileSync(cardPath, "utf8"));
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), createReadOnlyA2AExecutor(actions));
  const transport = new JsonRpcTransportHandler(requestHandler);
  const requestCounts = new Map();

  return async function handleA2A(request, response) {
    const now = Date.now();
    const key = request.socket.remoteAddress || "unknown";
    let usage = requestCounts.get(key);
    if (!usage || now - usage.startedAt >= RATE_WINDOW_MS) {
      usage = { startedAt: now, count: 0 };
      requestCounts.set(key, usage);
    }
    usage.count += 1;
    if (usage.count > RATE_LIMIT) {
      response.writeHead(429, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "rate_limited" }));
      return;
    }

    const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json" && contentType !== "application/a2a+json") {
      response.writeHead(415, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "unsupported_content_type" }));
      return;
    }

    const chunks = [];
    let bodyBytes = 0;
    try {
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        bodyBytes += bytes.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          response.writeHead(413, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: "request_too_large" }));
          return;
        }
        chunks.push(bytes);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const versionHeader = request.headers["a2a-version"];
      if (versionHeader !== "1.0") {
        response.writeHead(400, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "unsupported_a2a_version" }));
        return;
      }
      const context = defaultServerCallContextBuilder({
        headers: request.headers,
        extensions: undefined,
        user: undefined,
        requestedVersion: "1.0",
      });
      const result = await transport.handle(body, context);
      if (result && typeof result[Symbol.asyncIterator] === "function") {
        response.writeHead(501, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "streaming_not_supported" }));
        return;
      }
      response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" });
      response.end(JSON.stringify(result));
    } catch {
      if (!response.headersSent) response.writeHead(400, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "invalid_a2a_request" }));
    }
  };
}
