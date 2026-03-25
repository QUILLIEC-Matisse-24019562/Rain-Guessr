// room_detection.js
// Relies on: canvas, roomBoundaries — both defined in render.js
// Load order in HTML: render.js first, then room_detection.js

window.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.getElementById("room-tooltip");

    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();

        // --- Convert mouse pixel position to raw map space ---
        //
        // renderRoom() maps raw map coords to WebGL NDC via:
        //   ndcX = (mapX / canvas.width)  * 2      → range [-1, 1]
        //   ndcY = (mapY / canvas.height) * 2      → range [-1, 1]
        //
        // WebGL NDC (0,0) = canvas center, X right, Y up.
        // Mouse pixels: (0,0) = top-left, Y grows downward.
        //
        // Step 1 — pixel → NDC:
        //   ndcX =  (mousePixelX / canvas.width)  * 2 - 1
        //   ndcY = -((mousePixelY / canvas.height) * 2 - 1)   ← flip Y
        //
        // Step 2 — NDC → map space (inverse of renderRoom transform):
        //   mapX = ndcX * canvas.width  / 2
        //   mapY = ndcY * canvas.height / 2

        const mousePixelX = event.clientX - rect.left;
        const mousePixelY = event.clientY - rect.top;

        const ndcX =  (mousePixelX / canvas.width)  * 2 - 1;
        const ndcY = -((mousePixelY / canvas.height) * 2 - 1);

        const mapX = ndcX * canvas.width  / 2;
        const mapY = ndcY * canvas.height / 2;

        const roomName = detectRoomCollision(mapX, mapY);

        if (roomName) {
            renderBoundaryHighlight(roomName);
            if (tooltip) {
                tooltip.textContent = roomName;
                tooltip.style.display = "block";
                tooltip.style.left = (event.clientX + 14) + "px";
                tooltip.style.top  = (event.clientY - 28) + "px";
            }
        } else {
            clearHighlight();
            if (tooltip) tooltip.style.display = "none";
        }
    });

    canvas.addEventListener("mouseleave", () => {
        clearHighlight();
        if (tooltip) tooltip.style.display = "none";
    });
});

/**
 * Returns the room key (e.g. "SU/SU_A01") if the map-space point
 * (mapX, mapY) falls inside any room boundary, otherwise null.
 */
function detectRoomCollision(mapX, mapY) {
    for (const [roomKey, { x1, y1, x2, y2 }] of Object.entries(roomBoundaries)) {
        // roomBoundaries uses raw map space, same space as mapX/mapY
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        if (mapX >= minX && mapX <= maxX && mapY >= minY && mapY <= maxY) {
            console.log("Hovering room:", roomKey);
            return roomKey;
        }
    }
    return null;
}