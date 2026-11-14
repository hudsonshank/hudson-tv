// Hudson TV home: the greeting, the clock, the weather (Open-Meteo, no key), your teams' games
// (sports.js, ESPN's public schedules) or today's calendar (ics.js), your apps, and panels for a
// team's games and all apps. Everything runs on the TV; no computer needed.
(function () {
  "use strict";
  var C = window.HUDSON || {};
  var NAME = C.name || "Hudson";
  var $ = function (id) { return document.getElementById(id); };

  // ---------- small helpers ----------
  function store(k, v) { try { localStorage.setItem("hudson." + k, JSON.stringify(v)); } catch (e) {} }
  function kept(k) { try { return JSON.parse(localStorage.getItem("hudson." + k)); } catch (e) { return null; } }
  function get(url, timeout, done, headers) {
    var x = new XMLHttpRequest();
    x.open("GET", url);
    for (var h in headers || {}) x.setRequestHeader(h, headers[h]);
    x.timeout = timeout;
    x.onload = function () { done(x.status >= 200 && x.status < 300 ? null : "HTTP " + x.status, x.responseText); };
    x.onerror = function () { done("network error"); };
    x.ontimeout = function () { done("timed out"); };
    x.send();
  }
  function post(url, body, done) {
    var x = new XMLHttpRequest();
    x.open("POST", url);
    x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    x.timeout = 20000;
    x.onload = function () { done(x.status >= 200 && x.status < 300 ? null : "HTTP " + x.status, x.responseText); };
    x.onerror = function () { done("network error"); };
    x.ontimeout = function () { done("timed out"); };
    x.send(body);
  }
  function log(t) { try { console.log("hudson: " + t); } catch (e) {} }
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function hm(d, ampm) {
    var h = d.getHours() % 12 || 12, m = ("0" + d.getMinutes()).slice(-2);
    return h + ":" + m + (ampm ? (d.getHours() < 12 ? " AM" : " PM") : "");
  }
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  // ---------- icons (24 x 24 line drawings) ----------
  var P = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>';
  var CLOUD = '<path d="M7 18.5h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 18.5z"/>';
  var ICONS = {
    clear: SUN,
    night: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
    partly: '<path d="M9 3.2v1.6M3.2 9h1.6M4.9 4.9l1.1 1.1M13.1 4.9l-1.1 1.1"/><path d="M6.2 11.3a3.4 3.4 0 0 1 6-2.6"/><path d="M8.5 20h9.3a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8.5 20z"/>',
    partlynight: '<path d="M12.2 6.6A4.8 4.8 0 0 1 6 12.8a4.9 4.9 0 0 0 1.4 1.3"/><path d="M8.5 20h9.3a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8.5 20z"/>',
    cloud: CLOUD,
    fog: '<path d="M7 14.5h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 14.5z"/><path d="M4 18h16M6 21h12"/>',
    drizzle: '<path d="M7 15h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 15z"/><path d="M9 18.2v.6M12 19.7v.6M15 18.2v.6"/>',
    rain: '<path d="M7 15h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 15z"/><path d="M8.5 17.5l-1 3M12 17.5l-1 3M15.5 17.5l-1 3"/>',
    snow: '<path d="M7 14h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 14z"/><path d="M8 17.5v.01M12 17v.01M16 17.5v.01M10 20.5v.01M14 20.5v.01" stroke-width="2.4"/>',
    storm: '<path d="M7 15h10.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 15z"/><path d="M12.5 15.5l-2 3.3h3l-2 3.2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4l.5 3.5h-5z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 9.8h17M8 3v4M16 3v4"/>',
    sunrise: '<path d="M4 18.5h16M7 18.5a5 5 0 0 1 10 0M12 4.5v5M9.5 7L12 4.5 14.5 7M4.6 13.6l1.3.8M19.4 13.6l-1.3.8"/>',
    sunset: '<path d="M4 18.5h16M7 18.5a5 5 0 0 1 10 0M12 4.5v5M9.5 7L12 9.5 14.5 7M4.6 13.6l1.3.8M19.4 13.6l-1.3.8"/>'
  };
  function icon(el, name) { el.innerHTML = '<svg viewBox="0 0 24 24" ' + P + ">" + (ICONS[name] || "") + "</svg>"; }
  function paintIcons(root) {
    var list = (root || document).querySelectorAll("[data-icon]");
    for (var i = 0; i < list.length; i++) icon(list[i], list[i].getAttribute("data-icon"));
  }

  // WMO weather codes, as Open-Meteo gives them
  function sky(code, day) {
    if (code === 0 || code === 1) return { icon: day ? "clear" : "night", text: code ? "Mostly clear" : (day ? "Sunny" : "Clear") };
    if (code === 2) return { icon: day ? "partly" : "partlynight", text: "Partly cloudy" };
    if (code === 3) return { icon: "cloud", text: "Cloudy" };
    if (code === 45 || code === 48) return { icon: "fog", text: "Fog" };
    if (code >= 51 && code <= 57) return { icon: "drizzle", text: "Drizzle" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "rain", text: code >= 80 ? "Showers" : "Rain" };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "snow", text: "Snow" };
    if (code >= 95) return { icon: "storm", text: "Thunderstorms" };
    return { icon: "cloud", text: "Cloudy" };
  }

  // ---------- clock and greeting ----------
  var lastMinute = -1, lastDay = -1;
  function partOfDay(h) { return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; }
  function tick() {
    var now = new Date();
    if (now.getMinutes() === lastMinute) return;
    lastMinute = now.getMinutes();
    var spans = $("clock").children;
    for (var c = 0; c < spans.length; c++) spans[c].textContent = hm(now, false);
    $("date").textContent = DAYS[now.getDay()] + ", " + MONTHS[now.getMonth()] + " " + now.getDate();
    $("greeting").textContent = "Good " + partOfDay(now.getHours()) + ", " + NAME;
    if (now.getDate() !== lastDay) { lastDay = now.getDate(); drawWeather(kept("weather")); }
    drawCards();
  }

  // ---------- weather ----------
  function loadWeather() {
    if (C.lat === undefined) return;
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + C.lat + "&longitude=" + C.lon +
      "&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&hourly=temperature_2m,precipitation_probability,weather_code,is_day,wind_speed_10m&wind_speed_unit=mph" +
      "&temperature_unit=fahrenheit&timezone=auto&forecast_days=5";
    get(url, 15000, function (err, text) {
      if (err) { log("weather " + err); return; }
      try { var w = JSON.parse(text); w.at = Date.now(); store("weather", w); drawWeather(w); } catch (e) { log("weather " + e); }
    });
  }
  function drawWeather(w) {
    if (!w || !w.current || !w.daily) return;
    var cur = w.current, d = w.daily, s = sky(cur.weather_code, cur.is_day);
    var temp = Math.round(cur.temperature_2m) + "°";
    $("w-temp").textContent = temp;
    $("now-temp").textContent = temp;
    icon($("now-icon"), s.icon);
    $("w-cond").textContent = s.text;
    // today's row is the first daily entry for today's date (the cache may be from yesterday)
    var today = new Date(), key = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    var i0 = Math.max(0, d.time.indexOf(key));
    $("w-hilo").textContent = "H " + Math.round(d.temperature_2m_max[i0]) + "°  L " + Math.round(d.temperature_2m_min[i0]) + "°";
    var row = $("w-days");
    row.innerHTML = "";
    for (var i = i0; i < Math.min(i0 + 4, d.time.length); i++) {
      var parts = d.time[i].split("-"), when = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      var cell = document.createElement("div");
      cell.className = "day";
      cell.innerHTML = '<span class="dname"></span><span class="ico"></span><span><span class="hi"></span> <span class="lo"></span></span>';
      cell.querySelector(".dname").textContent = i === i0 ? "Today" : DAYS[when.getDay()].slice(0, 3);
      icon(cell.querySelector(".ico"), sky(d.weather_code[i], true).icon);
      cell.querySelector(".hi").textContent = Math.round(d.temperature_2m_max[i]) + "°";
      cell.querySelector(".lo").textContent = Math.round(d.temperature_2m_min[i]) + "°";
      row.appendChild(cell);
    }
    var sun = $("w-sun");
    sun.innerHTML = '<span><span class="ico" data-icon="sunrise"></span><b></b></span><span><span class="ico" data-icon="sunset"></span><b></b></span>';
    paintIcons(sun);
    var b = sun.querySelectorAll("b");
    b[0].textContent = hm(new Date(d.sunrise[i0]), true);
    b[1].textContent = hm(new Date(d.sunset[i0]), true);
  }

  // ---------- your teams ----------
  var TEAMS = {}, games = {}, sportsAt = 0;
  (C.teams || []).forEach(function (t) { TEAMS[t.key] = t; });
  // "Tonight 7 PM", "Tomorrow 1 PM", "Fri 7 PM", "Nov 28"; compact: "7 PM", "Sun 1 PM"
  function whenText(g, compact) {
    if (g.state === "in") return "LIVE";
    var d = new Date(g.start), today = midnight(new Date()), day = midnight(d), diff = Math.round((day - today) / 86400000);
    var t = hm(d, true).replace(":00 ", " ");
    if (diff === 0) return compact ? t : (d.getHours() >= 17 ? "Tonight " : "Today ") + t;
    if (diff === 1) return compact ? DAYS[d.getDay()].slice(0, 3) + " " + t : "Tomorrow " + t;
    if (diff > 1 && diff < 7) return DAYS[d.getDay()].slice(0, 3) + " " + t;
    return MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate();
  }
  function matchup(g, short) {
    return (short ? "" : g.teamName + " ") + (g.home ? "vs " : "at ") + g.opponent;
  }
  function scoreText(g) { return g.us != null && g.them != null ? g.us + "–" + g.them + (g.detail ? " · " + g.detail.replace(/^.* - /, "") : "") : g.detail; }
  function allUpcoming(keys) {
    var out = [];
    (keys || Object.keys(TEAMS)).forEach(function (k) { out = out.concat(games[k] || []); });
    return window.Sports.upcoming(out, Date.now());
  }
  function loadSports() {
    var keys = Object.keys(TEAMS);
    if (!keys.length || !window.Sports) return;
    var left = keys.length;
    keys.forEach(function (k) {
      window.Sports.fetchTeam(TEAMS[k], get, function (err, list) {
        if (err) log("sports " + k + " " + err); else games[k] = list;
        if (--left) return;
        sportsAt = Date.now();
        store("games", games);
        drawCards();
        drawApps();
        if (sheet && sheet.refresh) sheet.refresh();
      });
    });
  }
  function sportsTick() {
    // every 10 minutes, every minute while a game is on or about to start
    var soon = allUpcoming().some(function (g) { return g.state === "in" || g.start - Date.now() < 20 * 60000; });
    if (Date.now() - sportsAt > (soon ? 60000 : 10 * 60000)) loadSports();
  }
  // ---------- the NFL box: the Panthers' next game, and the Fantasy Hub under it ----------
  var hub = kept("fantasy"), hubAt = 0, players = kept("players") || {};
  function nflWhere(g) {
    return window.Sports.where({ start: g.start, abbrs: [g.home.abbr, g.away.abbr], networks: g.networks }, { sport: "nfl" }, C);
  }
  function shortWhere(w) {
    if (!w.app) return "Not available";
    return w.label.replace(/^YouTube TV · /, "").replace(/ \(regional\)$/, " · may not air here").replace(/ · Prime Video$/, "");
  }
  function plural(n, one) { return n + " " + one + (n === 1 ? "" : "s"); }
  function whoText(g) {
    var bits = [];
    if (g.mine) bits.push(g.mine + " yours");
    if (g.theirs) bits.push(g.theirs + " theirs");
    return plural(g.players.length, "player") + " · " + bits.join(", ");
  }
  function hubGames() { return hub ? window.Fantasy.rank(hub.games).filter(function (g) { return g.state !== "post"; }) : []; }
  function loadFantasy() {
    if (!C.sleeperLeague || !window.Fantasy) return;
    var cache = { players: players };
    window.Fantasy.load(C, get, cache, function (err, h) {
      hubAt = Date.now();
      if (err) { log("fantasy " + err); return; }
      hub = h;
      store("fantasy", h);
      if (cache.changed) { players = cache.players; store("players", players); }
      drawApps();
      if (sheet && sheet.refresh) sheet.refresh();
    });
  }
  function fantasyTick() {
    var live = hubGames().some(function (g) { return g.state === "in" || g.start - Date.now() < 20 * 60000; });
    if (Date.now() - hubAt > (live ? 60000 : 10 * 60000)) loadFantasy();
  }
  // A card: two logos, a title, a line under it, and a short note on the right.
  function setCard(el, a, vs, b, title, sub, side, off) {
    var la = el.querySelector(".logos .a"), lb = el.querySelector(".logos .b");
    la.src = a || ""; la.style.visibility = a ? "" : "hidden";
    lb.src = b || ""; lb.style.visibility = b ? "" : "hidden";
    el.querySelector(".vs").textContent = vs || "";
    el.querySelector(".title").textContent = title;
    var s = el.querySelector(".sub");
    s.textContent = sub || "";
    s.className = "sub" + (off ? " off" : "");
    el.querySelector(".side").textContent = side || "";
  }
  function tint(el, left, right) {
    el.style.setProperty("--c1", left || "#2a3150");
    el.style.setProperty("--c2", right || left || "#2a3150");
  }
  var nextKey = null;
  function drawCards() {
    // the next game of any of your teams (one on now comes first)
    var g = allUpcoming()[0], el = $("nfl-card");
    nextKey = g ? g.team : null;
    if (!g) {
      tint(el, "#2a3150", "#1b2034");
      setCard(el, "", "", "", sportsAt ? "No games scheduled" : "Loading your teams…", "", "");
    } else {
      var t = TEAMS[g.team], w = window.Sports.where(g, t, C), cols = t.colors || [];
      tint(el, cols[0], cols[1]);
      var when = g.state === "in" ? "LIVE " + scoreText(g) : whenText(g);
      setCard(el, t.logo, g.home ? "vs" : "at", g.opponentLogo, (t.short || t.name) + (g.home ? " vs " : " at ") + g.opponent,
        when + " · " + shortWhere(w), [t.kind, g.note || g.venue].filter(Boolean).join(" · "), !w.app);
      el.classList.toggle("live", g.state === "in");
    }
    drawTraining();
    setGreetingSub();
  }
  // ---------- training week: Hevy workouts, read from Strava ----------
  var train = kept("training"), trainAt = 0, trainState = kept("strava") || {}, trainErr = "";
  function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60 ? m % 60 + " m" : "") : m + " min"; }
  function fmtLb(v) { return v >= 1000 ? (Math.round(v / 100) / 10).toLocaleString("en-US") + "k lb" : v + " lb"; }
  function ago(ms) {
    var diff = Math.round((midnight(new Date()) - midnight(new Date(ms))) / 86400000);
    return diff <= 0 ? "today" : diff === 1 ? "yesterday" : diff < 7 ? DAYS[new Date(ms).getDay()] : MONTHS[new Date(ms).getMonth()].slice(0, 3) + " " + new Date(ms).getDate();
  }
  function loadTraining() {
    if (!C.strava || !window.Training) return;
    var tc = { clientId: C.strava.clientId, clientSecret: C.strava.clientSecret, refreshToken: C.strava.refreshToken, rotation: C.rotation };
    window.Training.load(tc, trainState, get, post, function (st) { trainState = st; store("strava", st); }, function (err, t) {
      trainAt = Date.now();
      if (err) { trainErr = err; log("training " + err); drawTraining(); return; }
      trainErr = ""; train = t;
      store("training", t);
      drawTraining();
      if (sheet && sheet.refresh) sheet.refresh();
    });
  }
  function trainingTick() { if (Date.now() - trainAt > 15 * 60000) loadTraining(); }
  function drawTraining() {
    var el = $("train-card"), dots = el.querySelector(".dots");
    var today = (new Date().getDay() + 6) % 7;
    dots.innerHTML = "";
    "MTWTFSS".split("").forEach(function (l, i) {
      var d = document.createElement("span");
      d.className = "d" + (train && train.days[i] ? " on" : "") + (i === today ? " today" : "");
      d.innerHTML = "<i></i><em></em>";
      d.querySelector("em").textContent = l;
      dots.appendChild(d);
    });
    var title = el.querySelector(".title"), sub = el.querySelector(".sub"), side = el.querySelector(".side");
    if (!C.strava) { title.textContent = "Training week"; sub.textContent = "Connect Strava to see your Hevy workouts"; side.textContent = ""; return; }
    if (!train) { title.textContent = "Training week"; sub.textContent = trainErr ? "Couldn't reach Strava" : "Loading your workouts…"; side.textContent = ""; return; }
    title.textContent = train.workouts ? train.workouts + (train.workouts === 1 ? " workout" : " workouts") + " this week · " + fmtMin(train.minutes)
      : "No workouts yet this week";
    var l = train.last;
    sub.textContent = l ? "Last: " + l.name + " · " + ago(l.start) + (l.exercises.length ? " · " + l.exercises.length + " exercises" : " · " + fmtMin(l.minutes)) : "";
    side.textContent = [train.upNext ? "Up next: " + train.upNext : "", train.streak > 1 ? train.streak + "-week streak" : ""].filter(Boolean).join("\n");
  }
  function openTraining(back) {
    openSheet(function (s) {
      s.back = back;
      if (!train) { head(s, null, "Training", ""); opt(s, "note", "<span class='what'>Loading your workouts…</span>", null); return; }
      var lw = train.lastWeek;
      head(s, null, "Training · this week", [fmtMin(train.minutes), fmtLb(train.volume) + " lifted",
        "last week " + lw.workouts + " workouts, " + fmtLb(lw.volume)].join(" · "));
      var list = train.week.length ? train.week : (train.last ? [train.last] : []);
      if (!train.week.length && list.length) opt(s, "note", "<span class='what'>Nothing logged yet this week. Your last session:</span>", null);
      list.forEach(function (x) {
        var o = opt(s, "session", '<span class="when"></span><span class="what"></span><span class="where"></span>',
          function () { openSession(x.id, function () { openTraining(back); }); });
        o.querySelector(".when").textContent = ago(x.start).replace(/^./, function (c) { return c.toUpperCase(); });
        o.querySelector(".what").textContent = x.name;
        o.querySelector(".where").textContent = [fmtMin(x.minutes), x.exercises.length ? x.exercises.length + " exercises" : "",
          x.volume ? fmtLb(x.volume) : "", x.miles ? x.miles + " mi" : ""].filter(Boolean).join(" · ");
      });
      if (train.upNext) opt(s, "note", "<span class='what'>Up next in your rotation: " + train.upNext + "</span>", null);
    });
  }
  function openSession(id, back) {
    openSheet(function (s) {
      s.back = back;
      var x = (train.week.concat(train.last ? [train.last] : [])).filter(function (w) { return w.id === id; })[0];
      if (!x) { closeSheet(); return; }
      head(s, null, x.name + " · " + ago(x.start), [fmtMin(x.minutes), x.sets ? x.sets + " sets" : "", x.volume ? fmtLb(x.volume) : "",
        x.calories ? Math.round(x.calories) + " cal" : "", x.hr ? "avg " + Math.round(x.hr) + " bpm" : ""].filter(Boolean).join(" · "));
      var box = document.createElement("div");
      box.className = "lifts";
      x.exercises.forEach(function (e) {
        var r = document.createElement("div");
        r.className = "lift";
        r.innerHTML = '<span class="ename"></span><span class="best"></span><span class="enote"></span>';
        r.querySelector(".ename").textContent = e.name;
        r.querySelector(".best").textContent = window.Training.setText(window.Training.topSet(e)) + "  ·  " + e.sets.length + (e.sets.length === 1 ? " set" : " sets");
        r.querySelector(".enote").textContent = e.note ? "“" + e.note + "”" : "";
        box.appendChild(r);
      });
      s.panel.appendChild(box);
      opt(s, "note", "<span class='what'>Back to the week</span>", function () { closeSheet(); });
    });
  }

  function setGreetingSub() {
    var s = $("sub"), up = allUpcoming(), g = up[0];
    var live = up.filter(function (x) { return x.state === "in"; })[0];
    if (live) { var lw = window.Sports.where(live, TEAMS[live.team], C); s.textContent = "Live now: " + matchup(live) + " · " + scoreText(live) + (lw.app ? " · " + shortWhere(lw) : ""); return; }
    if (!g) { s.textContent = "Welcome home."; return; }
    var w = window.Sports.where(g, TEAMS[g.team], C), when = whenText(g);
    s.textContent = "Next up: " + matchup(g) + ", " + when.charAt(0).toLowerCase() + when.slice(1) +
      (w.app ? " on " + w.label.replace(/^YouTube TV · /, "").replace(/ \(regional\)$/, "") : "");
  }

  // ---------- the row: your apps, your teams, and everything else behind "..." ----------
  var items = [], focus = 0;
  function tvApps() {
    var list = [];
    try { list = window.TVOS ? JSON.parse(window.TVOS.apps()) : (C.demoApps || []); } catch (e) {}
    var hide = (C.hide || []).map(function (a) { return a.toLowerCase(); });
    return list.filter(function (a) {
      var l = (a.label || "").toLowerCase();
      return !hide.some(function (h) { return l.indexOf(h) === 0; });   // "2025.SmartTV" hides "2025.SmartTV.Kant"
    });
  }
  function findApp(list, name) {
    name = name.toLowerCase();
    return list.filter(function (a) { return (a.label || "").toLowerCase() === name || (a.package || "").toLowerCase() === name; })[0];
  }
  function openService(app) {
    var pkg = C.services && C.services[app];
    if (!pkg) return;
    if (window.TVOS) window.TVOS.launch(pkg); else log("open " + app);
  }
  function openApp(a) {
    store("focus", a.package || a.label);
    if (window.TVOS) window.TVOS.launch(a.package); else log("open " + a.label);
  }
  function drawApps() {
    var all = tvApps();
    items = [];
    (C.apps || []).forEach(function (name) {
      var a = findApp(all, name);
      if (a) items.push({ kind: "app", id: a.package, label: a.label, app: a });
    });
    (C.buttons || []).forEach(function (b) { items.push({ kind: "team", id: "team:" + b.label, label: b.label, button: b }); });
    if (C.sleeperLeague) items.push({ kind: "fantasy", id: "fantasy", label: "Fantasy" });
    items.push({ kind: "more", id: "more", label: "•••" });
    var nav = $("apps");
    nav.innerHTML = '<div class="track"></div>';
    var track = nav.firstChild;
    items.forEach(function (it, i) {
      if (i && it.kind !== items[i - 1].kind && it.kind === "team") {
        var d = document.createElement("div"); d.className = "app divider"; track.appendChild(d);
      }
      var b = document.createElement("div");
      b.className = "app " + it.kind;
      if (it.kind === "team") {
        var t = TEAMS[it.button.teams[0]], up = allUpcoming(it.button.teams), g = up[0];
        b.innerHTML = '<img class="logo" alt=""><span class="lbl"></span><span class="st"></span>';
        b.querySelector(".logo").src = t ? t.logo : "";
        b.querySelector(".lbl").textContent = it.label;
        var st = b.querySelector(".st");
        if (g && g.state === "in") { st.textContent = "LIVE"; st.className = "st live"; }
        else if (g && g.start - Date.now() < 6 * 86400000) st.textContent = whenText(g, true);
        else st.parentNode.removeChild(st);
      } else if (it.kind === "fantasy") {
        b.innerHTML = '<span class="lbl">Fantasy</span><span class="st"></span>';
        var fs = b.querySelector(".st");
        if (hub && hub.them) fs.textContent = hub.me.points.toFixed(1) + "–" + hub.them.points.toFixed(1);
        else fs.parentNode.removeChild(fs);
      } else b.textContent = it.label;
      it.el = b;
      track.appendChild(b);
    });
    var want = kept("focus");
    focus = 0;
    items.forEach(function (it, i) { if (it.id === want) focus = i; });
    showFocus();
  }
  function showFocus() {
    items.forEach(function (it, i) { it.el.classList.toggle("focus", i === focus && !sheet && !cardAt); });
    var el = items[focus] && items[focus].el, track = document.querySelector(".apps .track");
    if (!el || !track) return;
    var nav = $("apps"), right = el.offsetLeft + el.offsetWidth + 120, shift = 0;
    if (right > nav.clientWidth) shift = right - nav.clientWidth;
    track.style.transform = "translateX(" + (-shift) + "px)";
  }
  function activate(it) {
    store("focus", it.id);
    if (it.kind === "app") openApp(it.app);
    else if (it.kind === "more") openMore();
    else if (it.kind === "fantasy") openFantasy();
    else if (it.button.teams.length > 1) openChooser(it.button);
    else openTeam(it.button.teams[0]);
  }

  // ---------- panels over the home (a team's games, UNC's two teams, all apps) ----------
  var sheet = null;   // {el, opts: [{el, act}], cols, at, back}
  function openSheet(build) {
    closeSheet(true);
    var el = document.createElement("div");
    el.className = "sheet";
    el.innerHTML = '<div class="panel"></div>';
    document.body.appendChild(el);
    sheet = { el: el, panel: el.firstChild, opts: [], cols: 1, at: 0, build: build };
    sheet.refresh = function () { var at = sheet.at; sheet.panel.innerHTML = ""; sheet.opts = []; build(sheet); sheet.at = Math.min(at, sheet.opts.length - 1); sheetFocus(); };
    sheet.refresh();
    showFocus();
  }
  function closeSheet(quiet) {
    if (!sheet) return;
    var back = sheet.back;
    sheet.el.parentNode.removeChild(sheet.el);
    sheet = null;
    if (back && !quiet) back(); else showFocus();
  }
  function sheetFocus() {
    sheet.opts.forEach(function (o, i) { o.el.classList.toggle("focus", i === sheet.at); });
    var o = sheet.opts[sheet.at];
    if (o && o.el.scrollIntoView) o.el.scrollIntoView({ block: "nearest" });
  }
  function head(s, logo, title, sub) {
    var h = document.createElement("div");
    h.className = "sheet-head";
    h.innerHTML = (logo ? '<img class="logo" alt="">' : "") + '<div><h3></h3><p></p></div>';
    if (logo) h.querySelector(".logo").src = logo;
    h.querySelector("h3").textContent = title;
    h.querySelector("p").textContent = sub || "";
    s.panel.appendChild(h);
  }
  function opt(s, cls, html, act) {
    var o = document.createElement("div");
    o.className = "opt " + (cls || "");
    o.innerHTML = html;
    s.panel.appendChild(o);
    s.opts.push({ el: o, act: act });
    return o;
  }

  var standings = {};   // team key -> {at, data}
  function teamStandings(key) {
    var c = standings[key];
    if (c && Date.now() - c.at < 30 * 60000) return c.data;
    if (!c || !c.loading) {
      standings[key] = { at: c ? c.at : 0, data: c ? c.data : null, loading: true };
      window.Sports.fetchStandings(TEAMS[key], get, function (err, d) {
        standings[key] = { at: Date.now(), data: err ? (c && c.data) : d };
        if (err) log("standings " + key + " " + err);
        if (sheet && sheet.team === key && sheet.refresh) sheet.refresh();
      });
    }
    return c ? c.data : null;
  }
  function split(s) {
    s.panel.classList.add("wide");
    var row = document.createElement("div"), left = document.createElement("div"), right = document.createElement("div");
    row.className = "split"; left.className = "col"; right.className = "col side-col";
    row.appendChild(left); row.appendChild(right);
    s.panel.appendChild(row);
    return { left: left, right: right };
  }
  function drawTable(box, t, st) {
    var h = document.createElement("h4");
    h.textContent = st ? st.name : "Standings";
    box.appendChild(h);
    if (!st) { var p = document.createElement("p"); p.className = "muted"; p.textContent = "Loading standings…"; box.appendChild(p); return; }
    var college = t.sport === "college", table = document.createElement("div");
    table.className = "table" + (st.rows.length > 10 ? " dense" : "");
    var head = document.createElement("div");
    head.className = "tr th";
    head.innerHTML = "<span></span><span>Team</span><span>" + (college ? "Conf" : "W-L") + "</span><span>" + (college ? "Overall" : "GB") + "</span><span>Strk</span>";
    table.appendChild(head);
    var list = document.createElement("div");
    list.className = "rows";
    table.appendChild(list);
    st.rows.forEach(function (r, i) {
      var tr = document.createElement("div");
      tr.className = "tr" + (r.us ? " us" : "");
      tr.innerHTML = '<span class="rk"></span><span class="tm"><img alt=""><b></b></span><span></span><span></span><span></span>';
      var c = tr.children;
      c[0].textContent = i + 1;
      c[1].querySelector("img").src = r.logo;
      c[1].querySelector("b").textContent = r.name;
      c[2].textContent = college ? r.conf : r.record;
      c[3].textContent = college ? r.record : (r.gb === "0" || r.gb === "-" ? "–" : r.gb);
      c[4].textContent = r.streak;
      list.appendChild(tr);
    });
    box.appendChild(table);
    return list;
  }
  // Right moves into the standings, Up/Down then scroll them a row at a time, Left goes back.
  function standingsKeys(s, list) {
    if (!list) return;
    var us = list.querySelector(".us");
    if (s.scroll != null) list.scrollTop = s.scroll;
    else if (us) list.scrollTop = Math.max(0, us.offsetTop - (list.clientHeight - us.offsetHeight) / 2);
    s.scroll = list.scrollTop;
    list.parentNode.classList.toggle("active", !!s.inTable);
    s.keys = function (k) {
      var row = (list.firstChild && list.firstChild.offsetHeight + 4) || 40;
      if (k === 39 && !s.inTable) s.inTable = true;
      else if (k === 37 && s.inTable) s.inTable = false;
      else if (s.inTable && (k === 38 || k === 40)) list.scrollTop += k === 40 ? row : -row;
      else if (s.inTable && k === 13) return true;
      else return false;
      s.scroll = list.scrollTop;
      list.parentNode.classList.toggle("active", !!s.inTable);
      s.opts.forEach(function (o, i) { o.el.classList.toggle("focus", i === s.at && !s.inTable); });
      return true;
    };
  }
  function openTeam(key, back) {
    var t = TEAMS[key];
    openSheet(function (s) {
      s.back = back;
      s.team = key;
      var up = allUpcoming([key]);
      head(s, t.logo, t.full || t.name, up.length ? "Next " + Math.min(up.length, 5) + " games" : "");
      var cols = split(s), keep = s.panel;
      s.panel = cols.left;
      if (!up.length) opt(s, "note", "<span class='what'>No games scheduled right now.</span>", null);
      up.slice(0, 5).forEach(function (g) {
        var w = window.Sports.where(g, t, C);
        var o = opt(s, "game" + (g.state === "in" ? " now" : "") + (w.app ? "" : " off"),
          '<img class="logo" alt=""><span class="when"></span><span class="what"></span><span class="where"></span><span class="note"></span>',
          function () {
            if (w.app) { closeSheet(true); openService(w.app); }
          });
        o.querySelector(".logo").src = g.opponentLogo || t.logo;
        o.querySelector(".when").textContent = g.state === "in" ? "LIVE " + scoreText(g) : whenText(g, true);
        o.querySelector(".what").textContent = matchup(g, true);
        o.querySelector(".where").textContent = w.app ? w.label.replace(/^YouTube TV · /, "YouTube TV · ") : w.label;
        o.querySelector(".note").textContent = w.note || (w.leaguePass ? "Opens Prime Video. Pick the game in the NBA League Pass channel." : "");
      });
      s.panel = keep;
      s.panel.classList.add("team");
      standingsKeys(s, drawTable(cols.right, t, teamStandings(key)));
    });
  }
  // the weather: the Cleveland radar loop beside the hourly forecast, which scrolls
  function openWeather(back) {
    openSheet(function (s) {
      s.back = back;
      var w = kept("weather"), cur = w && w.current;
      head(s, null, "Weather · " + (C.place || ""), cur ? Math.round(cur.temperature_2m) + "° " + sky(cur.weather_code, cur.is_day).text.toLowerCase() + " now" : "");
      var cols = split(s);
      cols.left.classList.add("radar-col");
      var img = document.createElement("img");
      img.className = "radar";
      img.alt = "";
      img.src = (C.radar || "https://radar.weather.gov/ridge/standard/KCLE_loop.gif") + "?t=" + Math.floor(Date.now() / 300000);
      cols.left.appendChild(img);
      var cap = document.createElement("p");
      cap.className = "muted";
      cap.textContent = "Radar, last hour · National Weather Service, Cleveland";
      cols.left.appendChild(cap);
      cols.right.classList.add("hours-col");
      var keep = s.panel;
      s.panel = cols.right;
      var h = w && w.hourly, now = Date.now(), shown = 0;
      (h ? h.time : []).forEach(function (t, i) {
        var p = t.split(/[-T:]/), ms = new Date(+p[0], +p[1] - 1, +p[2], +p[3]).getTime();
        if (ms + 3600000 <= now || shown >= 48) return;
        shown++;
        var d = new Date(ms), first = shown === 1 || d.getHours() === 0;
        var o = opt(s, "hourrow" + (h.precipitation_probability[i] >= 40 ? " wet" : ""),
          '<span class="when"></span><span class="ico"></span><b class="temp"></b><span class="rain"></span><span class="wind"></span>', null);
        o.querySelector(".when").textContent = (shown === 1 ? "Now" : hm(d, true).replace(":00 ", " ")) +
          (first && shown > 1 ? " · " + DAYS[d.getDay()].slice(0, 3) : "");
        icon(o.querySelector(".ico"), sky(h.weather_code[i], h.is_day[i]).icon);
        o.querySelector(".temp").textContent = Math.round(h.temperature_2m[i]) + "°";
        o.querySelector(".rain").textContent = h.precipitation_probability[i] >= 10 ? h.precipitation_probability[i] + "% rain" : "";
        o.querySelector(".wind").textContent = Math.round(h.wind_speed_10m[i]) + " mph";
      });
      if (!shown) opt(s, "note", "<span class='what'>Loading the hourly forecast…</span>", null);
      s.panel = keep;
    });
  }
  function openChooser(button) {
    openSheet(function (s) {
      head(s, TEAMS[button.teams[0]].logo, button.label, "Pick a team");
      button.teams.forEach(function (k) {
        var t = TEAMS[k], g = allUpcoming([k])[0];
        var o = opt(s, "choice", '<span class="what"></span><span class="where"></span>', function () {
          openTeam(k, function () { openChooser(button); });
        });
        o.querySelector(".what").textContent = t.name.replace(/^UNC /, "");
        o.querySelector(".where").textContent = g ? (g.state === "in" ? "LIVE · " : "Next: ") + matchup(g, true) + (g.state === "in" ? "" : " · " + whenText(g)) : "No games scheduled";
      });
    });
  }
  function openMore() {
    openSheet(function (s) {
      s.cols = 4;
      head(s, null, "All apps", "");
      var grid = document.createElement("div");
      grid.className = "grid";
      s.panel.appendChild(grid);
      var keep = s.panel;
      s.panel = grid;
      tvApps().sort(function (a, b) { return a.label.localeCompare(b.label); }).forEach(function (a) {
        var o = opt(s, "tile", "", function () { closeSheet(true); openApp(a); });
        o.textContent = a.label;
      });
      s.panel = keep;
    });
  }

  // ---------- Fantasy Hub panels ----------
  function openFantasy(back) {
    openSheet(function (s) {
      s.back = back;
      var list = hubGames();
      head(s, null, "Fantasy · Week " + (hub ? hub.week : ""),
        hub && hub.them ? hub.me.name + "  " + hub.me.points.toFixed(1) + " – " + hub.them.points.toFixed(1) + "  " + hub.them.name : "");
      if (!list.length) { opt(s, "note", "<span class='what'>No games left with your players this week.</span>", null); return; }
      list.forEach(function (g) {
        var w = nflWhere(g);
        var o = opt(s, "game fan" + (g.state === "in" ? " now" : "") + (w.app ? "" : " off"),
          '<img class="logo" alt=""><span class="when"></span><span class="what"></span><span class="where"></span><span class="note"></span>',
          function () { openFantasyGame(g.id); });
        o.querySelector(".note").textContent = w.app ? "Watch on " + w.label : w.label + " · not available";
        o.querySelector(".logo").src = g.away.logo;
        o.querySelector(".when").textContent = g.state === "in" ? "LIVE " + g.away.score + "–" + g.home.score : whenText(g);
        o.querySelector(".what").textContent = g.away.name + " at " + g.home.name;
        o.querySelector(".where").textContent = whoText(g);
      });
    });
  }
  function openFantasyGame(id) {
    openSheet(function (s) {
      s.back = function () { openFantasy(); };
      var g = (hub ? hub.games : []).filter(function (x) { return x.id === id; })[0];
      if (!g) { closeSheet(); return; }
      var w = nflWhere(g);
      head(s, g.home.logo, g.away.name + " at " + g.home.name,
        (g.state === "in" ? "LIVE " + g.away.score + "–" + g.home.score + " · " + g.detail : whenText(g)) + " · " + plural(g.players.length, "player"));
      var box = document.createElement("div");
      box.className = "roster";
      g.players.slice().sort(function (a, b) { return (a.side > b.side) - (a.side < b.side); }).forEach(function (p) {
        var r = document.createElement("div");
        r.className = "who " + p.side;
        r.innerHTML = '<span class="tag"></span><span class="pname"></span><span class="pos"></span>';
        r.querySelector(".tag").textContent = p.side === "mine" ? "Yours" : "Theirs";
        r.querySelector(".pname").textContent = p.n;
        r.querySelector(".pos").textContent = p.p + " · " + p.t;
        box.appendChild(r);
      });
      s.panel.appendChild(box);
      var o = opt(s, "watch" + (w.app ? "" : " off"), '<span class="what"></span><span class="note"></span>', function () {
        if (w.app) { closeSheet(true); openService(w.app); }
      });
      o.querySelector(".what").textContent = w.app ? "Watch on " + w.label : w.label + " · not available";
      o.querySelector(".note").textContent = w.note || "";
    });
  }

  // ---------- the remote ----------
  // Focus lives in the bottom row. Up reaches the boxes: training first, the game box above it,
  // Left and Right cross to the weather box; Down from a bottom box comes back to the row.
  var cardAt = null, BOXES = ["weather", "nfl-card", "train-card"];
  function showCardFocus() {
    BOXES.forEach(function (id) { $(id).classList.toggle("focus", id === cardAt && !sheet); });
    showFocus();
  }
  function openBox(id) {
    if (id === "weather") openWeather();
    else if (id === "train-card") openTraining();
    else if (nextKey) openTeam(nextKey);
  }
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    if (sheet) {
      if (sheet.keys && k !== 10009 && k !== 8 && k !== 27 && sheet.keys(k)) { e.preventDefault(); return; }
      var n = sheet.opts.length, c = sheet.cols, at = sheet.at;
      if (k === 38) at = at - c >= 0 ? at - c : at;
      else if (k === 40) at = at + c < n ? at + c : at;
      else if (k === 37 && c > 1) at = at % c ? at - 1 : at;
      else if (k === 39 && c > 1) at = (at % c) < c - 1 && at + 1 < n ? at + 1 : at;
      else if (k === 13) { var o = sheet.opts[at]; if (o && o.act) o.act(); e.preventDefault(); return; }
      else if (k === 10009 || k === 8 || k === 27) { closeSheet(); showCardFocus(); e.preventDefault(); return; }
      else return;
      sheet.at = at; sheetFocus(); e.preventDefault();
      return;
    }
    if (cardAt) {
      if (k === 38 && cardAt === "train-card") cardAt = "nfl-card";
      else if (k === 40) cardAt = cardAt === "nfl-card" ? "train-card" : null;
      else if (k === 37 && cardAt !== "weather") cardAt = "weather";
      else if (k === 39 && cardAt === "weather") cardAt = "train-card";
      else if (k === 13) openBox(cardAt);
      else if (k === 10009 || k === 8 || k === 27) cardAt = null;
      else if (k === 38 || k === 37 || k === 39) { e.preventDefault(); return; }
      else return;
      showCardFocus(); e.preventDefault();
      return;
    }
    if (k === 37 && focus > 0) { focus--; showFocus(); }
    else if (k === 39 && focus < items.length - 1) { focus++; showFocus(); }
    else if (k === 38) { cardAt = "train-card"; showCardFocus(); }
    else if (k === 13 && items[focus]) activate(items[focus]);
    else return;
    e.preventDefault();
  });

  // ---------- start ----------
  $("eyebrow").textContent = C.place || "";
  games = kept("games") || {};
  paintIcons();
  drawWeather(kept("weather"));
  tick();
  drawApps();
  setInterval(tick, 1000);
  loadWeather();
  setInterval(loadWeather, 15 * 60000);
  loadSports();
  loadFantasy();
  loadTraining();
  setInterval(function () { sportsTick(); fantasyTick(); trainingTick(); }, 30000);
  // back from an app, or the TV waking: fresh data, and the app list may have changed
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    lastMinute = -1; tick();
    var w = kept("weather");
    if (!w || Date.now() - w.at > 10 * 60000) loadWeather();
    loadSports();
    loadFantasy();
    trainingTick();
    drawApps();
  });
  // desktop preview only (no TV): #team=<key>, #pick=<button>, #fantasy, #game=<n> or #more opens that panel
  if (!window.TVOS && location.hash) setTimeout(function () {
    var h = location.hash.slice(1).split("=");
    if (h[0] === "team") openTeam(h[1]);
    else if (h[0] === "pick") openChooser((C.buttons || []).filter(function (b) { return b.label === h[1]; })[0]);
    else if (h[0] === "fantasy") openFantasy();
    else if (h[0] === "game") { var g = hubGames()[+h[1] || 0]; if (g) openFantasyGame(g.id); }
    else if (h[0] === "more") openMore();
    else if (h[0] === "training") openTraining();
    else if (h[0] === "session") { if (train && train.last) openSession(train.last.id); }
    else if (h[0] === "up") { cardAt = BOXES[+h[1] || 0]; showCardFocus(); }
    else if (h[0] === "weather") openWeather();
  }, 6000);
})();
