// TZ=America/New_York node hudson/test-outside.js
"use strict";
var assert = require("assert");
var O = require("./web/outside.js");

// a known full moon (2026-11-24 14:53 UTC) and new moon (2026-11-09 07:02 UTC)
assert.strictEqual(O.moon(Date.UTC(2026, 10, 24, 15)).name, "Full moon");
assert.ok(O.moon(Date.UTC(2026, 10, 24, 15)).lit >= 98);
assert.strictEqual(O.moon(Date.UTC(2026, 10, 9, 8)).name, "New moon");
assert.strictEqual(O.aqiText(32), "Air good");
assert.strictEqual(O.aqiText(120), "Air unhealthy for sensitive groups");

function weather(rain, code) {
  var time = [], t = [], p = [], c = [], w = [];
  for (var i = 0; i < 12; i++) {
    var h = 13 + i;
    time.push("2026-11-14T" + ("0" + (h % 24)).slice(-2) + ":00");
    t.push(44 - i); p.push(rain[i] || 0); c.push(code == null ? 3 : code); w.push(6);
  }
  return { hourly: { time: time, temperature_2m: t, precipitation_probability: p, weather_code: c, wind_speed_10m: w } };
}
var now = new Date(2026, 10, 14, 13, 10).getTime();
var sunrise = new Date(2026, 10, 14, 7, 13).getTime(), sunset = new Date(2026, 10, 14, 17, 6).getTime();

var dry = O.summarize(weather([]), 32, [], now, sunrise, sunset);
assert.strictEqual(dry.title, "Dry and 44° until dark");
assert.strictEqual(dry.sub, "Sunset 5:06 PM · Air good");

var later = O.summarize(weather([0, 0, 10, 60, 80]), 32, [], now, sunrise, sunset);
assert.strictEqual(later.title, "Dry and 44° until 4 PM");

var wet = O.summarize(weather([70, 60, 20]), null, [], now, sunrise, sunset);
assert.strictEqual(wet.mood, "wet"); assert.strictEqual(wet.title, "Rain now · dry from 3 PM");
assert.strictEqual(O.summarize(weather([70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70], 73), null, [], now, sunrise, sunset).title, "Snow now · an inside day");

var night = O.summarize(weather([], 0), 32, [], new Date(2026, 10, 14, 20, 0).getTime(), sunrise, sunset);
assert.strictEqual(night.mood, "night"); assert.ok(/^Clear tonight/.test(night.title)); assert.ok(/moon|crescent|quarter|gibbous/i.test(night.sub));
assert.strictEqual(night.side, "Sunrise 7:13 AM");

var alert = O.summarize(weather([]), 32, [{ event: "Lake Effect Snow Warning", headline: "until 7 PM Sunday" }], now, sunrise, sunset);
assert.strictEqual(alert.mood, "alert"); assert.strictEqual(alert.title, "Lake Effect Snow Warning");
console.log("outside: all checks passed");
