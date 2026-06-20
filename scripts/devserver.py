#!/usr/bin/env python3
"""Tiny no-cache static server for local dev (so edits always reload fresh)."""
import http.server
import socketserver
import sys
import functools

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4500
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else "."


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    handler = functools.partial(NoCacheHandler, directory=DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"no-cache server on :{PORT} serving {DIRECTORY}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
