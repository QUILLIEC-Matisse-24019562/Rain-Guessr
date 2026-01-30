# Rain-Guessr Project Audit Report

**Focus**: Classic game mode with priority on **Map/Map Navigation**

---

## 🎯 HIGH PRIORITY - MAP & NAVIGATION (CRITICAL ISSUES)

### 1. **Map Rendering System Broken** ⚠️ CRITICAL
**Status**: Non-functional
**Files Involved**: 
- [js/map.js](js/map.js)
- [html/map.html](html/map.html)
- [css/style-map.css](css/style-map.css)

**Issues**:
- `map.js` contains WebGL code that's incomplete and incompatible with current HTML
- HTML references `#canvas` element that **doesn't exist** in `map.html`
- `loadRegions()` function tries to load files with path `../map/World/Regions/Rooms` but the naming is inconsistent (looking for `cf-{region}.txt` which doesn't exist - files named `cf-CC-rooms.txt` instead)
- No canvas element in HTML to render WebGL
- The WebGL rendering is never applied to the map display

**What's Happening Now**:
- [map.html](html/map.html) only shows a static background image with pan/zoom functionality
- The room data files exist and are properly structured but are **never loaded or rendered**
- The game logic tries to fetch room geometries but has nowhere to display them

**What Needs to be Done**:
1. Decide on rendering approach:
   - **Option A**: Use SVG to render room geometry (simpler, cleaner, more compatible)
   - **Option B**: Fix WebGL implementation (complex, powerful but overkill)
   - **Option C**: Use Canvas 2D API (middle ground)
2. Create proper room data loader compatible with actual file structure
3. Render room boundaries as interactive elements on the map
4. Add right-click point placement functionality
5. Connect room data to visual representation

### 2. **Map Navigation System Incomplete**
**Status**: Partially functional
**File**: [js/moving_map_script.js](js/moving_map_script.js)

**Issues**:
- Pan/zoom works with mouse
- Missing: Right-click placement for answer points
- Missing: Visual feedback for placed points
- Missing: Zoom constraints for small screens
- Missing: Mobile touch support (not mentioned but good to have)

**What Needs to be Done**:
1. Add right-click handler to place answer points on map
2. Store point coordinates relative to map
3. Show visual marker for placed points
4. Add confirmation/submit mechanism (currently says "press enter")

### 3. **Missing: Game Room/Area Selection Logic**
**Status**: Not implemented
**File**: [html/gameMode.html](html/gameMode.html) - Currently empty shell

**What Needs to be Done**:
1. Create difficulty selection (Easy/Medium/Hard)
2. Create game mode selection (currently only Classic)
3. Add game rules explanation
4. Link to actual game start (which loads map with random screenshot hint)

### 4. **Missing: Hint Image System**
**Status**: Not implemented

**What Needs to be Done**:
1. Create random screenshot selection from rooms
2. Display hint image on game screen
3. Ensure hint is from actual room (not borders)
4. Add image reveal/hide toggle

---

## 🟡 MEDIUM PRIORITY - GAME MECHANICS

### 5. **Missing: Scoring System**
**Status**: Not implemented

**What Needs to be Done**:
1. Create scoring function that calculates:
   - Distance to actual room
   - Time taken bonus/penalty
   - Correct region bonus
   - Correct room bonus
2. Display score after each round
3. Store scores for leaderboard

### 6. **Missing: Timer System**
**Status**: Not implemented

**What Needs to be Done**:
1. Start timer when game begins
2. Display elapsed time on screen
3. Use timer for scoring calculation
4. Optional: Set time limits per round

### 7. **Missing: Game State Management**
**Status**: Not implemented

**What Needs to be Done**:
1. Create game state tracker (menu → selecting → playing → scoring → end)
2. Persist state across page navigation
3. Handle game restart/quit

---

## 🟢 LOW PRIORITY - SECONDARY FEATURES

### 8. **Art-Amator Mode**
**Status**: Planned but not started
**Blocked by**: Game loop completion

### 9. **Account System**
**Status**: Not implemented
**Note**: This is intentionally LAST priority per requirements

**What Needs**:
1. User registration/login
2. Score database
3. User stats/leaderboard
4. Profile management

### 10. **Settings Page**
**Status**: Skeleton only
**File**: [html/setting.html](html/setting.html) (exists but empty)

**What Needs**:
1. Toggle: 1-layer vs 3-layer map view
2. Language selection (if needed)
3. Save preferences to localStorage

### 11. **Credits & Help Pages**
**Status**: Basic structure exists
**Files**: [html/credits.html](html/credits.html), [html/help.html](html/help.html)

**What Needs**:
1. Fill in actual credits
2. Create email form for help/feedback

---

## 📊 CURRENT STATE SUMMARY

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Main Menu | ✅ Working | - | Basic navigation works |
| Map Display | ⚠️ Broken | **CRITICAL** | Shows static image, can't render rooms |
| Map Navigation | 🟡 Partial | **CRITICAL** | Pan/zoom work, no point placement |
| Game Selection | ❌ Empty | **HIGH** | Just a button, no functionality |
| Hint Image System | ❌ Missing | **HIGH** | No screenshot system |
| Scoring | ❌ Missing | **MEDIUM** | No calculation/storage |
| Timer | ❌ Missing | **MEDIUM** | No time tracking |
| Account System | ❌ Missing | LOW | Intentionally last |
| Settings | ❌ Skeleton | LOW | Page exists, empty |
| Credits/Help | 🟡 Basic | LOW | Structure exists |

---

## 🔧 RECOMMENDED ACTION PLAN

### Phase 1: Fix Map Rendering (FIRST - BLOCKING)
1. Remove/fix broken WebGL code in [js/map.js](js/map.js)
2. Create room geometry loader that works with actual file structure
3. Implement SVG or Canvas 2D rendering for rooms
4. Display room boundaries and IDs on map

### Phase 2: Complete Map Interaction (SECOND)
1. Add right-click point placement
2. Add visual point markers
3. Add submit/confirm mechanism
4. Display selected room name when hovering

### Phase 3: Game Flow (THIRD)
1. Implement [html/gameMode.html](html/gameMode.html) selection
2. Create hint image system
3. Connect game to map
4. Implement round flow

### Phase 4: Scoring & State (FOURTH)
1. Add timer system
2. Create scoring algorithm
3. Implement game state management
4. Show results after each round

### Phase 5: Polish & Secondary Features (LATER)
1. Settings page
2. Credits/Help content
3. Mobile responsiveness
4. Account system (LAST)

---

## 📝 DATA STRUCTURE NOTES

**Room Files Available**:
- Located: `/map/World/Regions/Rooms/{REGION}-rooms/`
- Format: Text files with coordinates and geometry
- Structure: Position (x,y), Size (WxH), Tile data, Object connections
- Regions: CC, DS, HI, LF, SB, SH, SI, SL, SS, SU, UW (11 total)
- Sample: `/map/World/Regions/Rooms/CC-rooms/cc_a02.txt`

**Region Positions** (for map placement):
- File: `/map/World/Regions/Rooms/region_pos.txt`
- Format: `REGION:Xx-Yy` (e.g., `CC:-570x897`)

---

## ✅ WHAT'S ALREADY DONE WELL

1. ✅ Basic HTML structure and navigation
2. ✅ CSS styling and fonts
3. ✅ Pan/Zoom functionality for map
4. ✅ Room data files properly organized
5. ✅ Map data parsing infrastructure started
6. ✅ Main menu functional

---

**Generated**: January 30, 2026
**Focus**: Classic Game Mode → Map & Navigation Priority
