"""Serve the included Three.js game only on this PC; requires Python 3."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
import webbrowser,threading
root=Path(__file__).resolve().parent
handler=partial(SimpleHTTPRequestHandler,directory=str(root/'dist'))
with ThreadingHTTPServer(('127.0.0.1',8765),handler) as server:
 print('HOVER RACING: http://127.0.0.1:8765 — Ctrl+C to stop')
 threading.Timer(.5,lambda:webbrowser.open('http://127.0.0.1:8765')).start()
 try:server.serve_forever()
 except KeyboardInterrupt:pass
