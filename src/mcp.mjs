import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCountercheckMcpServer } from "./mcp-server.mjs";

const server = createCountercheckMcpServer();
await server.connect(new StdioServerTransport());
