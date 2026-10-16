"""Local-only Handoff API and web server. Uses Python's standard library."""
from __future__ import annotations

import json
import re
import secrets
import sqlite3
from datetime import date, datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "handoff.sqlite3"
HOST = "127.0.0.1"
PORT = 8000
MAX_BODY = 16_384
BAG_TYPES = {"Suitcase", "Backpack", "Duffel bag", "Other"}


def initialize_database() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS lost_bag_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                traveler_name TEXT NOT NULL,
                email TEXT NOT NULL,
                airline TEXT NOT NULL,
                flight_number TEXT NOT NULL,
                travel_date TEXT NOT NULL,
                last_seen_location TEXT NOT NULL,
                bag_type TEXT NOT NULL,
                bag_color TEXT NOT NULL,
                identifying_details TEXT NOT NULL DEFAULT '',
                is_demo INTEGER NOT NULL DEFAULT 0
            )
        """)
        columns = {row[1] for row in db.execute("PRAGMA table_info(lost_bag_reports)")}
        if "is_demo" not in columns:
            db.execute("ALTER TABLE lost_bag_reports ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0")
        db.execute("""
            CREATE TABLE IF NOT EXISTS found_bag_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                found_date TEXT NOT NULL,
                found_location TEXT NOT NULL,
                bag_type TEXT NOT NULL,
                bag_color TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                is_demo INTEGER NOT NULL DEFAULT 0
            )
        """)


def clean_string(value: object, field: str, maximum: int, required: bool = True) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be text.")
    result = value.strip()
    if required and not result:
        raise ValueError(f"{field} is required.")
    if len(result) > maximum:
        raise ValueError(f"{field} is too long (maximum {maximum} characters).")
    return result


class HandoffHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

    def _json(self, status: int, payload: dict, attachment_name: str | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if attachment_name:
            self.send_header("Content-Disposition", f"attachment; filename={attachment_name}")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid request size.") from error
        if length <= 0 or length > MAX_BODY:
            raise ValueError("Report is empty or too large.")
        data = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Report must be a JSON object.")
        return data

    def do_GET(self):
        if self.path == "/api/health":
            self._json(200, {"ok": True, "storage": "sqlite"})
            return
        if self.path == "/api/export":
            with sqlite3.connect(DB_PATH) as db:
                db.row_factory = sqlite3.Row
                lost = db.execute("SELECT * FROM lost_bag_reports ORDER BY id").fetchall()
                found = db.execute("SELECT * FROM found_bag_reports ORDER BY id").fetchall()
            payload = {
                "app": "Handoff",
                "exportedAt": datetime.now(timezone.utc).isoformat(),
                "lostReports": [dict(row) for row in lost],
                "foundReports": [dict(row) for row in found],
            }
            filename = "handoff-backup-" + datetime.now(timezone.utc).strftime("%Y%m%d") + ".json"
            self._json(200, payload, attachment_name=filename)
            return
        if self.path == "/api/reports":
            with sqlite3.connect(DB_PATH) as db:
                db.row_factory = sqlite3.Row
                rows = db.execute("""
                    SELECT receipt_code, created_at, traveler_name, airline,
                           flight_number, travel_date, last_seen_location,
                           bag_type, bag_color, identifying_details, is_demo
                    FROM lost_bag_reports ORDER BY created_at DESC, id DESC
                """).fetchall()
            self._json(200, {"reports": [dict(row) for row in rows]})
            return
        if self.path == "/api/found-bags":
            with sqlite3.connect(DB_PATH) as db:
                db.row_factory = sqlite3.Row
                rows = db.execute("""
                    SELECT receipt_code, created_at, found_date, found_location,
                           bag_type, bag_color, details, is_demo
                    FROM found_bag_reports ORDER BY created_at DESC, id DESC
                """).fetchall()
            self._json(200, {"foundBags": [dict(row) for row in rows]})
            return
        super().do_GET()

    def do_POST(self):
        if self.path not in {"/api/reports", "/api/found-bags"}:
            self._json(404, {"error": "Not found."})
            return
        try:
            data = self._body()
            created_at = datetime.now(timezone.utc).isoformat()
            if self.path == "/api/found-bags":
                report = {
                    "found_date": clean_string(data.get("date"), "Date found", 10),
                    "found_location": clean_string(data.get("location"), "Where the bag was found", 240),
                    "bag_type": clean_string(data.get("type"), "Bag type", 30),
                    "bag_color": clean_string(data.get("color"), "Bag color", 80),
                    "details": clean_string(data.get("details", ""), "Details", 1000, required=False),
                }
                date.fromisoformat(report["found_date"])
                if report["bag_type"] not in BAG_TYPES:
                    raise ValueError("Choose a valid bag type.")
                receipt = "FND-" + secrets.token_hex(4).upper()
                with sqlite3.connect(DB_PATH) as db:
                    db.execute("""
                        INSERT INTO found_bag_reports (
                            receipt_code, created_at, found_date, found_location,
                            bag_type, bag_color, details
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (receipt, created_at, report["found_date"], report["found_location"],
                          report["bag_type"], report["bag_color"], report["details"]))
                self._json(201, {"ok": True, "receipt": receipt, "createdAt": created_at})
                return

            report = {
                "traveler_name": clean_string(data.get("name"), "Name", 120),
                "email": clean_string(data.get("email"), "Email", 254),
                "airline": clean_string(data.get("airline"), "Airline", 120),
                "flight_number": clean_string(data.get("flight"), "Flight number", 30),
                "travel_date": clean_string(data.get("date"), "Travel date", 10),
                "last_seen_location": clean_string(data.get("location"), "Last seen location", 240),
                "bag_type": clean_string(data.get("type"), "Bag type", 30),
                "bag_color": clean_string(data.get("color"), "Bag color", 80),
                "identifying_details": clean_string(data.get("details", ""), "Details", 1000, required=False),
            }
            date.fromisoformat(report["travel_date"])
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", report["email"]):
                raise ValueError("Enter a valid email address.")
            if report["bag_type"] not in BAG_TYPES:
                raise ValueError("Choose a valid bag type.")
            receipt = "HND-" + secrets.token_hex(4).upper()
            with sqlite3.connect(DB_PATH) as db:
                db.execute("""
                    INSERT INTO lost_bag_reports (
                        receipt_code, created_at, traveler_name, email, airline,
                        flight_number, travel_date, last_seen_location, bag_type,
                        bag_color, identifying_details
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (receipt, created_at, report["traveler_name"], report["email"],
                      report["airline"], report["flight_number"], report["travel_date"],
                      report["last_seen_location"], report["bag_type"], report["bag_color"],
                      report["identifying_details"]))
            self._json(201, {"ok": True, "receipt": receipt, "createdAt": created_at})
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"error": "Invalid JSON request."})
        except ValueError as error:
            self._json(400, {"error": str(error)})
        except sqlite3.Error:
            self._json(500, {"error": "The report could not be saved. Please try again."})


def main() -> None:
    initialize_database()
    server = ThreadingHTTPServer((HOST, PORT), HandoffHandler)
    print(f"Handoff running at http://{HOST}:{PORT}")
    print(f"SQLite database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping Handoff server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()


