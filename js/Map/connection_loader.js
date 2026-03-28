// connection_loader.js — loads and renders room connection lines
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

    const segments = [];
    const seen = new Set(); // avoid drawing each connection twice

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        // Skip the legend line at the bottom
        if (line.startsWith('room|')) continue;

        const parts = line.split('|');
        // parts[0] = room name, parts[1] = count, then pairs of [name, posXxposY]
        const roomA = parts[0].trim().toLowerCase();
        const count = parseInt(parts[1]);

        for (let i = 0; i < count; i++) {
            const roomB    = parts[2 + i * 2].trim().toLowerCase();
            const posStr   = parts[3 + i * 2].trim(); // e.g. "23x3"
            const [tileX, tileY] = posStr.split('x').map(Number);

            // Skip gate connections (they have no room boundary)
            if (roomB.startsWith('gate_')) continue;

            // Deduplicate: sort the pair so A-B and B-A produce the same key
            const pairKey = [roomA, roomB].sort().join('↔');
            if (seen.has(pairKey)) continue;
            seen.add(pairKey);

            // Find the other room's matching connection point
            // The posStr is the tile coord *within roomA* where the connection exits.
            // We also need roomB's connection point back to roomA — but since we
            // deduplicate, we just draw a line from roomA's exit tile to roomB's entry tile.
            // Both points are looked up from roomBoundaries + their tile offsets.

            const boundaryA = getRoomBoundaryKey(roomA, region);
            const boundaryB = getRoomBoundaryKey(roomB, region);

            if (!boundaryA || !boundaryB) {
                console.warn(`Missing boundary for connection ${roomA} ↔ ${roomB}`);
                continue;
            }

            // Tile coord within roomA → map space.
            // The connection file stores (tileX, tileY) but the coordinate system
            // is rotated 90° clockwise then flipped vertically relative to map space,
            // which is equivalent to simply swapping X and Y: mapTileX = tileY, mapTileY = tileX
            const mapTileX = tileY;
            const mapTileY = tileX;

            const originAX = boundaryA.x1;
            const originAY = boundaryA.y1;
            const mapAX = originAX + mapTileX;
            const mapAY = originAY - mapTileY;

            // For roomB's end, use the center of its bounding box as the target
            // (we don't have roomB's exact exit tile in this direction without parsing again)
            const mapBX = (boundaryB.x1 + boundaryB.x2) / 2;
            const mapBY = (boundaryB.y1 + boundaryB.y2) / 2;

            segments.push({ x1: mapAX, y1: mapAY, x2: mapBX, y2: mapBY });
        }
    }

    if (segments.length > 0) {
        renderConnections(segments);
        console.log(`Drew ${segments.length} connections for region ${region}`);
    }
}

// Find the roomBoundaries entry for a room name, trying region-prefixed key first
function getRoomBoundaryKey(roomName, region) {
    // Try "REGION/roomname" format (as stored by map_loader.js)
    const key = `${region}/${roomName}`;
    if (roomBoundaries[key]) return roomBoundaries[key];

    // Fall back: search all boundaries for a matching room name
    for (const [k, v] of Object.entries(roomBoundaries)) {
        if (k.toLowerCase().endsWith('/' + roomName)) return v;
    }
    return null;
}