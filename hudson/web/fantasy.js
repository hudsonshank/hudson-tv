// Fantasy Hub: this week's Sleeper matchup (public API, no key) joined to the NFL games your
// starters and your opponent's starters play in (ESPN's scoreboard), busiest game first.
// Plain ES5; Node runs it in hudson/test-fantasy.js.
(function (root) {
  "use strict";

  var SLEEPER = "https://api.sleeper.app/v1/";
  var ESPN_NFL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
  // Sleeper and ESPN name a few teams differently
  var TO_ESPN = { WAS: "WSH" };
  function espnAbbr(t) { return TO_ESPN[t] || t; }

  function getJson(get, url, timeout, done) {
    get(url, timeout, function (err, text) {
      if (err) { done(err); return; }
      try { done(null, JSON.parse(text)); } catch (e) { done("bad JSON from " + url); }
    });
  }

  // Load everything. cache: {players: {id: {n, p, t}}}, kept between calls by the page.
  // done(err, hub) with hub = {week, me: {name, points}, them: {name, points}, games: [...]}
  function load(cfg, get, cache, done) {
    var league = cfg.sleeperLeague, user = (cfg.sleeperUser || "").toLowerCase();
    if (!league || !user) { done("no Sleeper league set"); return; }
    getJson(get, SLEEPER + "state/nfl", 15000, function (err, state) {
      if (err) { done(err); return; }
      var week = state.display_week || state.week, season = state.season;
      var parts = {}, left = 4, failed = null;
      function got(key) { return function (e, v) { if (e) failed = e; parts[key] = v; if (!--left) step2(); }; }
      getJson(get, SLEEPER + "league/" + league + "/users", 15000, got("users"));
      getJson(get, SLEEPER + "league/" + league + "/rosters", 15000, got("rosters"));
      getJson(get, SLEEPER + "league/" + league + "/matchups/" + week, 15000, got("matchups"));
      getJson(get, ESPN_NFL + "?seasontype=" + (state.season_type === "post" ? 3 : 2) + "&week=" + week + "&dates=" + season, 20000, got("board"));
      function step2() {
        if (failed) { done(failed); return; }
        var me = parts.users.filter(function (u) { return (u.display_name || "").toLowerCase() === user || u.user_id === user; })[0];
        if (!me) { done("no Sleeper user " + user + " in this league"); return; }
        var myRoster = parts.rosters.filter(function (r) { return r.owner_id === me.user_id; })[0];
        var mine = myRoster && parts.matchups.filter(function (m) { return m.roster_id === myRoster.roster_id; })[0];
        if (!mine) { done("no matchup this week"); return; }
        var theirs = parts.matchups.filter(function (m) { return m.matchup_id === mine.matchup_id && m !== mine; })[0];
        var theirRoster = theirs && parts.rosters.filter(function (r) { return r.roster_id === theirs.roster_id; })[0];
        var theirUser = theirRoster && parts.users.filter(function (u) { return u.user_id === theirRoster.owner_id; })[0];
        var need = (mine.starters || []).concat(theirs ? theirs.starters || [] : []).filter(function (id) {
          return id && id !== "0" && !/^[A-Z]{2,3}$/.test(id) && !(cache.players && cache.players[id]);
        });
        function finish() {
          done(null, {
            week: week,
            me: { name: teamName(me), points: mine.points || 0 },
            them: theirs ? { name: teamName(theirUser), points: theirs.points || 0 } : null,
            games: games(parts.board, mine.starters || [], theirs ? theirs.starters || [] : [], cache.players || {})
          });
        }
        if (!need.length) { finish(); return; }
        // A new name on either lineup: Sleeper only hands out every player at once (about 15 MB).
        // Read it, keep the players on rosters in this league, and let it go.
        getJson(get, SLEEPER + "players/nfl", 120000, function (e, all) {
          if (e) { done(e); return; }
          cache.players = cache.players || {};
          var keep = {};
          parts.rosters.forEach(function (r) { (r.players || []).concat(r.starters || []).forEach(function (id) { keep[id] = true; }); });
          Object.keys(keep).forEach(function (id) {
            var p = all[id];
            if (p) cache.players[id] = { n: p.full_name || ((p.first_name || "") + " " + (p.last_name || "")).trim(), p: p.position || "", t: p.team || "" };
          });
          cache.changed = true;
          finish();
        });
      }
    });
  }

  function teamName(u) {
    if (!u) return "Opponent";
    return (u.metadata && u.metadata.team_name) || u.display_name || "Opponent";
  }

  function player(id, players) {
    if (/^[A-Z]{2,3}$/.test(id)) return { id: id, n: id + " D/ST", p: "DEF", t: id };
    var p = players[id];
    return p ? { id: id, n: p.n, p: p.p, t: p.t } : null;
  }

  // NFL games this week with the players in them
  function games(board, mine, theirs, players) {
    var out = [];
    ((board && board.events) || []).forEach(function (e) {
      var c = (e.competitions || [])[0] || {}, st = (c.status || {}).type || {};
      var home = null, away = null;
      (c.competitors || []).forEach(function (x) { if (x.homeAway === "home") home = x; else away = x; });
      if (!home || !away) return;
      var abbrs = [home.team.abbreviation, away.team.abbreviation];
      function inGame(ids, side) {
        return ids.map(function (id) { return player(id, players); }).filter(function (p) {
          return p && abbrs.indexOf(espnAbbr(p.t)) >= 0;
        }).map(function (p) { p.side = side; return p; });
      }
      var ps = inGame(mine, "mine").concat(inGame(theirs, "theirs"));
      if (!ps.length) return;
      function side(x) {
        return { abbr: x.team.abbreviation, name: x.team.shortDisplayName || x.team.displayName,
          logo: x.team.logo || (x.team.logos && x.team.logos[0] && x.team.logos[0].href) || "",
          score: x.score == null ? null : String(x.score),
          color: x.team.color ? "#" + x.team.color : "", alt: x.team.alternateColor ? "#" + x.team.alternateColor : "" };
      }
      out.push({
        id: e.id, start: Date.parse(e.date), state: st.state || "pre", completed: !!st.completed,
        detail: st.shortDetail || "", home: side(home), away: side(away),
        networks: (c.broadcasts || []).map(function (b) { return { name: (b.names || [])[0] || "", market: b.market || "national" }; })
          .filter(function (n) { return n.name; }),
        players: ps,
        mine: ps.filter(function (p) { return p.side === "mine"; }).length,
        theirs: ps.filter(function (p) { return p.side === "theirs"; }).length
      });
    });
    return out;
  }

  // Busiest first: games on now, then games still to come (most players, then soonest); finished last.
  function rank(list) {
    function tier(g) { return g.state === "in" ? 0 : g.state === "pre" ? 1 : 2; }
    return list.slice().sort(function (a, b) {
      return tier(a) - tier(b) || b.players.length - a.players.length || a.start - b.start;
    });
  }

  var Fantasy = { load: load, games: games, rank: rank, espnAbbr: espnAbbr };
  if (typeof module !== "undefined" && module.exports) module.exports = Fantasy;
  else root.Fantasy = Fantasy;
})(this);
