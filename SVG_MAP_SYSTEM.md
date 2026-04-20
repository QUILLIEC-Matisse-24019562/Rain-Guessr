# SVG Map Rendering System

## Overview

The map is now rendered using SVG (Scalable Vector Graphics) instead of WebGL. This provides:
- **Better compatibility** - Works on all browsers without special setup
- **Cleaner code** - Much easier to debug and extend
- **Better performance** - Efficient rendering of 2D geometry
- **Interactive features** - Easy to add hover effects, selections, etc.

## Architecture

### Core Components

#### 1. **room-renderer.js**
The main renderer that handles:
- Loading region position data
- Loading room metadata for each region
- Parsing room geometry files
- Rendering rooms to SVG

**Key Functions:**
- `RoomRenderer.init()` - Initialize and load all data
- `RoomRenderer.loadRegionPositions()` - Load region coordinates
- `RoomRenderer.loadAllRoomMetadata()` - Load room lists
- `RoomRenderer.loadRoomGeometry(region, room)` - Load single room
- `RoomRenderer.parseRoomFile()` - Parse room text format
- `RoomRenderer.renderRoomToSVG()` - Render room to SVG
- `RoomRenderer.renderAllRegions()` - Render entire world

**File Format Handling:**
```
Piece : REGION_CODE
WidthxHeight
XxY (coordinates)
.#|- (tile map)
...
geometry connections
...
end file : REGION_CODE
```

#### 2. **map-init.js**
Initializes the map interface and handles:
- Loading the room renderer
- Rendering all rooms to SVG
- Adding room selection handlers
- Managing selected room state
- UI updates

**Key Functions:**
- `selectRoom(roomGroup)` - Select a room
- `getSelectedRoom()` - Get current selection
- `clearSelection()` - Clear selection

#### 3. **moving_map_script.js**
Updated pan/zoom functionality:
- Left-click drag to pan map
- Mouse wheel to zoom in/out
- Zoom towards mouse cursor
- Prevents dragging when clicking on rooms (allows selection)

**Key Functions:**
- `applyTransform()` - Apply current transform
- `resetMapView()` - Reset zoom/pan
- `window.mapControls` - Control interface

#### 4. **map.html**
Updated with SVG structure:
```html
<svg id="map-svg">
  <!-- Grid background -->
  <g id="rooms-group">    <!-- Rooms rendered here -->
  <g id="selection-group"> <!-- Selection markers here -->
</svg>
```

## Room Data Structure

Each room file contains:
1. **Metadata**
   - Room name: `Piece : CC_A02`
   - Size: `54x35` (width x height)
   - Position: `-749x-582` (relative to region)

2. **Tile Map**
   - `.` = Empty space
   - `#` = Wall
   - `|` = Vertical pole
   - `-` = Horizontal pole
   - `+` = Crossing pole
   - `=` = Special tile
   - `/` = Special tile
   - `H` = Hazard

3. **Geometry Connections**
   - Lists of connected tiles (for advanced features)

## World Coordinates

- Each region has a global position (stored in `region_pos.txt`)
- Rooms are positioned relative to their region
- World position = (region.x + room.x) * TILE_SIZE, same for Y

Example:
- Region CC: position `-570x897`
- Room CC_A02: position `-749x-582`
- World position: `(-570 + -749) * 20 = -26,380px` (x-axis)

## Tile Rendering

Tiles are rendered as 20px × 20px SVG rectangles with:
- Color based on tile type (configurable in `TILE_TYPES`)
- Slight transparency for depth effect
- Dark grid lines for clarity

Current colors:
- Empty: `#1a1a1a`
- Wall: `#444`
- Poles: `#666` - `#888`
- Hazard: `#ff6600`

## Interactive Features

### Room Selection
- **Click** on a room to select it
- Selected room shows:
  - Magenta border (instead of green)
  - Magenta label text
  - Glow effect
  - Info displayed in UI

### Hover Effects
- Rooms show cyan border on hover
- Smooth transitions

### Map Navigation
- **Left-click + drag** = Pan map
- **Mouse wheel** = Zoom in/out
- **Zoom constrains**: 0.1x to 10x

## Performance Considerations

- **Caching**: Room geometry is cached after loading
- **Lazy loading**: Rooms loaded per-region
- **Batch rendering**: All rooms added to SVG at initialization

## Future Enhancements

### Ready to Implement
1. **Right-click point placement** - For answer selection
2. **Distance calculation** - Calculate selected vs actual room
3. **Scoring system** - Based on distance/time
4. **3-layer map toggle** - Switch between layer views

### Possible Improvements
1. **Room search** - Filter by name
2. **Zoom to region** - Jump to specific region
3. **Custom tile rendering** - Different art styles
4. **Performance optimization** - Use SVG symbols for repeated tiles

## Debugging

### Enable Logging
The system logs extensively to browser console:
- Room load counts
- Region rendering progress
- Selection events
- Geometry parsing

### Common Issues

**Rooms not loading:**
- Check console for fetch errors
- Verify file paths are correct
- Check if region_pos.txt is accessible

**Zoom not working:**
- Check that `moving_map_script.js` is loaded
- Verify `map-controls` is accessible

**Selection not working:**
- Check that `map-init.js` is loaded
- Verify room elements have correct attributes

## Code Examples

### Get Currently Selected Room
```javascript
const selected = getSelectedRoom();
if (selected) {
    console.log(`Room: ${selected.name}, Region: ${selected.region}`);
}
```

### Access Room Renderer Data
```javascript
const regionPositions = RoomRenderer.regionPositions;
const allRooms = RoomRenderer.allRooms;
const cachedRoom = RoomRenderer.roomsCache['CC_cc_a02'];
```

### Control Map View
```javascript
window.mapControls.setScale(2);          // Zoom to 2x
window.mapControls.setOffset(100, 200);  // Pan to position
window.mapControls.reset();              // Reset view
```

## File Structure Reference

```
js/
├── room-renderer.js    # Core SVG renderer
├── map-init.js         # Map initialization
└── moving_map_script.js # Pan/zoom controls

css/
└── style-map.css       # SVG styling

html/
└── map.html            # Map page

map/
└── World/
    └── Regions/
        ├── Rooms/
        │   ├── regions.txt          # List of regions
        │   ├── region_pos.txt       # Region coordinates
        │   ├── CC-rooms/
        │   │   ├── cf-CC-rooms.txt  # List of CC rooms
        │   │   ├── cc_a02.txt       # Room geometry
        │   │   └── ...
        │   └── ... (other regions)
```
