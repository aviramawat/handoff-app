"""Insert clearly fictional lost- and found-bag examples into local SQLite."""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent / "data" / "handoff.sqlite3"
LOST = [
    ("DEMO-001", "Jamie Example", "jamie.example@example.com", "Northstar Air", "NS 204", "2026-10-14", "Heathrow Airport, Terminal 5, carousel 8", "Suitcase", "forest green", "Yellow ribbon on the handle; small moon sticker."),
    ("DEMO-002", "Riley Sample", "riley.sample@example.com", "Cloudline Airways", "CL 118", "2026-10-15", "Delhi Airport, Terminal 3, carousel 4", "Backpack", "black", "Orange zipper pulls; stitched mountain patch."),
    ("DEMO-003", "Morgan Demo", "morgan.demo@example.com", "Maple Leaf Air", "ML 730", "2026-10-15", "Toronto Pearson, Terminal 1, carousel 12", "Duffel bag", "navy blue", "White initials patch reading M.D."),
    ("DEMO-004", "Taylor Fiction", "taylor.fiction@example.com", "Southern Cross Airways", "SC 402", "2026-10-13", "Sydney Airport, Terminal 1, carousel 6", "Suitcase", "coral", "Two white stripes and a teal luggage tag."),
    ("DEMO-005", "Casey Mock", "casey.mock@example.com", "Island Hopper", "IH 51", "2026-10-14", "Singapore Changi, Terminal 3, carousel 2", "Backpack", "yellow", "Small blue planet sticker on the front pocket."),
    ("DEMO-006", "Avery Example", "avery.example@example.com", "Desert Star", "DS 903", "2026-10-12", "Dubai International, Terminal 1, carousel 9", "Suitcase", "silver", "Red luggage strap with a tiny bell attached."),
    ("DEMO-007", "Jordan Sample", "jordan.sample@example.com", "Harbor Air", "HA 220", "2026-10-15", "John F. Kennedy Airport, Terminal 4, carousel 5", "Duffel bag", "dark gray", "Green carabiner on the side handle."),
    ("DEMO-008", "Quinn Demo", "quinn.demo@example.com", "Monsoon Airways", "MA 617", "2026-10-14", "Mumbai Airport, Terminal 2, carousel 3", "Suitcase", "purple", "Tiny star stickers near the top corner."),
    ("DEMO-009", "Skyler Fiction", "skyler.fiction@example.com", "Alpine Routes", "AR 88", "2026-10-13", "Zurich Airport, Arrival 1, carousel 7", "Backpack", "olive", "Cream-colored rain cover in the front pocket."),
    ("DEMO-010", "Drew Mock", "drew.mock@example.com", "Blue Horizon", "BH 311", "2026-10-15", "Amsterdam Schiphol, Hall 2, carousel 14", "Suitcase", "bright red", "Black handle wrap and a small fox sticker."),
    ("DEMO-011", "Robin Example", "robin.example@example.com", "Pacific Way", "PW 602", "2026-10-12", "Los Angeles International, Terminal B, carousel 10", "Duffel bag", "teal", "White rope zipper pull and a stitched wave."),
    ("DEMO-012", "Emery Sample", "emery.sample@example.com", "Cedar Airways", "CA 145", "2026-10-14", "Vancouver International, International Arrivals, carousel 1", "Suitcase", "charcoal", "Lime-green luggage tag; one wheel cover is blue."),
]
FOUND = [
    ("FND-DEMO-001", "2026-10-15", "Heathrow Airport, Terminal 5, lost property desk", "Suitcase", "dark green", "Yellow ribbon on handle; small moon sticker."),
    ("FND-DEMO-002", "2026-10-15", "Delhi Airport, Terminal 3, carousel 4", "Backpack", "black", "Orange zipper pulls and a mountain patch."),
    ("FND-DEMO-003", "2026-10-15", "Toronto Pearson, Terminal 1, carousel 12", "Duffel bag", "blue", "White initials patch on the front."),
    ("FND-DEMO-004", "2026-10-13", "Sydney Airport, Terminal 1, carousel 6", "Suitcase", "coral", "Teal luggage tag and white stripes."),
    ("FND-DEMO-005", "2026-10-14", "Singapore Changi, Terminal 3, carousel 2", "Backpack", "yellow", "Blue planet sticker near front pocket."),
    ("FND-DEMO-006", "2026-10-14", "Amsterdam Schiphol, Hall 2, carousel 14", "Suitcase", "red", "Black handle wrap; small fox sticker."),
]

with sqlite3.connect(DB) as db:
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
    for row in LOST:
        db.execute("""
            INSERT OR IGNORE INTO lost_bag_reports (
                receipt_code, created_at, traveler_name, email, airline,
                flight_number, travel_date, last_seen_location, bag_type,
                bag_color, identifying_details, is_demo
            ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, row)
    for row in FOUND:
        db.execute("""
            INSERT OR IGNORE INTO found_bag_reports (
                receipt_code, created_at, found_date, found_location,
                bag_type, bag_color, details, is_demo
            ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, 1)
        """, row)
    lost_count = db.execute("SELECT COUNT(*) FROM lost_bag_reports WHERE is_demo = 1").fetchone()[0]
    found_count = db.execute("SELECT COUNT(*) FROM found_bag_reports WHERE is_demo = 1").fetchone()[0]
print(f"Seeded {lost_count} fictional lost reports and {found_count} found-item examples.")
