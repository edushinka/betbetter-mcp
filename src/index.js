#!/usr/bin/env node
/**
 * betbetter-mcp — an MCP server over the Bet Better open model API.
 *
 * Exposes the model's own win probabilities and fair odds for nine sports. The upstream feed is
 * public, read-only and needs no key, so this server holds no credentials and performs no writes.
 *
 * Note the upstream feed deliberately carries no bookmaker prices — it is model output only.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = process.env.BETBETTER_BASE_URL || 'https://betbetter.world';
const UA = 'betbetter-mcp/1.0 (+https://betbetter.world/api)';

/** League slug -> path segment on the site. */
const LEAGUES = {
  afl: 'afl',
  mlb: 'mlb',
  nba: 'nba',
  nfl: 'nfl',
  nhl: 'nhl',
  ncaaf: 'ncaaf',
  ufc: 'ufc',
  wnba: 'wnba',
  wta: 'tennis/wta',
  epl: 'soccer/epl',
  'la-liga': 'soccer/la-liga',
  'serie-a': 'soccer/serie-a',
  bundesliga: 'soccer/bundesliga',
  'ligue-1': 'soccer/ligue-1',
  'world-cup': 'soccer/world-cup'
};

/** Feed kind -> page name. */
const FEEDS = {
  picks: 'picks',        // game lines + player props, ranked
  games: 'best-bets',    // game lines only
  props: 'prop-bets'     // player props only
};

const LEAGUE_KEYS = Object.keys(LEAGUES);

/**
 * Fetch one feed. Upstream always returns a JSON document (it reports data problems in an `error`
 * field rather than failing), so anything non-2xx or unparseable is a transport problem worth
 * surfacing verbatim.
 */
async function fetchFeed(league, feed) {
  const path = LEAGUES[league];
  const page = FEEDS[feed];
  if (!path) throw new Error(`Unknown league "${league}". Known: ${LEAGUE_KEYS.join(', ')}`);
  if (!page) throw new Error(`Unknown feed "${feed}". Known: ${Object.keys(FEEDS).join(', ')}`);

  const url = `${BASE}/${path}/${page}.aspx?format=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);

  const text = await res.text();
  try {
    return { url, data: JSON.parse(text) };
  } catch {
    throw new Error(`${url} did not return JSON (got ${text.slice(0, 120)}…)`);
  }
}

/** Feed documents use `picks` for combined/game feeds and `props` for the prop-only feed. */
function rowsOf(data) {
  if (Array.isArray(data?.picks)) return data.picks;
  if (Array.isArray(data?.props)) return data.props;
  return [];
}

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(err) {
  return {
    isError: true,
    content: [{ type: 'text', text: `betbetter-mcp: ${err instanceof Error ? err.message : String(err)}` }]
  };
}

const server = new McpServer({ name: 'betbetter-mcp', version: '1.0.0' });

server.registerTool(
  'list_leagues',
  {
    title: 'List available leagues',
    description: 'List every league slug the Bet Better model publishes, for use with the other tools.',
    inputSchema: {}
  },
  async () => textResult({ leagues: LEAGUE_KEYS, feeds: Object.keys(FEEDS), docs: `${BASE}/api` })
);

server.registerTool(
  'get_model_picks',
  {
    title: 'Get model picks for a league',
    description:
      "Return the model's rated selections for a league: estimated win probability, fair decimal " +
      'odds and a worded confidence (HIGH / LEAN / LONG-SHOT). Contains no bookmaker prices — this ' +
      'is model output only, so it cannot tell you where to bet or at what price.',
    inputSchema: {
      league: z.enum(LEAGUE_KEYS).describe('League slug, e.g. "afl", "nba", "epl".'),
      feed: z
        .enum(['picks', 'games', 'props'])
        .default('picks')
        .describe('"picks" = everything ranked, "games" = game lines only, "props" = player props only.'),
      limit: z.number().int().min(1).max(200).default(20).describe('Maximum selections to return.'),
      minProbabilityPct: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe('Only return selections the model rates at or above this probability.')
    }
  },
  async ({ league, feed = 'picks', limit = 20, minProbabilityPct }) => {
    try {
      const { url, data } = await fetchFeed(league, feed);
      let rows = rowsOf(data);
      if (typeof minProbabilityPct === 'number') {
        rows = rows.filter((r) => typeof r.modelProbabilityPct === 'number' && r.modelProbabilityPct >= minProbabilityPct);
      }
      return textResult({
        source: url,
        sport: data.sport,
        updatedUtc: data.updatedUtc,
        licence: data.licence,
        disclaimer: data.disclaimer,
        returned: Math.min(rows.length, limit),
        totalAvailable: rows.length,
        selections: rows.slice(0, limit)
      });
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  'find_fixture',
  {
    title: 'Find a fixture across leagues',
    description:
      'Search upcoming fixtures across every league for a team or player name, and return the ' +
      "model's rated selections for the matches that match.",
    inputSchema: {
      query: z.string().min(2).describe('Team or player name, case-insensitive substring match.'),
      limit: z.number().int().min(1).max(100).default(25).describe('Maximum selections to return.')
    }
  },
  async ({ query, limit = 25 }) => {
    const needle = query.toLowerCase();
    const hits = [];
    const failures = [];

    // Leagues are independent; fetch concurrently and tolerate individual failures so one
    // out-of-season or erroring league never blanks the whole search.
    await Promise.all(
      LEAGUE_KEYS.map(async (league) => {
        try {
          const { data } = await fetchFeed(league, 'picks');
          for (const row of rowsOf(data)) {
            const hay = `${row.game || ''} ${row.selection || ''}`.toLowerCase();
            if (hay.includes(needle)) hits.push({ league, ...row });
          }
        } catch (err) {
          failures.push({ league, reason: err instanceof Error ? err.message : String(err) });
        }
      })
    );

    hits.sort((a, b) => (b.modelProbabilityPct || 0) - (a.modelProbabilityPct || 0));
    return textResult({
      query,
      returned: Math.min(hits.length, limit),
      totalMatches: hits.length,
      leaguesUnavailable: failures,
      selections: hits.slice(0, limit),
      disclaimer: 'Model estimates for research. Not a guarantee. 18+. Please gamble responsibly.'
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
