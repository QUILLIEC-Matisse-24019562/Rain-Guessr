// map_loader.js — data fetching, geometry parsing, room boundary registration
// Exposes: roomBoundaries (read by render.js and room_detection.js)
// Depends on: initRender(), renderRoom() (defined in render.js)
// Load order: render.js → map_loader.js → room_detection.js

const roomBoundaries = {}; // key: "Region/RoomName" → { x1, y1, x2, y2 }

const map_path = "../map/World/Regions/Rooms";
let rooms = {};
let regionPosCache = null; // region_pos.txt loaded once, reused for every room

window.addEventListener("DOMContentLoaded", () => {
    loadMap();
});

// ---------------------------------------------------------------------------
// Map loading pipeline
// ---------------------------------------------------------------------------
async function loadMap() {
    console.log("Loading map from:", map_path);
    try {
        // 1. Load region list
        const regionsText = await fetch(map_path + "/regions.txt").then(r => r.text());
        const region_abbrs = regionsText.replaceAll("\r", "").split("\n")
            .map(r => r.trim()).filter(r => r !== "");

        // 2. Load region_pos.txt once and cache it
        const regionPosText = await fetch(map_path + "/region_pos.txt").then(r => r.text());
        regionPosCache = parseRegionPos(regionPosText);

        // 3. Load room lists for all regions in parallel
        await Promise.all(region_abbrs.map(region =>
            fetch(`${map_path}/${region}/cf-${region}.txt`)
                .then(r => r.text())
                .then(data => { rooms[region] = data.split("\n").map(r => r.trim()); })
                .catch(err => console.error(`Error loading room list for ${region}:`, err))
        ));

        // 4. Compile shader now that gl is ready (render.js DOMContentLoaded ran first)
        initRender();

        // 5. Load all room geometries, then render each region's batch
        const geometryArrays = await Promise.all(Object.keys(rooms).map(region => loadRegion(region)));
        geometryArrays.forEach(geom => { if (geom.length > 0) renderRoom(geom); });

        // 6. Load and draw connection lines for each region
        await Promise.all(Object.keys(rooms).map(region => loadConnections(region, regionPosCache)));

    } catch (err) {
        console.error("Error loading map:", err);
    }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
function parseRegionPos(text) {
    // Returns { "SU": [x, y], "SI": [x, y], ... }
    const result = {};
    text.split("\n").map(l => l.trim()).filter(Boolean).forEach(line => {
        const [key, val] = line.split(":");
        if (key && val) result[key.trim()] = val.split("x").map(Number);
    });
    return result;
}

async function loadRegion(region) {
    rooms[region].pop(); // remove trailing empty entry
    const geom = [];

    for (let room of rooms[region]) {
        if (room.endsWith(".txt")) room = room.slice(0, -4);
        if (!region || !room) { console.warn("Empty room entry, skipping."); continue; }
        try {
            const roomGeom = await loadRoomGeometry(region, room);
            if (roomGeom) geom.push(...roomGeom);
        } catch (err) {
            console.error(`Error loading geometry for ${region}/${room}:`, err);
        }
    }
    return geom;
}

async function loadRoomGeometry(region, room) {
    const roomPath = `${map_path}/${region}/${room}.txt`;
    try {
        const response = await fetch(roomPath);
        if (!response.ok) throw new Error(`File not found: ${roomPath}`);
        const data = await response.text();

        // Use region abbreviation before any '-' suffix to look up position
        const regionKey = region.split('-')[0];
        const region_position = regionPosCache[regionKey];
        if (!region_position) throw new Error(`Region "${regionKey}" not found in region_pos.txt`);

        return parseRoomGeometry(data, region_position, `${region}/${room}`);
    } catch (err) {
        console.error(`Error loading ${room}:`, err);
        return [];
    }
}

function parseRoomGeometry(data, region_pos, roomKey) {
    const lines = data.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Line 1: "WIDTHxHEIGHT" relative to render axes
    const [width, height] = lines[1].split("x").map(Number);
    // Line 2: room origin in tile space
    const [pos_x, pos_y] = lines[2].split("x").map(Number);

    // Boundary box mirrors the geometry line formula exactly:
    //   renderX = pos_x/2 + lx + region_pos[0]  → origin pos_x/2 + region_pos[0], spans +width
    //   renderY = pos_y/2 - ly + region_pos[1]  → origin pos_y/2 + region_pos[1], spans -height
    const x1 = pos_x / 2 + region_pos[0];
    const x2 = x1 + width;
    const y1 = pos_y / 2 + region_pos[1];
    const y2 = y1 - height;

    roomBoundaries[roomKey] = { x1, y1, x2, y2 };

    // Parse geometry line segments from last 6 lines of the file
    return lines.slice(-7, -1).flatMap(line =>
        line === "None|" ? [] :
        line.split("|").map(p => p.trim()).filter(Boolean).map(pair => {
            const [lx1, ly1, lx2, ly2] = pair.replace(/[()]/g, "").split(",").map(Number);
            return {
                x1: pos_x / 2 + lx1 + region_pos[0],
                y1: pos_y / 2 - ly1 + region_pos[1],
                x2: pos_x / 2 + lx2 + region_pos[0],
                y2: pos_y / 2 - ly2 + region_pos[1]
            };
        })
    );
}