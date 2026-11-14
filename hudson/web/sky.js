// The Tetons follow the real sky at home: the photo is graded for the light (bright day, golden
// hour, dusk, night), a grey haze comes in with the cloud cover, stars come out on a clear night, and rain,
// snow, fog or a storm play over the scene. Driven by Open-Meteo's current weather (already loaded
// for the weather card) and the day's sunrise and sunset.
// Layers (index.html): photo, the glass clock, the mountain cut-out, then .sky (a wash for the light
// and the cloud cover, stars high up) and .weatherfx (fog, rain, snow, lightning) over the whole
// scene, then the scrim and the cards. Plain ES5.
(function (root) {
  "use strict";

  // what the sky is doing: {light: "day" | "golden" | "dusk" | "night", cover: 0..1, precip: "" | "rain" | "snow",
  // heavy: bool, fog: bool, storm: bool}
  function mood(code, isDay, now, sunrise, sunset) {
    var light = "day", H = 3600000;
    if (now < sunrise - .6 * H || now > sunset + .6 * H) light = "night";
    else if (now < sunrise + .15 * H || now > sunset - .15 * H) light = "dusk";
    else if (now < sunrise + 1.2 * H || now > sunset - 1.2 * H) light = "golden";
    var m = { light: light, cover: 0, precip: "", heavy: false, fog: false, storm: false };
    if (code === 1) m.cover = .2;
    else if (code === 2) m.cover = .5;
    else if (code === 3) m.cover = .85;
    else if (code === 45 || code === 48) { m.cover = .8; m.fog = true; }
    else if (code >= 51 && code <= 57) { m.cover = .85; m.precip = "rain"; }
    else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) { m.cover = .95; m.precip = "rain"; m.heavy = code === 65 || code === 67 || code === 82; }
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) { m.cover = .9; m.precip = "snow"; m.heavy = code === 75 || code === 86; }
    else if (code >= 95) { m.cover = 1; m.precip = "rain"; m.heavy = true; m.storm = true; }
    return m;
  }

  // CSS filter for the photo and the cut-out, so the mountains and the sky change together
  function grade(m) {
    var f = { day: "brightness(1.06) saturate(1.12)", golden: "brightness(1.04) saturate(1.2) sepia(.22) hue-rotate(-8deg)",
      dusk: "brightness(.78) saturate(.95) hue-rotate(8deg)", night: "brightness(.42) saturate(.6) hue-rotate(14deg) contrast(1.05)" }[m.light];
    if (m.cover > .6) f += " saturate(" + (1 - (m.cover - .6) * .9).toFixed(2) + ") contrast(.94)";
    if (m.precip) f += " brightness(.86)";
    return f;
  }

  // ---------- the page side ----------
  var el = {}, state = null, raf = 0, drops = [], last = 0, flashAt = 0;

  function stars(canvas) {
    var c = canvas.getContext("2d"), w = canvas.width, h = canvas.height, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    c.clearRect(0, 0, w, h);
    for (var i = 0; i < 420; i++) {
      var x = rnd() * w, y = rnd() * h * .62, r = rnd() < .08 ? 1.6 : rnd() * .9 + .35;
      c.globalAlpha = (1 - y / (h * .7)) * (.35 + rnd() * .65);
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    }
  }

  function setup() {
    el.sky = document.querySelector(".sky");
    el.fx = document.querySelector(".weatherfx");
    if (!el.sky || !el.fx) return false;
    el.stars = el.sky.querySelector("canvas.stars");
    el.rain = el.fx.querySelector("canvas.precip");
    el.stars.width = 1920; el.stars.height = 1080;
    el.rain.width = 960; el.rain.height = 540;   // drawn at half size, scaled up: cheap on a TV
    stars(el.stars);
    return true;
  }

  function seedDrops(m) {
    drops = [];
    var n = m.precip === "snow" ? (m.heavy ? 260 : 150) : (m.heavy ? 230 : 120);
    for (var i = 0; i < n; i++) drops.push({ x: Math.random() * 960, y: Math.random() * 540, z: .4 + Math.random() * .6 });
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return;          // about 30 frames a second
    var dt = Math.min(80, t - last) / 16.7;
    last = t;
    var m = state, c = el.rain.getContext("2d");
    c.clearRect(0, 0, 960, 540);
    if (m.precip === "rain") {
      c.strokeStyle = "rgba(220,232,255,.55)"; c.lineCap = "round";
      drops.forEach(function (d) {
        var len = 10 + 14 * d.z, vy = (9 + 9 * d.z) * dt, vx = -1.6 * d.z * dt;
        c.globalAlpha = .25 + .45 * d.z; c.lineWidth = .6 + .7 * d.z;
        c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x - len * .16, d.y + len); c.stroke();
        d.y += vy; d.x += vx;
        if (d.y > 545) { d.y = -20; d.x = Math.random() * 1000; }
      });
    } else if (m.precip === "snow") {
      c.fillStyle = "#fff";
      drops.forEach(function (d) {
        c.globalAlpha = .35 + .55 * d.z;
        c.beginPath(); c.arc(d.x, d.y, .8 + 1.6 * d.z, 0, 6.283); c.fill();
        d.y += (.6 + 1.1 * d.z) * dt; d.x += Math.sin((t / 900) + d.z * 9) * .5 * dt;
        if (d.y > 545) { d.y = -6; d.x = Math.random() * 960; }
      });
    }
    if (m.storm && t > flashAt) {
      flashAt = t + 9000 + Math.random() * 16000;
      el.fx.classList.remove("flash"); void el.fx.offsetWidth; el.fx.classList.add("flash");
    }
  }

  function apply(m) {
    if (!el.sky && !setup()) return;
    state = m;
    var g = grade(m), b = document.body;
    document.querySelector(".bg").style.filter = g;
    var fg = document.querySelector(".fg");
    if (fg) fg.style.filter = g;
    b.setAttribute("data-light", m.light);
    el.sky.style.setProperty("--cover", m.cover);
    el.sky.classList.toggle("starry", m.light === "night" && m.cover < .6);
    el.fx.classList.toggle("fog", m.fog);
    el.fx.classList.toggle("wet", !!m.precip);
    cancelAnimationFrame(raf);
    el.rain.getContext("2d").clearRect(0, 0, 960, 540);
    if (m.precip) { seedDrops(m); last = 0; raf = requestAnimationFrame(frame); }
  }

  function pause() { cancelAnimationFrame(raf); raf = 0; }
  function resume() { if (state && state.precip && !raf) raf = requestAnimationFrame(frame); }

  var Sky = { mood: mood, grade: grade, apply: apply, pause: pause, resume: resume };
  if (typeof module !== "undefined" && module.exports) module.exports = Sky;
  else root.Sky = Sky;
})(this);
