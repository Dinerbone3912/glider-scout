#!/usr/bin/env node
// Minimal zero-dependency MCP server (stdio, JSON-RPC 2.0) exposing glider-scout as tools.
// Any MCP-capable agent can call: list_bounties, score_bounty, feed_health.
// Talks to the local glider-scout server (default http://127.0.0.1:8787) or a base URL via env.
import { createInterface } from 'node:readline';

const BASE = process.env.GLIDER_BASE || 'http://127.0.0.1:8787';

const TOOLS = [
  {
    name: 'list_bounties',
    description: 'List live, spam-filtered crypto/dev bounties. Free up to 3; more requires an x402-paid plan.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 5 } },
    },
  },
  {
    name: 'score_bounty',
    description: 'Score the credibility of a GitHub issue URL used as a bounty (detects fake/scam listings).',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'GitHub issue URL' } },
      required: ['url'],
    },
  },
  {
    name: 'feed_health',
    description: 'Get glider-scout service health and payee address.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name, args) {
  const enc = encodeURIComponent;
  if (name === 'list_bounties') {
    const lim = Math.max(1, Math.min(50, args?.limit ?? 5));
    const r = await fetch(`${BASE}/bounties?limit=${lim}`, { headers: { 'bypass-tunnel-reminder': '1' } });
    if (r.status === 402) {
      const info = await r.json();
      return { content: [{ type: 'text', text: `Paid tier required: ${JSON.stringify(info.accepts?.[0] ?? info)}. Free teaser: try limit<=3.` }], isError: true };
    }
    const j = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(j) }] };
  }
  if (name === 'score_bounty') {
    if (!args?.url) return { content: [{ type: 'text', text: 'url is required' }], isError: true };
    const r = await fetch(`${BASE}/score?url=${enc(args.url)}`, { headers: { 'bypass-tunnel-reminder': '1' } });
    const j = await r.json();
    return { content: [{ type: 'text', text: JSON.stringify(j) }], isError: !r.ok };
  }
  if (name === 'feed_health') {
    const r = await fetch(`${BASE}/health`, { headers: { 'bypass-tunnel-reminder': '1' } });
    return { content: [{ type: 'text', text: JSON.stringify(await r.json()) }] };
  }
  return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  line = line.trim(); if (!line) return;
  let req; try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'glider-scout', version: '1.0.0' } } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const out = await callTool(params?.name, params?.arguments ?? {});
      send({ jsonrpc: '2.0', id, result: out });
    } else if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      // no response needed
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } });
  }
});
process.stderr.write(`glider-scout MCP server on stdio (base=${BASE})\n`);
