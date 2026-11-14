// Background music: a SomaFM station (listener-supported, ad-free internet radio) plays quietly
// while the home is on screen, and a faint "Now playing" line in the top left says what it is.
// It stops when an app opens or the TV goes to standby, and starts again when the home is back.
// The remote's Play/Pause key turns it off and on (remembered). Plain ES5.
(function (root) {
  "use strict";

  function songsUrl(station) { return "https://somafm.com/songs/" + station + ".json"; }
  function streamUrl(station) { return "https://ice6.somafm.com/" + station + "-128-mp3"; }

  // the newest song in SomaFM's list for the station
  function nowPlaying(json) {
    try {
      var s = JSON.parse(json).songs[0];
      return s && s.title ? { title: s.title, artist: s.artist || "" } : null;
    } catch (e) { return null; }
  }

  function start(cfg, get, show) {
    if (!cfg || !cfg.station) return null;
    var audio = new Audio(), on = true, timer = 0, wanted = false;
    try { on = localStorage.getItem("hudson.music") !== "off"; } catch (e) {}
    audio.preload = "none";
    audio.volume = cfg.volume == null ? .5 : cfg.volume;
    function play() {
      if (!on || document.hidden) return;
      wanted = true;
      audio.src = streamUrl(cfg.station) + "?t=" + Date.now();   // a live stream: always join it fresh
      var p = audio.play();
      if (p && p.catch) p.catch(function () { wanted = false; show(null, "blocked"); });
      poll();
    }
    function stop() {
      wanted = false;
      audio.pause();
      audio.removeAttribute("src");
      try { audio.load(); } catch (e) {}
      clearTimeout(timer);
    }
    function poll() {
      clearTimeout(timer);
      if (!wanted) return;
      get(songsUrl(cfg.station), 15000, function (err, text) {
        if (!err) show(nowPlaying(text), "playing");
        timer = setTimeout(poll, 20000);
      });
    }
    audio.addEventListener("error", function () { if (wanted) setTimeout(function () { if (wanted) play(); }, 5000); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
    var api = {
      toggle: function () {
        on = !on;
        try { localStorage.setItem("hudson.music", on ? "on" : "off"); } catch (e) {}
        if (on) play(); else { stop(); show(null, "off"); }
      },
      play: play, stop: stop,
      isOn: function () { return on; }
    };
    if (on) play(); else show(null, "off");
    return api;
  }

  var Music = { start: start, nowPlaying: nowPlaying, streamUrl: streamUrl };
  if (typeof module !== "undefined" && module.exports) module.exports = Music;
  else root.Music = Music;
})(this);
