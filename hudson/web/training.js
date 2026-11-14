// Training week: your Hevy workouts, read from Strava (Hevy syncs each workout there and writes the
// exercises and sets into the description). Strava's API is free; the TV keeps its own sign-in
// fresh with the refresh token. Plain ES5; Node runs it in hudson/test-training.js.
(function (root) {
  "use strict";

  var API = "https://www.strava.com/api/v3/";
  var DAY = 86400000;

  // Hevy's notes:  "Squat (Barbell)\nSet 1: 135 lbs x 10\n...", an optional "\"note\"" line under
  // the name, and sets with weight, without it ("x 12"), or timed ("30s", "1min 30s").
  function parse(desc) {
    var out = [], cur = null;
    String(desc || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line || /^logged with hevy/i.test(line)) { cur = null; return; }
      if ((m = /^Set\s+\d+\s*:\s*(.*)$/i.exec(line))) {
        if (!cur) return;
        var s = m[1], set = { w: null, unit: "", reps: null, secs: null };
        var wr = /([\d.]+)\s*(lbs?|kg)\s*x\s*(\d+)/i.exec(s);
        var r = /^x?\s*(\d+)\s*(reps?)?\s*$/i.exec(s);
        var t = /(?:(\d+)\s*min)?\s*(?:(\d+)\s*s)?/i.exec(s);
        if (wr) { set.w = parseFloat(wr[1]); set.unit = /kg/i.test(wr[2]) ? "kg" : "lb"; set.reps = +wr[3]; }
        else if (r) set.reps = +r[1];
        else if (t && (t[1] || t[2])) set.secs = (+(t[1] || 0)) * 60 + (+(t[2] || 0));
        cur.sets.push(set);
        return;
      }
      if (cur && !cur.sets.length && /^".*"$/.test(line)) { cur.note = line.slice(1, -1); return; }
      cur = { name: line, note: "", sets: [] };
      out.push(cur);
    });
    return out.filter(function (x) { return x.sets.length; });
  }

  // the heaviest set (most reps breaks a tie), or the longest timed set
  function topSet(ex) {
    var best = null;
    ex.sets.forEach(function (s) {
      if (!best) { best = s; return; }
      if ((s.w || 0) > (best.w || 0) || ((s.w || 0) === (best.w || 0) && (s.reps || 0) > (best.reps || 0))) best = s;
      else if (s.secs && (s.secs > (best.secs || 0)) && !best.w) best = s;
    });
    return best;
  }
  function volume(exs) {
    var v = 0;
    exs.forEach(function (ex) { ex.sets.forEach(function (s) { if (s.w && s.reps) v += (s.unit === "kg" ? s.w * 2.20462 : s.w) * s.reps; }); });
    return Math.round(v);
  }
  function setText(s) {
    if (!s) return "";
    if (s.w) return (s.w % 1 ? s.w : Math.round(s.w)) + " " + s.unit + " × " + s.reps;
    if (s.reps) return s.reps + " reps";
    if (s.secs) return s.secs >= 60 ? Math.floor(s.secs / 60) + ":" + ("0" + s.secs % 60).slice(-2) : s.secs + "s";
    return "";
  }

  function weekStart(ms) {   // Monday 00:00, local time
    var d = new Date(ms), back = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
  }

  // Next in the rotation, from the names of your last sessions ("Push", "Pull", "Legs").
  function upNext(sessions, order) {
    order = order || ["Push", "Pull", "Legs"];
    for (var i = 0; i < sessions.length; i++) {
      var k = order.map(function (o) { return o.toLowerCase(); }).indexOf(String(sessions[i].name).trim().toLowerCase());
      if (k >= 0) return order[(k + 1) % order.length];
    }
    return "";
  }

  // weeks in a row (counting this one if it has a session yet, else from last week) with a workout
  function streak(sessions, now) {
    var weeks = {};
    sessions.forEach(function (s) { weeks[weekStart(s.start)] = true; });
    var w = weekStart(now), n = 0;
    if (!weeks[w]) w = weekStart(w - DAY);
    while (weeks[w]) { n++; w = weekStart(w - DAY); }
    return n;
  }

  // ---------- Strava ----------
  // st: {clientId, clientSecret, refreshToken} plus what the page keeps between runs
  // ({access, expires, refresh, details: {id: {...}}}); save(st) is called when it changes.
  function token(cfg, st, get, post, save, done) {
    if (st.access && st.expires * 1000 > Date.now() + 60000) { done(null, st.access); return; }
    post("https://www.strava.com/oauth/token", "client_id=" + encodeURIComponent(cfg.clientId) +
      "&client_secret=" + encodeURIComponent(cfg.clientSecret) + "&grant_type=refresh_token&refresh_token=" +
      encodeURIComponent(st.refresh || cfg.refreshToken), function (err, text) {
      if (err) { done(err); return; }
      try {
        var t = JSON.parse(text);
        st.access = t.access_token; st.expires = t.expires_at; st.refresh = t.refresh_token || st.refresh;
        save(st);
        done(null, st.access);
      } catch (e) { done("bad token answer"); }
    });
  }

  function load(cfg, st, get, post, save, done) {
    if (!cfg || !cfg.clientId || !cfg.refreshToken) { done("Strava not connected"); return; }
    token(cfg, st, get, post, save, function (err, access) {
      if (err) { done(err); return; }
      var auth = { Authorization: "Bearer " + access };
      var after = Math.floor((weekStart(Date.now()) - 12 * 7 * DAY) / 1000);
      get(API + "athlete/activities?per_page=100&after=" + after, 20000, function (e, text) {
        if (e) { done(e); return; }
        var acts;
        try { acts = JSON.parse(text); } catch (x) { done("bad activity list"); return; }
        st.details = st.details || {};
        var thisWeek = weekStart(Date.now()) - 7 * DAY;   // details for this week and last
        var need = acts.filter(function (a) { return Date.parse(a.start_date) >= thisWeek && !st.details[a.id]; });
        var left = need.length;
        function finish() {
          // keep only the details still in range
          var keep = {};
          acts.forEach(function (a) { if (st.details[a.id]) keep[a.id] = st.details[a.id]; });
          st.details = keep;
          save(st);
          done(null, summarize(acts, st.details, Date.now(), cfg.rotation));
        }
        if (!left) { finish(); return; }
        need.forEach(function (a) {
          get(API + "activities/" + a.id, 20000, function (e2, t2) {
            if (!e2) try {
              var d = JSON.parse(t2);
              st.details[a.id] = { description: d.description || "", calories: d.calories || 0, hr: d.average_heartrate || 0 };
            } catch (x) {}
            if (!--left) finish();
          }, auth);
        });
      }, auth);
    });
  }

  function summarize(acts, details, now, rotation) {
    var sessions = acts.map(function (a) {
      var d = details[a.id] || {}, exs = parse(d.description);
      return { id: a.id, name: a.name, type: a.sport_type || a.type, start: Date.parse(a.start_date),
        minutes: Math.round((a.elapsed_time || a.moving_time || 0) / 60), calories: d.calories || 0, hr: d.hr || 0,
        exercises: exs, sets: exs.reduce(function (n, x) { return n + x.sets.length; }, 0), volume: volume(exs),
        miles: a.distance ? Math.round(a.distance / 160.934) / 10 : 0 };
    }).sort(function (a, b) { return b.start - a.start; });
    var ws = weekStart(now), week = sessions.filter(function (s) { return s.start >= ws; });
    var lastWeek = sessions.filter(function (s) { return s.start >= ws - 7 * DAY && s.start < ws; });
    var days = [0, 0, 0, 0, 0, 0, 0];
    week.forEach(function (s) { days[(new Date(s.start).getDay() + 6) % 7] = 1; });
    function total(list, k) { return list.reduce(function (n, s) { return n + s[k]; }, 0); }
    return {
      week: week, days: days, workouts: week.length, minutes: total(week, "minutes"), volume: total(week, "volume"),
      lastWeek: { workouts: lastWeek.length, minutes: total(lastWeek, "minutes"), volume: total(lastWeek, "volume") },
      last: sessions[0] || null, upNext: upNext(sessions, rotation), streak: streak(sessions, now)
    };
  }

  var Training = { parse: parse, topSet: topSet, setText: setText, volume: volume, weekStart: weekStart,
    upNext: upNext, streak: streak, summarize: summarize, load: load };
  if (typeof module !== "undefined" && module.exports) module.exports = Training;
  else root.Training = Training;
})(this);
