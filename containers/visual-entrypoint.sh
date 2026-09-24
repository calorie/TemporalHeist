#!/bin/sh
set -eu

export DISPLAY=${DISPLAY:-:99}
Xvfb "$DISPLAY" -screen 0 1280x720x24 -nolisten tcp &
echo $! >/tmp/xvfb.pid
sleep 1
x11vnc -display "$DISPLAY" -forever -shared -nopw -rfbport 5900 >/tmp/x11vnc.log 2>&1 &
echo $! >/tmp/x11vnc.pid
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/novnc.log 2>&1 &
echo $! >/tmp/websockify.pid

exec node containers/visual-browser.mjs
