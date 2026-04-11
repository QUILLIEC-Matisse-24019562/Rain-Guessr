"""
generate_image.py — Rain Guessr image generation pipeline

Steps:
  1. rename_screens()      — strips the date suffix from all screen filenames
                             SU_SU_A01_2024-03-15.png → SU_SU_A01.png
  2. generate_screens_txt() — writes screens.txt listing all available screens
                             for use by game.js (JS can't list directories)
  3. get_random_room()     — picks a random room from all available screens
  4. crop_random_square()  — crops a random square from that room's screen

Usage:
  python generate_image.py           → full pipeline (rename + screens.txt)
  python generate_image.py --rename  → rename only
  python generate_image.py --index   → regenerate screens.txt only
"""

import re
import random
import argparse
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
SCREENS_DIR  = Path(__file__).parent / "Screens"
SCREENS_TXT  = SCREENS_DIR / "screens.txt"
# Format of each line in screens.txt:  REGION/ROOMNAME
# e.g.  SU/SU_A01

# ── Step 1: Rename screens ────────────────────────────────────────────────────
def rename_screens():
    """
    Remove the date suffix from all screen filenames.
    Patterns handled:
      _2024-03-15          _20240315
      _2024-03-15_12-34-56  _20240315_123456
    """
    renamed = 0
    skipped = 0

    for region_dir in sorted(SCREENS_DIR.iterdir()):
        if not region_dir.is_dir():
            continue

        for filepath in sorted(region_dir.glob("*.png")):
            stem = filepath.stem

            new_stem = re.sub(
                r'_\d{4}-?\d{2}-?\d{2}(_\d{2}-?\d{2}-?\d{2})?$',
                '',
                stem
            )

            if new_stem == stem:
                skipped += 1
                continue

            new_path = filepath.parent / (new_stem + ".png")

            if new_path.exists():
                print(f"  SKIP (target exists): {filepath.name}")
                skipped += 1
                continue

            filepath.rename(new_path)
            print(f"  Renamed: {filepath.name} → {new_path.name}")
            renamed += 1

    print(f"\nRename complete: {renamed} renamed, {skipped} skipped.")

# ── Step 2: Generate screens.txt ─────────────────────────────────────────────
def generate_screens_txt():
    """
    Scans Screens/ and writes screens.txt with one entry per line:
      REGION/ROOMNAME
    e.g.:
      SU/SU_A01
      SU/SU_A02
      CC/CC_A01
    Only includes already-renamed files (no date pattern in filename).
    """
    entries = []

    for region_dir in sorted(SCREENS_DIR.iterdir()):
        if not region_dir.is_dir():
            continue
        region = region_dir.name.upper()

        for filepath in sorted(region_dir.glob("*.png")):
            # Skip files that still have a date suffix
            if re.search(r'_\d{4}-?\d{2}-?\d{2}', filepath.stem):
                print(f"  SKIP (has date): {filepath.name}")
                continue
            entries.append(f"{region}/{filepath.stem}")

    SCREENS_TXT.write_text("\n".join(entries) + "\n", encoding="utf-8")
    print(f"\nscreens.txt written: {len(entries)} screens at {SCREENS_TXT}")
    return entries

# ── Step 3: Get random room ───────────────────────────────────────────────────
def get_all_rooms():
    """
    Returns a list of (region, room_key, filepath) for every renamed screen.
    """
    rooms = []
    for region_dir in SCREENS_DIR.iterdir():
        if not region_dir.is_dir():
            continue
        region = region_dir.name.upper()
        for filepath in region_dir.glob("*.png"):
            if re.search(r'_\d{4}-?\d{2}-?\d{2}', filepath.stem):
                continue
            rooms.append((region, filepath.stem, filepath))
    return rooms

def get_random_room():
    rooms = get_all_rooms()
    if not rooms:
        print("No screens found. Run --rename first.")
        return None
    choice = random.choice(rooms)
    print(f"Selected room: {choice[1]} (region: {choice[0]})")
    return choice

# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rain Guessr image generator")
    parser.add_argument("--rename", action="store_true", help="Rename screens only")
    parser.add_argument("--index",  action="store_true", help="Regenerate screens.txt only")
    args = parser.parse_args()

    if args.rename:
        print("── Renaming screens ──")
        rename_screens()
    elif args.index:
        print("── Generating screens.txt ──")
        generate_screens_txt()
    else:
        # Full pipeline
        print("── Step 1: Renaming screens ──")
        rename_screens()
        print("\n── Step 2: Generating screens.txt ──")
        generate_screens_txt()