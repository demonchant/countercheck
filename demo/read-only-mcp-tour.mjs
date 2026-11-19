import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCountercheckMcpServer } from "../src/mcp-server.mjs";

const server = createCountercheckMcpServer();
const client = new Client({ name: "countercheck-read-only-tour", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  const results = {};
  for (const name of ["verify_counterparties", "request_purchase_quote"]) {
    if (!tools.some((tool) => tool.name === name)) throw new Error("A configured read-only MCP tool is missing.");
    const result = await client.callTool({ name, arguments: {} });
    const value = JSON.parse(result.content?.[0]?.text || "{}");
    results[name] = {
      status: value.status,
      paymentMicroCcd: value.payment?.amountMicroCcd,
      asset: value.payment?.asset,
      note: "Read-only result; MCP cannot approve, sign, or submit a payment.",
    };
  }
  console.log(JSON.stringify({ availableTools: tools.map((tool) => tool.name), results }, null, 2));
} catch {
  console.error("Read-only MCP tour failed. Check Testnet Registry and seller availability.");
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
  await server.close().catch(() => {});
}
