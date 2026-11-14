// TZ=America/New_York node hudson/test-training.js
"use strict";
var assert = require("assert");
var T = require("./web/training.js");

// the shape Hevy writes into Strava
var desc = [
  "Logged with hevyapp.com", "",
  "Pull Up (Weighted)", "Set 1: 25 lbs x 8 ", "Set 2: 25 lbs x 6 ", "Set 3: 0 lbs x 8 ", "",
  "Hammer Curl (Dumbbell)", "\"Disgusting drop set\"", "Set 1: 35 lbs x 15 ", "Set 2: 40 lbs x 10 ", "",
  "Plank", "Set 1: 1min 30s", "Set 2: 45s", "",
  "Push Up", "Set 1: x 20", "Set 2: 15 reps", "",
  "Row (Machine)", "Set 1: 60 kg x 10"
].join("\n");
var ex = T.parse(desc);
assert.deepStrictEqual(ex.map(function (e) { return e.name; }), ["Pull Up (Weighted)", "Hammer Curl (Dumbbell)", "Plank", "Push Up", "Row (Machine)"]);
assert.strictEqual(ex[1].note, "Disgusting drop set");
assert.strictEqual(T.setText(T.topSet(ex[0])), "25 lb × 8");
assert.strictEqual(T.setText(T.topSet(ex[1])), "40 lb × 10");
assert.strictEqual(T.setText(T.topSet(ex[2])), "1:30");
assert.strictEqual(T.setText(T.topSet(ex[3])), "20 reps");
assert.strictEqual(T.volume([ex[1]]), 35 * 15 + 40 * 10);
assert.strictEqual(T.volume([ex[4]]), Math.round(60 * 2.20462 * 10));

// rotation and streaks
assert.strictEqual(T.upNext([{ name: "Legs" }, { name: "Pull" }]), "Push");
assert.strictEqual(T.upNext([{ name: "Morning Run" }, { name: "Push" }]), "Pull");
var now = new Date(2026, 10, 14, 15).getTime();                 // Saturday
assert.strictEqual(new Date(T.weekStart(now)).getDay(), 1);       // Monday
var at = function (y, m, d) { return { start: new Date(y, m - 1, d, 18).getTime() }; };
assert.strictEqual(T.streak([at(2026, 11, 13), at(2026, 11, 4), at(2026, 10, 29)], now), 3);
assert.strictEqual(T.streak([at(2026, 11, 6), at(2026, 10, 29)], now), 2);   // nothing yet this week: from last week
assert.strictEqual(T.streak([at(2026, 10, 22)], now), 0);

// a week summary
var acts = [
  { id: 1, name: "Legs", sport_type: "WeightTraining", start_date: new Date(2026, 10, 13, 17).toISOString(), elapsed_time: 3240 },
  { id: 2, name: "Pull", sport_type: "WeightTraining", start_date: new Date(2026, 10, 11, 16).toISOString(), elapsed_time: 1260 },
  { id: 3, name: "Push", sport_type: "WeightTraining", start_date: new Date(2026, 10, 7, 9).toISOString(), elapsed_time: 5820 }
];
var sum = T.summarize(acts, { 1: { description: "Squat (Barbell)\nSet 1: 135 lbs x 10\nSet 2: 185 lbs x 8" } }, now);
assert.strictEqual(sum.workouts, 2);
assert.deepStrictEqual(sum.days, [0, 0, 1, 0, 1, 0, 0]);
assert.strictEqual(sum.minutes, 54 + 21);
assert.strictEqual(sum.volume, 1350 + 1480);
assert.strictEqual(sum.last.name, "Legs");
assert.strictEqual(sum.upNext, "Push");
assert.strictEqual(sum.lastWeek.workouts, 1);
console.log("training: all checks passed");
