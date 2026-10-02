#!/usr/bin/env python3
"""
Test Home Assistant REST API connection (same as SmartEVSE "Test connection").
Usage: fill in SERVER, PORT, TOKEN below and run:
  python test_ha_connection.py

Or pass as args:
  python test_ha_connection.py [SERVER] [PORT] [TOKEN]

Per docs/HA REST API.md:
  - GET http://IP:8123/api/ with header Authorization: Bearer TOKEN
  - 200 = OK, 401 = invalid token, 404 = not found, else error
"""

import sys
import urllib.request
import urllib.error

# --- Fill these in (or pass as command-line args) ---
SERVER = "<HA_HOST>"   # IP or hostname, no http://
PORT = 8123
TOKEN = "<YOUR_HA_LONG_LIVED_TOKEN>"                 # Long-Lived Access Token from HA Profile


def test_ha(server: str, port: int, token: str) -> None:
    server = server.strip()
    if server.startswith("http://"):
        server = server[7:]
    if server.startswith("https://"):
        server = server[8:]
    server = server.rstrip("/")
    token = token.strip()
    if not token:
        print("ERROR: Token is empty. Get a Long-Lived Access Token from Home Assistant -> Profile.")
        return
    url = f"http://{server}:{port}/api/"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    print(f"GET {url}")
    print(f"Authorization: Bearer <token len={len(token)}>")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            code = r.getcode()
            body = r.read().decode("utf-8", errors="replace")[:500]
            if code == 200:
                print(f"OK {code} - Connection works.")
                if body:
                    print(f"Response: {body[:200]}...")
            else:
                print(f"Unexpected status {code}: {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        if e.code == 401:
            print("401 Unauthorized - Invalid token. Check:")
            print("  - Token is from Profile -> Long-Lived Access Tokens")
            print("  - No extra spaces/newlines (script trims automatically)")
            print(f"  Response: {body}")
        elif e.code == 404:
            print("404 Not Found - Is the API enabled? (add api to configuration.yaml if no frontend)")
            print(f"  Response: {body}")
        else:
            print(f"HTTP {e.code}: {body}")
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}")
    except Exception as e:
        print(f"Error: {e}")


def main():
    if len(sys.argv) >= 4:
        server, port_str, token = sys.argv[1], sys.argv[2], sys.argv[3]
        port = int(port_str)
    else:
        server, port, token = SERVER, PORT, TOKEN
    if not token and len(sys.argv) < 4:
        print("Set TOKEN in the script or run: python test_ha_connection.py SERVER PORT TOKEN")
        sys.exit(1)
    test_ha(server, port, token)


if __name__ == "__main__":
    main()
