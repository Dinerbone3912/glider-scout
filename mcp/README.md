# glider-scout MCP server

Exposes glider-scout as MCP tools so any MCP-capable agent can query the live bounty
feed and score bounty credibility. Zero dependencies, stdio JSON-RPC 2.0.

## Tools
- `list_bounties(limit)` — live spam-filtered bounties (free ≤3; >3 needs x402)
- `score_bounty(url)` — credibility verdict for a GitHub-issue bounty URL
- `feed_health()` — service health + payee address

## Add to an MCP client (e.g. Claude Desktop / Cursor)
```json
{
  "mcpServers": {
    "glider-scout": {
      "command": "node",
      "args": ["/absolute/path/to/glider-scout/mcp/server.mjs"],
      "env": { "GLIDER_BASE": "http://127.0.0.1:8787" }
    }
  }
}
```
Point `GLIDER_BASE` at any running glider-scout instance (local or public).

## Test
```bash
node test.mjs   # requires glider-scout server on :8787; 7/7 expected
```
