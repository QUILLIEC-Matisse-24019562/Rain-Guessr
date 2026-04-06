"""
generate_image.py — Rain Guessr image generation pipeline

Steps:
  1. rename_screens()   — strips the date suffix from all screen filenames
                          SU_SU_A01_2024-03-15.png → SU_SU_A01.png
  2. get_random_room()  — picks a random room from all available screens
  3. crop_random_square(room_key, size) — crops a random square from that
                          room's screen and saves it as the challenge image

Usage:
  python generate_image.py              → full pipeline (rename + generate)
  python generate_image.py --rename     → rename only
  python generate_image.py --generate   → generate only (assumes renamed)
"""

import os
import re
import random
import argparse
from pathlib import Path
from PIL import Image

# ── Config ────────────────────────────────────────────────────────────────────
SCREENS_DIR  = Path(__file__).parent / "Screens"
OUTPUT_IMAGE = Path(__file__).parent / "challenge.png"
CROP_SIZE    = 256  # side length of the output square in pixels

# ── Step 1: Rename screens ────────────────────────────────────────────────────
def rename_screens():
    """
    Remove the date suffix from all screen filenames.
    Pattern: REGION_ROOMNAME_YYYY-MM-DD.png  →  REGION_ROOMNAME.png
    Also handles timestamps like _20240315_123456.png
    """
    renamed = 0
    skipped = 0

    for region_dir in SCREENS_DIR.iterdir():
        if not region_dir.is_dir():
            continue

        for filepath in region_dir.glob("*.png"):
            stem = filepath.stem  # filename without .png

            # Match and strip any trailing _DATE or _DATETIME suffix
            # Patterns: _2024-03-15  or  _20240315  or  _20240315_123456 or _2024-03-15_12-34-56
            new_stem = re.sub(
                #r'_\d{4}-?\d{2}-?\d{2}(_\d{6})?$',
                r'_\d{4}-?\d{2}-?\d{2}(_\d{2}-?\d{2}-?\d{2})?$',
                '',
                stem
            )

            if new_stem == stem:
                skipped += 1
                continue  # no date suffix found, already clean

            new_path = filepath.parent / (new_stem + ".png")

            if new_path.exists():
                print(f"  SKIP (target exists): {filepath.name}")
                skipped += 1
                continue

            filepath.rename(new_path)
            print(f"  Renamed: {filepath.name} → {new_path.name}")
            renamed += 1

    print(f"\nRename complete: {renamed} renamed, {skipped} skipped.")

# ── Step 2: Get random room ───────────────────────────────────────────────────
def get_all_rooms():
    """
    Returns a list of (region, room_key, filepath) for every renamed screen.
    room_key is the filename stem, e.g. 'SU_SU_A01'
    """
    rooms = []
    for region_dir in SCREENS_DIR.iterdir():
        print(region_dir)
        if not region_dir.is_dir():
            continue
        region = region_dir.name.upper()
        for filepath in region_dir.glob("*.png"):
            # Only include already-renamed files (no date pattern remaining)
            if re.search(r'_\d{4}-?\d{2}-?\d{2}', filepath.stem):
                continue  # still has a date, skip
            rooms.append((region, filepath.stem, filepath))
    return rooms

def get_random_room():
    """
    Picks a random room from all available screens.
    Returns (region, room_key, filepath) or None if no screens found.
    """
    rooms = get_all_rooms()
    if not rooms:
        print("No screens found. Run --rename first.")
        return None
    choice = random.choice(rooms)
    print(f"Selected room: {choice[1]} (region: {choice[0]})")
    return choice

# ── Step 3: Crop random square ────────────────────────────────────────────────
def crop_random_square(filepath, size=CROP_SIZE, output_path=OUTPUT_IMAGE):
    """
    Crops a random square of `size` × `size` pixels from the given image.
    The crop position is chosen randomly but guaranteed to fit inside the image.
    Saves the result to output_path.
    """
    img = Image.open(filepath).convert("RGB")
    w, h = img.size

    if w < size or h < size:
        # Image is smaller than crop size — resize up first
        scale = max(size / w, size / h)
        new_w, new_h = int(w * scale) + 1, int(h * scale) + 1
        img = img.resize((new_w, new_h), Image.LANCZOS)
        w, h = img.size
        print(f"  Image resized to {w}×{h} to fit crop size {size}")

    # Random top-left corner, ensuring the crop fits entirely inside the image
    max_x = w - size
    max_y = h - size
    left = random.randint(0, max_x)
    top  = random.randint(0, max_y)

    cropped = img.crop((left, top, left + size, top + size))
    cropped.save(output_path)

    print(f"  Cropped {size}×{size} from ({left},{top}) → saved to {output_path}")
    return output_path

# ── Full pipeline ─────────────────────────────────────────────────────────────
def generate_challenge(size=CROP_SIZE):
    """
    Picks a random room, crops a random square, saves the challenge image.
    Returns (room_key, output_path) for use by the game.
    """
    result = get_random_room()
    if result is None:
        return None

    region, room_key, filepath = result
    output = crop_random_square(filepath, size=size)
    return room_key, output

# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rain Guessr image generator")
    parser.add_argument("--rename",   action="store_true", help="Rename screens only")
    parser.add_argument("--generate", action="store_true", help="Generate challenge image only")
    parser.add_argument("--size",     type=int, default=CROP_SIZE,
                        help=f"Crop square size in pixels (default: {CROP_SIZE})")
    args = parser.parse_args()

    if args.rename:
        print("── Renaming screens ──")
        rename_screens()
    elif args.generate:
        print("── Generating challenge image ──")
        result = generate_challenge(size=args.size)
        if result:
            room_key, path = result
            print(f"\nChallenge: room={room_key}  image={path}")
    else:
        # Full pipeline
        print("── Step 1: Renaming screens ──")
        rename_screens()
        print("\n── Step 2: Generating challenge image ──")
        result = generate_challenge(size=args.size)
        if result:
            room_key, path = result
            print(f"\nChallenge: room={room_key}  image={path}")