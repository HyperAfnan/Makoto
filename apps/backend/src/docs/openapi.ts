export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Context API",
    version: "0.0.0",
    description: "Evidence-based context and claim analysis for X posts.",
  },
  servers: [{ url: "http://localhost:8787" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "Backend is healthy" } },
      },
    },
    "/api/context": {
      post: {
        summary: "Get context for selected tweet text",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AnalysisRequest" } } },
        },
        responses: {
          "200": {
            description: "SSE stream containing search and context analysis events",
            content: { "text/event-stream": {} },
          },
          "400": { description: "Invalid request" },
        },
      },
    },
    "/api/claim": {
      post: {
        summary: "Analyze a claim from selected tweet text",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AnalysisRequest" } } },
        },
        responses: {
          "200": {
            description: "SSE stream containing search and claim analysis events",
            content: { "text/event-stream": {} },
          },
          "400": { description: "Invalid request" },
        },
      },
    },
  },
  components: {
    schemas: {
      AnalysisRequest: {
        type: "object",
        required: ["selection", "tweet", "url", "author", "timestamp", "platform"],
        properties: {
          selection: { type: "string", maxLength: 2000 },
          tweet: { type: "string" },
          url: { type: "string", format: "uri" },
          author: { type: "string" },
          timestamp: { type: "string" },
          platform: { type: "string", enum: ["x"] },
        },
      },
    },
  },
} as const;
