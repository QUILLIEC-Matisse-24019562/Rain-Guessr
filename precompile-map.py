#!/usr/bin/env python3
"""
Map Data Precompiler
Generates a single JSON file with all room data and pre-rendered room images.
This speeds up map loading dramatically by avoiding hundreds of HTTP requests.
"""

import json
import os
from pathlib import Path

# Configuration
BASE_DIR = Path(__file__).parent
MAP_DIR = BASE_DIR / "map" / "World" / "Regions" / "Rooms"
OUTPUT_FILE = BASE_DIR / "json" / "map-data.json"

TILE_SIZE = 15
TILE_COLORS = {
    '.': '#1a1a1a',
    '#': '#444',
    '|': '#666',
    '-': '#666',
    '+': '#888',
    '=': '#666',
    '/': '#555',
    'H': '#ff6600',
}


def parse_room_file(file_path):
    """Parse a single room file and extract geometry."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        room_data = {
            'name': '',
            'width': 0,
            'height': 0,
            'position': {'x': 0, 'y': 0},
            'tileMap': []
        }
        
        tile_lines = []
        geometry_started = False
        
        for line in lines:
            stripped = line.strip()
            
            # Parse room name
            if stripped.startswith('Piece :'):
                room_data['fullName'] = stripped.replace('Piece :', '').strip()
                room_data['name'] = room_data['fullName'].split('_')[1] if '_' in room_data['fullName'] else room_data['fullName']
            
            # Parse size
            elif stripped and all(c in '0123456789x' for c in stripped) and 'x' in stripped:
                parts = stripped.split('x')
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                    room_data['width'] = int(parts[0])
                    room_data['height'] = int(parts[1])
            
            # Parse position
            elif stripped and all(c in '0123456789x-' for c in stripped) and 'x' in stripped:
                # This is a position line if we already have width/height
                if room_data['width'] > 0:
                    import re
                    match = re.findall(r'-?\d+', stripped)
                    if len(match) == 2:
                        room_data['position']['x'] = int(match[0])
                        room_data['position']['y'] = int(match[1])
            
            # Collect tile lines
            elif not geometry_started and stripped and stripped[0] in '.#|+-=HV/':
                tile_lines.append(line)
            
            # Stop at end marker
            elif 'end file :' in stripped:
                break
        
        room_data['tileMap'] = tile_lines
        return room_data if room_data['width'] > 0 else None
        
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return None


def load_region_positions():
    """Load region positions from region_pos.txt."""
    positions = {}
    pos_file = MAP_DIR / "region_pos.txt"
    
    if not pos_file.exists():
        print(f"Warning: {pos_file} not found")
        return positions
    
    with open(pos_file, 'r') as f:
        for line in f:
            line = line.strip()
            if ':' not in line:
                continue
            region, coords = line.split(':')
            region = region.strip()
            
            import re
            matches = re.findall(r'-?\d+', coords)
            if len(matches) == 2:
                positions[region] = {
                    'x': int(matches[0]),
                    'y': int(matches[1]),
                    'name': region
                }
    
    return positions


def precompile_map_data():
    """Precompile all map data into a single JSON file."""
    print("Starting map data precompilation...")
    
    # Load region positions
    region_positions = load_region_positions()
    print(f"Loaded {len(region_positions)} region positions")
    
    # Get all regions
    regions_file = MAP_DIR / "regions.txt"
    if not regions_file.exists():
        print(f"Error: {regions_file} not found")
        return False
    
    with open(regions_file, 'r') as f:
        regions = [line.strip() for line in f if line.strip()]
    
    print(f"Found {len(regions)} regions: {', '.join(regions)}")
    
    all_rooms_data = {}
    total_rooms = 0
    
    # Process each region
    for region in regions:
        region_code = region.replace('-rooms', '')
        room_list_file = MAP_DIR / region / f"cf-{region_code}-rooms.txt"
        
        if not room_list_file.exists():
            print(f"  {region_code}: room list not found")
            all_rooms_data[region_code] = []
            continue
        
        # Get room list
        with open(room_list_file, 'r') as f:
            room_names = [line.strip() for line in f if line.strip() and not line.strip().startswith('cf-')]
        
        rooms_in_region = []
        
        # Load each room
        for room_name in room_names:
            if room_name.endswith('.txt'):
                room_name = room_name[:-4]
            
            room_file = MAP_DIR / region / f"{room_name}.txt"
            
            if not room_file.exists():
                continue
            
            room_data = parse_room_file(room_file)
            
            if room_data:
                # Add world position
                if region_code in region_positions:
                    region_pos = region_positions[region_code]
                    room_data['worldPos'] = {
                        'x': (region_pos['x'] + room_data['position']['x']) * TILE_SIZE,
                        'y': (region_pos['y'] + room_data['position']['y']) * TILE_SIZE
                    }
                
                # Remove tileMap since we only need outlines now
                if 'tileMap' in room_data:
                    del room_data['tileMap']
                
                rooms_in_region.append(room_data)
                total_rooms += 1
        
        all_rooms_data[region_code] = rooms_in_region
        print(f"  {region_code}: {len(rooms_in_region)} rooms loaded")
    
    # Prepare output data
    output_data = {
        'version': '1.0',
        'tileSize': TILE_SIZE,
        'regionPositions': region_positions,
        'rooms': all_rooms_data,
        'totalRooms': total_rooms
    }
    
    # Write to JSON file
    print(f"\nWriting {total_rooms} rooms to {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, separators=(',', ':'))
    
    file_size = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"✓ Precompilation complete! File size: {file_size:.2f} MB")
    print(f"✓ Total rooms: {total_rooms}")
    print(f"✓ Saved to: {OUTPUT_FILE}")
    
    return True


if __name__ == '__main__':
    success = precompile_map_data()
    exit(0 if success else 1)
