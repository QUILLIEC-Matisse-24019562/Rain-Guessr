// connection_loader.js — loads and renders room connection curves
// Depends on: roomBoundaries (map_loader.js), renderConnections() (render.js)
// Load order: render.js → map_loader.js → room_detection.js → connection_loader.js

// Called by map_loader.js once all rooms are loaded and rendered
async function loadConnections(region, regionPosCache) {
    const connPath = `${map_path}/${region}/link_${region.toLowerCase()}_connection.txt`;

    let text;
    try {
        const response = await fetch(connPath);
        if (!response.ok) {
            console.warn(`No connection file for region ${region}: ${connPath}`);
            return;
        }
        text = await response.text();
    } catch (err) {
        console.warn(`Could not load connections for ${region}:`, err);
        return;
    }

    const regionKey = region.split('-')[0];
    const region_pos = regionPosCache[regionKey];
    if (!region_pos) {
        console.warn(`Region position not found for ${regionKey}`);
        return;
    }

    // Each connection: { x1, y1, dir1, x2, y2, dir2 }
    // dir1 = exit direction from roomA, dir2 = exit direction from roomB (looked up from roomB's line)
    // We store all parsed endpoints first, then match pairs to get both directions.
    const endpointsByPair = {}; // pairKey → { ax, ay, dirA, bx, by, dirB, filled sides }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        if (line.startsWith('room|')) continue;

        const parts = line.split('|');
        // Format: roomA | count | roomB | posXxposY | dir | roomC | posXxposY | dir | ...
        const roomA = parts[0].trim().toLowerCase();
        const count = parseInt(parts[1]);

        let idx = 2; // current parse position in parts[]
        for (let i = 0; i < count; i++) {
            const roomB  = (parts[idx++] || '').trim().toLowerCase();
            const posStr = (parts[idx++] || '').trim();

            // Direction field is optional — detect it by checking if the next
            // field is a single cardinal letter rather than a room name or position
            const nextField = (parts[idx] || '').trim().toUpperCase();
            const dir = /^[NSEW]$/.test(nextField) ? (idx++, nextField) : '';

            if (!roomB || !posStr) continue;

            if (roomB.startsWith('gate_')) continue;

            const [tileX, tileY] = posStr.split('x').map(Number);

            // Swap X/Y: coordinate system is rotated 90°CW + vflip vs map space
            const mapTileX = tileY;
            const mapTileY = tileX;

            const boundaryA = getRoomBoundary(roomA, region);
            if (!boundaryA) {
                console.warn(`Missing boundary for ${roomA}`);
                continue;
            }

            const mapX = boundaryA.x1 + mapTileX;
            const mapY = boundaryA.y1 - mapTileY;

            // pairKey is sorted so A↔B and B↔A resolve to the same entry
            const pairKey = [roomA, roomB].sort().join('↔');
            if (!endpointsByPair[pairKey]) endpointsByPair[pairKey] = {};

            const entry = endpointsByPair[pairKey];
            // Tag which side of the pair this endpoint belongs to
            if (roomA <= roomB) {
                entry.ax = mapX; entry.ay = mapY; entry.dirA = dir;
            } else {
                entry.bx = mapX; entry.by = mapY; entry.dirB = dir;
            }
            // Also store room names so we can fall back to boundary center
            entry.roomA = entry.roomA || roomA;
            entry.roomB = entry.roomB || roomB;
            entry.region = region;
        }
    }

    // Build final connection list, filling in missing endpoints with boundary centers
    const connections = [];
    for (const [pairKey, e] of Object.entries(endpointsByPair)) {
        const boundaryB = getRoomBoundary(e.roomB, e.region);

        const x1   = e.ax  ?? (boundaryB ? (boundaryB.x1 + boundaryB.x2) / 2 : null);
        const y1   = e.ay  ?? (boundaryB ? (boundaryB.y1 + boundaryB.y2) / 2 : null);
        const dir1 = e.dirA ?? '';
        const x2   = e.bx  ?? (boundaryB ? (boundaryB.x1 + boundaryB.x2) / 2 : null);
        const y2   = e.by  ?? (boundaryB ? (boundaryB.y1 + boundaryB.y2) / 2 : null);
        const dir2 = e.dirB ?? '';

        if (x1 == null || x2 == null) continue;
        connections.push({ x1, y1, dir1, x2, y2, dir2 });
    }

    if (connections.length > 0) {
        renderConnections(connections);
        console.log(`Drew ${connections.length} connections for region ${region}`);
    }
}

// Find the roomBoundaries entry for a room name
function getRoomBoundary(roomName, region) {
    const key = `${region}/${roomName}`;
    if (roomBoundaries[key]) return roomBoundaries[key];
    for (const [k, v] of Object.entries(roomBoundaries)) {
        if (k.toLowerCase().endsWith('/' + roomName)) return v;
    }
    return null;
}