/**
 * Smoke test: spawns the server over stdio, performs the MCP handshake, lists tools and calls each
 * one against the live API. Run with `npm run smoke`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: process.execPath, args: [join(here, 'index.js')] });
const client = new Client({ name: 'smoke', version: '1.0.0' });

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

await client.connect(transport);
console.log('connected\n');

const { tools } = await client.listTools();
check('tools/list returns 3 tools', tools.length === 3, tools.map((t) => t.name).join(', '));

const leagues = await client.callTool({ name: 'list_leagues', arguments: {} });
const leaguePayload = JSON.parse(leagues.content[0].text);
check('list_leagues returns 15 leagues', leaguePayload.leagues.length === 15, `${leaguePayload.leagues.length} leagues`);

// AFL is used because it is in season; an out-of-season league returns an empty (valid) feed and
// would not exercise the row-shape assertions below.
const picks = await client.callTool({ name: 'get_model_picks', arguments: { league: 'afl', limit: 3 } });
const picksPayload = JSON.parse(picks.content[0].text);
check('get_model_picks(afl) succeeded', !picks.isError, picks.isError ? picks.content[0].text : `${picksPayload.totalAvailable} available`);
check('get_model_picks(afl) returned rows', (picksPayload.selections?.length || 0) > 0);
if (!picks.isError && picksPayload.selections?.length) {
  const first = picksPayload.selections[0];
  console.log('  sample:', JSON.stringify(first));
  // The licence forbids republishing the upstream odds feed, so these must never appear.
  const leaked = ['bookmaker', 'price', 'americanPrice', 'impliedProbabilityPct', 'edgePct', '_sortEdge']
    .filter((k) => k in first);
  check('no upstream odds fields leak into the feed', leaked.length === 0, leaked.length ? `LEAKED: ${leaked.join(', ')}` : 'clean');
}

const badLeague = await client.callTool({ name: 'get_model_picks', arguments: { league: 'afl', feed: 'props', limit: 2 } });
check('get_model_picks(afl, props) succeeded', !badLeague.isError);

const find = await client.callTool({ name: 'find_fixture', arguments: { query: 'saints', limit: 2 } });
check('find_fixture succeeded', !find.isError, find.isError ? find.content[0].text : '');
if (!find.isError) {
  const findPayload = JSON.parse(find.content[0].text);
  check('find_fixture matched a fixture', findPayload.totalMatches > 0, `${findPayload.totalMatches} matches`);
}

// A bad league must be rejected by the schema rather than reaching the network.
const bad = await client.callTool({ name: 'get_model_picks', arguments: { league: 'quidditch' } }).catch(() => ({ isError: true }));
check('unknown league is rejected', bad.isError === true);

await client.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
