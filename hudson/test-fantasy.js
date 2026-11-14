// TZ=America/New_York node hudson/test-fantasy.js [--live]
"use strict";
var assert = require("assert");
var F = require("./web/fantasy.js");
var S = require("./web/sports.js");

// ranking: live first, then most players, then soonest; finished last
var g = function (id, state, n, start) { return { id: id, state: state, start: start, players: new Array(n) }; };
assert.deepStrictEqual(F.rank([g("a", "pre", 1, 1), g("b", "pre", 3, 5), g("c", "in", 1, 9), g("d", "post", 5, 0), g("e", "pre", 3, 2)])
  .map(function (x) { return x.id; }), ["c", "e", "b", "a", "d"]);
assert.strictEqual(F.espnAbbr("WAS"), "WSH");

// joining starters to games, defences by team code
var board = { events: [{ id: "1", date: "2026-11-15T18:00Z", competitions: [{ status: { type: { state: "pre" } },
  broadcasts: [{ market: "national", names: ["CBS"] }],
  competitors: [{ homeAway: "home", team: { abbreviation: "NYJ", shortDisplayName: "Jets" } },
                { homeAway: "away", team: { abbreviation: "BUF", shortDisplayName: "Bills" } }] }] }] };
var players = { "1": { n: "Josh Allen", p: "QB", t: "BUF" }, "2": { n: "Garrett Wilson", p: "WR", t: "NYJ" }, "3": { n: "James Cook III", p: "RB", t: "BUF" }, "4": { n: "Someone", p: "WR", t: "KC" } };
var gs = F.games(board, ["1", "2", "4"], ["3", "NYJ"], players);
assert.strictEqual(gs.length, 1);
assert.strictEqual(gs[0].mine, 2); assert.strictEqual(gs[0].theirs, 2);
assert.deepStrictEqual(gs[0].players.map(function (p) { return p.n; }), ["Josh Allen", "Garrett Wilson", "James Cook III", "NYJ D/ST"]);

// a Browns home game on FOX airs in Cleveland
var cfg = { localNfl: ["CLE"] }, nfl = { sport: "nfl" };
var sun = Date.parse("2026-11-15T18:00:00Z");
assert.strictEqual(S.where({ start: sun, abbrs: ["CLE", "HOU"], networks: [{ name: "Fox", market: "national" }] }, nfl, cfg).label, "YouTube TV · Fox");
assert.ok(/regional/.test(S.where({ start: sun, abbrs: ["CAR", "NO"], networks: [{ name: "Fox", market: "national" }] }, nfl, cfg).label));
console.log("fantasy: all checks passed");

if (process.argv.indexOf("--live") >= 0) {
  var get = function (url, t, done) { fetch(url).then(function (r) { return r.text(); }).then(function (x) { done(null, x); }, function (e) { done(String(e)); }); };
  var cache = {};
  F.load({ sleeperLeague: "1343819095119765504", sleeperUser: "hudsonshank" }, get, cache, function (err, hub) {
    assert.ok(!err, err);
    console.log("week", hub.week, hub.me.name, hub.me.points, "vs", hub.them.name, hub.them.points, "| players cached:", Object.keys(cache.players).length);
    F.rank(hub.games).forEach(function (x) {
      var w = S.where({ start: x.start, abbrs: [x.home.abbr, x.away.abbr], networks: x.networks }, nfl, cfg);
      console.log(x.state.padEnd(4), new Date(x.start).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).padEnd(12),
        (x.away.abbr + " @ " + x.home.abbr).padEnd(11), x.players.length + " (" + x.mine + " yours, " + x.theirs + " theirs)", "|", w.label);
    });
  });
}
