#!/usr/bin/env python3
"""Pack the Hudson TV home as a Samsung TV app: build/hudson/HudsonTV.wgt (unsigned).

    .venv/bin/python hudson/build.py [--log-url http://<this computer>:5499] [--preview]

The page is hudson/web. The Samsung parts come from samsung/app/tizen.js (the TV's apps, opening
them, coming forward when the TV is switched on). Settings come from hudson/config.local.json
(git ignored: your Sleeper league lives there), else hudson/config.example.json.
--preview adds pretend apps so the page can be opened in a desktop browser.
Install with: apps2samsung-cli install build/hudson/HudsonTV.wgt --tv <tv address>
"""
import argparse
import json
import os
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "bridge"))
import apps  # noqa: E402

OUT = os.path.join(ROOT, "build", "hudson")
ICON = os.path.join(ROOT, "remote", "public", "icons", "icon-512.png")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--log-url", default="", help="for testing: where the app sends its console")
    ap.add_argument("--preview", action="store_true", help="pretend apps, for a desktop browser")
    a = ap.parse_args()

    local = os.path.join(HERE, "config.local.json")
    with open(local if os.path.exists(local) else os.path.join(HERE, "config.example.json")) as f:
        cfg = json.load(f)
    if a.preview:
        cfg["demoApps"] = [{"package": n, "label": n} for n in
                           ["Prime Video", "Netflix", "YouTube TV", "YouTube", "Hulu", "Disney+", "Apple TV",
                            "Peacock", "ESPN", "Sling TV", "Spotify", "AMC+", "Angel Studios", "PBS KIDS Video"]]

    stage = os.path.join(OUT, "app")
    if os.path.isdir(stage):
        shutil.rmtree(stage)
    shutil.copytree(os.path.join(HERE, "web"), stage, ignore=shutil.ignore_patterns(".*"))
    shutil.copy(os.path.join(HERE, "config.xml"), stage)
    shutil.copy(ICON, os.path.join(stage, "icon.png"))
    shutil.copy(os.path.join(ROOT, "samsung", "app", "tizen.js"), stage)

    with open(os.path.join(stage, "hudson-config.js"), "w") as f:
        f.write("window.HUDSON = " + json.dumps(cfg, indent=1) + ";\n")
    with open(os.path.join(stage, "settings.js"), "w") as f:
        f.write("window.COUCH_TIZEN = " + json.dumps({"bridge": "", "tv": "", "log": a.log_url.rstrip("/")}) + ";\n")
    table = {}
    for app in apps.APPS:
        t = apps.TIZEN.get(app["id"])
        if t:
            table[app["package"]] = {"id": app["id"], "name": app["name"], "ids": t["ids"], "app": t.get("app"), "logo": False}
    with open(os.path.join(stage, "tizen-apps.js"), "w") as f:
        f.write("window.COUCH_TIZEN_APPS = " + json.dumps(table, indent=1) + ";\n")

    # the Samsung layer loads before the home's own script
    index = os.path.join(stage, "index.html")
    with open(index) as f:
        html = f.read()
    tag = '<script src="hudson-config.js"></script>'
    if tag not in html:
        raise SystemExit("hudson/web/index.html no longer loads hudson-config.js; update hudson/build.py")
    if a.preview:
        # fit the 1920 x 1080 page into any browser window
        html = html.replace("</body>", '<script>(function(){function fit(){var k=Math.min(innerWidth/1920,innerHeight/1080);'
                            'document.documentElement.style.cssText="transform:scale("+k+");transform-origin:0 0";'
                            'document.body.parentNode.style.background="#000"}addEventListener("resize",fit);fit()})();</script>\n</body>')
    if not a.preview:
        html = html.replace(tag, tag + '\n<script src="settings.js"></script>\n<script src="tizen-apps.js"></script>\n'
                                       '<script src="tizen.js"></script>')
    with open(index, "w") as f:
        f.write(html)

    wgt = os.path.join(OUT, "HudsonTV.wgt")
    if os.path.exists(wgt):
        os.remove(wgt)
    with zipfile.ZipFile(wgt, "w", zipfile.ZIP_DEFLATED) as z:
        for dirpath, _, names in os.walk(stage):
            for n in sorted(names):
                full = os.path.join(dirpath, n)
                z.write(full, os.path.relpath(full, stage))
    print(f"built {os.path.relpath(wgt, ROOT)} ({os.path.getsize(wgt) // 1024} KB), "
          f"settings from {'config.local.json' if os.path.exists(local) else 'config.example.json'}"
          + (", preview" if a.preview else ""))


if __name__ == "__main__":
    main()
