// Your teams: their schedules from ESPN's public site API (no key), and where each game can be
// watched with the services in hudson-config.js. Plain ES5; Node runs it in hudson/test-sports.js.
(function (root) {
  "use strict";

  var API = "https://site.api.espn.com/apis/site/v2/sports/";

  // Networks a YouTube TV base plan carries (the local ABC, CBS, FOX, NBC and CW included).
  var YOUTUBE_TV = /^(abc|cbs|fox|nbc|the cw|cw|espn|espn2|espnu|espnews|abc\/espn|acc ?network|accn|sec ?network|secn|big ten network|btn|fs1|fs2|fox sports 1|tnt|tbs|trutv|nfl network|nfl net|nba tv|cbs sports network|cbssn|golf)$/i;
  var PRIME = /prime video|amazon/i;
  var NETFLIX = /netflix/i;
  var PEACOCK_ONLY = /^peacock$/i;
  var ESPN_PLUS = /^(espn\+|accnx|acc network extra|sec network\+)$/i;

  function media(b) { return (b.media && (b.media.shortName || b.media.name)) || (b.names && b.names[0]) || ""; }

  // One game as the page needs it.
  function normalize(team, e) {
    var c = (e.competitions || [])[0] || {}, st = (c.status || e.status || {}).type || {};
    var us = null, them = null;
    (c.competitors || []).forEach(function (x) {
      if (String(x.team && x.team.id) === String(team.id)) us = x; else them = x;
    });
    if (!us || !them) return null;
    function score(x) { var s = x.score; return s == null ? null : typeof s === "object" ? (s.displayValue || String(s.value)) : String(s); }
    var nets = (c.broadcasts || []).map(function (b) {
      return { name: media(b), market: (b.market && b.market.type) || "" };
    }).filter(function (n) { return n.name; });
    return {
      id: e.id, team: team.key, teamName: team.name,
      start: Date.parse(e.date), state: st.state || "pre", completed: !!st.completed,
      detail: st.shortDetail || st.detail || "",
      home: us.homeAway === "home",
      opponent: (them.team && (them.team.shortDisplayName || them.team.displayName)) || "TBD",
      opponentAbbr: (them.team && them.team.abbreviation) || "",
      opponentLogo: them.team && them.team.logos && them.team.logos[0] ? them.team.logos[0].href : (them.team && them.team.logo) || "",
      us: score(us), them: score(them), networks: nets,
      abbrs: [us.team && us.team.abbreviation, them.team && them.team.abbreviation],
      venue: c.venue ? [c.venue.fullName, c.venue.address && c.venue.address.city].filter(Boolean).join(", ") : "",
      neutral: !!c.neutralSite,
      note: ((c.notes || [])[0] || {}).headline || ""
    };
  }

  // Where to watch: {app: "prime" | "youtubetv" | "netflix" | null, label, note}
  function where(game, team, cfg) {
    cfg = cfg || {};
    var names = game.networks.map(function (n) { return n.name; });
    var national = game.networks.filter(function (n) { return /national/i.test(n.market) || !n.market; }).map(function (n) { return n.name; });
    var has = function (re, list) { return (list || names).filter(function (n) { return re.test(n); })[0]; };
    var n;
    if ((n = has(PRIME))) return { app: "prime", label: "Prime Video" };
    if ((n = has(NETFLIX))) return { app: "netflix", label: "Netflix" };

    if (team.sport === "nba") {
      if ((n = has(YOUTUBE_TV, national))) return { app: "youtubetv", label: "YouTube TV · " + n };
      if (has(PEACOCK_ONLY, national)) return { app: null, label: "Peacock", note: "This game is only on Peacock, which you don't have set up." };
      var blackout = (cfg.leaguePassBlackout || []).indexOf(game.opponentAbbr) >= 0;
      if (blackout) return { app: null, label: "Blacked out", note: "League Pass blacks out " + game.opponent + " games where you live. It isn't available in your area right now." };
      return { app: "prime", label: "League Pass · Prime Video", leaguePass: true };
    }
    if (team.sport === "nfl") {
      var regional = has(/^(fox|cbs)$/i);
      var hour = new Date(game.start).getHours(), day = new Date(game.start).getDay();
      var local = (game.abbrs || []).some(function (t) { return (cfg.localNfl || []).indexOf(t) >= 0; });
      if (regional && local) return { app: "youtubetv", label: "YouTube TV · " + regional };
      if (regional && day === 0 && hour < 19 && !has(YOUTUBE_TV, names.filter(function (x) { return !/^(fox|cbs)$/i.test(x); }))) {
        if (cfg.nflSundayTicket) return { app: "youtubetv", label: "Sunday Ticket · YouTube TV" };
        return { app: "youtubetv", label: "YouTube TV · " + regional + " (regional)", note: "Sunday afternoon games on " + regional + " are regional. If it isn't on your local " + regional + " channel, it's not available in your area without NFL Sunday Ticket." };
      }
    }
    if ((n = has(YOUTUBE_TV))) return { app: "youtubetv", label: "YouTube TV · " + n };
    if ((n = has(ESPN_PLUS))) return { app: null, label: n, note: "This one is only on " + n + ", which isn't one of your services. It isn't available to you right now." };
    if (!names.length) return { app: null, label: "TV to be announced", note: "The channel for this game hasn't been announced yet." };
    return { app: null, label: names[0], note: "This game is on " + names.join(", ") + ", which isn't one of your services. It isn't available in your area right now." };
  }

  function fetchTeam(team, get, done) {
    get(API + team.league + "/teams/" + team.id + "/schedule", 20000, function (err, text) {
      if (err) { done(err, null); return; }
      try {
        var d = JSON.parse(text), out = [];
        (d.events || []).forEach(function (e) { var g = normalize(team, e); if (g) out.push(g); });
        done(null, out);
      } catch (e) { done(String(e), null); }
    });
  }

  // games still to come or on now, soonest first (live ones lead)
  function upcoming(games, now) {
    return games.filter(function (g) {
      return g.state === "in" || (!g.completed && g.state !== "post" && g.start > now - 4 * 3600000);
    }).sort(function (a, b) { return (b.state === "in") - (a.state === "in") || a.start - b.start; });
  }

  var Sports = { normalize: normalize, where: where, fetchTeam: fetchTeam, upcoming: upcoming };
  if (typeof module !== "undefined" && module.exports) module.exports = Sports;
  else root.Sports = Sports;
})(this);
