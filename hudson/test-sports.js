// TZ=America/New_York node hudson/test-sports.js [--live]
"use strict";
var assert = require("assert");
var S = require("./web/sports.js");

var hornets = { key: "hornets", name: "Hornets", sport: "nba", id: 30 };
var panthers = { key: "panthers", name: "Panthers", sport: "nfl", id: 29 };
var unc = { key: "unc-fb", name: "UNC Football", sport: "college", id: 153 };
var cfg = { leaguePassBlackout: ["CLE"], nflSundayTicket: false };
function game(nets, extra) {
  var g = { start: Date.parse("2026-11-20T00:00:00Z"), opponent: "Hawks", opponentAbbr: "ATL",
    networks: nets.map(function (n) { return { name: n[0], market: n[1] || "National" }; }) };
  for (var k in extra) g[k] = extra[k];
  return g;
}

// NBA: local-only broadcasts mean League Pass on Prime; national ones win; Cavaliers are blacked out
assert.strictEqual(S.where(game([["ClipperVision", "Home"]]), hornets, cfg).app, "prime");
assert.ok(S.where(game([]), hornets, cfg).leaguePass);
assert.strictEqual(S.where(game([["ESPN"]]), hornets, cfg).label, "YouTube TV · ESPN");
assert.strictEqual(S.where(game([["Prime Video"]]), hornets, cfg).label, "Prime Video");
assert.strictEqual(S.where(game([], { opponent: "Cavaliers", opponentAbbr: "CLE" }), hornets, cfg).app, null);
assert.strictEqual(S.where(game([["Peacock"]]), hornets, cfg).app, null);

// NFL: Sunday afternoon FOX is regional; Sunday night NBC and Monday ESPN are national
var sunAfternoon = Date.parse("2026-11-15T18:00:00Z");               // 1 PM Eastern
var w = S.where(game([["Fox"]], { start: sunAfternoon }), panthers, cfg);
assert.strictEqual(w.app, "youtubetv"); assert.ok(/regional/.test(w.label)); assert.ok(w.note);
assert.strictEqual(S.where(game([["Fox"]], { start: sunAfternoon }), panthers, { nflSundayTicket: true }).label, "Sunday Ticket · YouTube TV");
assert.strictEqual(S.where(game([["NBC"]], { start: Date.parse("2026-11-16T01:20:00Z") }), panthers, cfg).label, "YouTube TV · NBC");
assert.strictEqual(S.where(game([["Prime Video"]]), panthers, cfg).app, "prime");
assert.strictEqual(S.where(game([["Netflix"]]), panthers, cfg).app, "netflix");

// College: ESPN family and ACC Network on YouTube TV; ESPN+ is not available; no listing yet
assert.strictEqual(S.where(game([["ACC Network"]]), unc, cfg).app, "youtubetv");
assert.strictEqual(S.where(game([["ESPN2"]]), unc, cfg).app, "youtubetv");
assert.strictEqual(S.where(game([["CW"]]), unc, cfg).app, "youtubetv");
assert.strictEqual(S.where(game([["ESPN+"]]), unc, cfg).app, null);
assert.strictEqual(S.where(game([]), unc, cfg).label, "TV to be announced");

// standings: the smallest group holding the team, sorted for its league
function ent(id, abbr, stats) { return { team: { id: id, abbreviation: abbr, shortDisplayName: abbr }, stats: Object.keys(stats).map(function (k) { return { name: k, displayValue: stats[k] }; }) }; }
var nfl = { children: [{ name: "NFC", standings: { entries: [ent(29, "CAR", { overall: "3-5" }), ent(1, "X", { overall: "9-0" }), ent(2, "Y", {}), ent(3, "Z", {})] },
  children: [{ name: "NFC South", standings: { entries: [ent(18, "NO", { overall: "3-5", playoffSeed: "12" }), ent(29, "CAR", { overall: "3-5", playoffSeed: "4" }), ent(27, "TB", { overall: "3-6" })] } }] }] };
var st = S.parseStandings(nfl, panthers);
assert.strictEqual(st.name, "NFC South");
assert.deepStrictEqual(st.rows.map(function (r) { return r.abbr; }), ["CAR", "NO", "TB"]);
assert.ok(st.rows[0].us);
var acc = { children: [{ name: "ACC", standings: { entries: [ent(153, "UNC", { overall: "5-4", "vs. Conf.": "2-3" }), ent(1, "DUKE", { overall: "6-3", "vs. Conf.": "4-1" })] } }] };
assert.deepStrictEqual(S.parseStandings(acc, unc).rows.map(function (r) { return r.abbr; }), ["DUKE", "UNC"]);
assert.strictEqual(S.parseStandings({ children: [] }, unc), null);
console.log("sports rules: all checks passed");

if (process.argv.indexOf("--live") >= 0) {
  var teams = [hornets, panthers, unc, { key: "unc-bb", name: "UNC Basketball", sport: "college", id: 153, league: "basketball/mens-college-basketball" }];
  hornets.league = "basketball/nba"; panthers.league = "football/nfl"; unc.league = "football/college-football";
  function get(url, t, done) {
    fetch(url).then(function (r) { return r.text(); }).then(function (x) { done(null, x); }, function (e) { done(String(e)); });
  }
  teams.forEach(function (t) {
    S.fetchTeam(t, get, function (err, games) {
      assert.ok(!err, err);
      S.upcoming(games, Date.now()).slice(0, 2).forEach(function (g) {
        var x = S.where(g, t, cfg);
        console.log(t.name.padEnd(15), new Date(g.start).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }),
          (g.home ? "vs " : "at ") + g.opponent.padEnd(12), g.state, "|", x.label, x.note ? "(note)" : "");
      });
    });
  });
}
