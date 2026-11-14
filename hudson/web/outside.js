// Outside today: should you get out? The next hours' rain chance and temperature, sunset, air
// quality and any National Weather Service alert for home, or the moon after dark. Free sources
// with no key (Open-Meteo, api.weather.gov). Plain ES5; Node runs it in hudson/test-outside.js.
(function (root) {
  "use strict";

  var WET = 40;   // % chance of rain or snow from which an hour counts as wet

  function hm(d) {
    var h = d.getHours() % 12 || 12, m = d.getMinutes();
    return h + (m ? ":" + ("0" + m).slice(-2) : "") + (d.getHours() < 12 ? " AM" : " PM");
  }
  function snowy(code) { return (code >= 71 && code <= 77) || code === 85 || code === 86; }

  function aqiText(aqi) {
    if (aqi == null) return "";
    var t = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for sensitive groups" :
      aqi <= 200 ? "Unhealthy" : aqi <= 300 ? "Very unhealthy" : "Hazardous";
    return "Air " + t.toLowerCase();
  }

  // the moon tonight, from a known new moon (6 Jan 2000, 18:14 UTC) and the synodic month
  function moon(ms) {
    var f = ((ms - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / 29.530588853) % 1;
    if (f < 0) f += 1;
    var lit = Math.round((1 - Math.cos(2 * Math.PI * f)) / 2 * 100);
    var name = f < .03 || f > .97 ? "New moon" : f < .22 ? "Waxing crescent" : f < .28 ? "First quarter" :
      f < .47 ? "Waxing gibbous" : f < .53 ? "Full moon" : f < .72 ? "Waning gibbous" : f < .78 ? "Last quarter" : "Waning crescent";
    return { phase: f, lit: lit, name: name };
  }

  // hours from now on: [{t, temp, rain, code, wind}]
  function hoursFrom(w, now) {
    var h = (w && w.hourly) || {}, out = [];
    (h.time || []).forEach(function (t, i) {
      var p = t.split(/[-T:]/), ms = new Date(+p[0], +p[1] - 1, +p[2], +p[3], +(p[4] || 0)).getTime();
      if (ms + 3600000 > now) out.push({ t: ms, temp: h.temperature_2m[i], rain: h.precipitation_probability[i] || 0,
        code: h.weather_code[i], wind: h.wind_speed_10m[i] });
    });
    return out;
  }

  // {mood: "day" | "night" | "wet" | "alert", title, sub, side, hours, moon}
  function summarize(w, aqi, alerts, now, sunrise, sunset) {
    var hours = hoursFrom(w, now).slice(0, 12), m = moon(now);
    var bits = [], a = aqiText(aqi);
    if (alerts && alerts.length) {
      var x = alerts[0];
      return { mood: "alert", title: x.event, sub: x.headline || "", side: alerts.length > 1 ? "+" + (alerts.length - 1) + " more alert" + (alerts.length > 2 ? "s" : "") : "Weather alert",
        hours: hours, moon: m };
    }
    if (!hours.length) return { mood: "day", title: "Outside", sub: "", side: "", hours: hours, moon: m };
    var dark = now >= sunset || now < sunrise, h0 = hours[0];
    if (dark) {
      bits.push(m.name + " · " + m.lit + "% lit");
      if (a) bits.push(a);
      var sky = h0.rain >= WET ? (snowy(h0.code) ? "Snow tonight" : "Rain tonight") : h0.code <= 1 ? "Clear tonight" : h0.code <= 2 ? "Some clouds tonight" : "Cloudy tonight";
      return { mood: h0.rain >= WET ? "wet" : "night", title: sky + " · " + Math.round(h0.temp) + "°", sub: bits.join(" · "),
        side: "Sunrise " + hm(new Date(sunrise + (now >= sunset ? 86400000 : 0))), hours: hours, moon: m };
    }
    // daytime: how long it stays dry, or when it dries out
    var firstWet = -1, firstDry = -1;
    for (var i = 0; i < hours.length; i++) {
      if (firstWet < 0 && hours[i].rain >= WET) firstWet = i;
      if (firstDry < 0 && hours[i].rain < WET) firstDry = i;
    }
    var title, mood = "day", word = function (x) { return snowy(x.code) ? "Snow" : "Rain"; };
    if (firstWet === 0) {
      mood = "wet";
      title = word(h0) + " now" + (firstDry > 0 ? " · dry from " + hm(new Date(hours[firstDry].t)) : " · an inside day");
    } else if (firstWet > 0 && hours[firstWet].t < sunset) {
      title = "Dry and " + Math.round(h0.temp) + "° until " + hm(new Date(hours[firstWet].t));
    } else {
      title = "Dry and " + Math.round(h0.temp) + "° until dark";
    }
    bits.push("Sunset " + hm(new Date(sunset)));
    if (a) bits.push(a);
    if (h0.wind >= 12) bits.push("Wind " + Math.round(h0.wind) + " mph");
    return { mood: mood, title: title, sub: bits.join(" · "), side: "", hours: hours, moon: m };
  }

  function load(cfg, get, done) {
    var out = {}, left = 3;
    function step() { if (!--left) done(null, out); }
    get("https://api.open-meteo.com/v1/forecast?latitude=" + cfg.lat + "&longitude=" + cfg.lon +
      "&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&temperature_unit=fahrenheit" +
      "&wind_speed_unit=mph&timezone=auto&forecast_hours=24", 15000, function (err, text) {
      if (!err) try { out.weather = JSON.parse(text); } catch (e) {}
      step();
    });
    get("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + cfg.lat + "&longitude=" + cfg.lon +
      "&current=us_aqi&timezone=auto", 15000, function (err, text) {
      if (!err) try { out.aqi = JSON.parse(text).current.us_aqi; } catch (e) {}
      step();
    });
    get("https://api.weather.gov/alerts/active?point=" + cfg.lat + "," + cfg.lon, 15000, function (err, text) {
      out.alerts = [];
      if (!err) try {
        out.alerts = (JSON.parse(text).features || []).map(function (f) {
          var p = f.properties || {};
          return { event: p.event, headline: p.headline, description: p.description, ends: p.ends || p.expires };
        });
      } catch (e) {}
      step();
    });
  }

  var Outside = { load: load, summarize: summarize, moon: moon, aqiText: aqiText };
  if (typeof module !== "undefined" && module.exports) module.exports = Outside;
  else root.Outside = Outside;
})(this);
