// room_detection.js — mouse hover detection, boundary highlight, tooltip
// Depends on: canvas (render.js), roomBoundaries (map_loader.js),
//             renderBoundaryHighlight(), clearHighlight() (render.js)
// Load order: render.js → map_loader.js → room_detection.js → moving_map_script.js

window.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.getElementById("room-tooltip");

    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;

        // Mouse position in physical canvas pixels
        const cx = (event.clientX - rect.left) * dpr;
        const cy = (event.clientY - rect.top)  * dpr;

        // Physical canvas pixels → map space
        // Shader transform: ndc = (mapPos + translate) * scale / (viewport/2)
        // Inverse: mapPos = (cx - cw/2) / scale - panX
        //          mapY is Y-flipped
        const cw   = canvas.width;
        const ch   = canvas.height;
        const s    = window.scale  || 1;
        const panX = window.mapPanX || 0;
        const panY = window.mapPanY || 0;

        const mapX =  (cx - cw/2) / s - panX;
        const mapY = -(cy - ch/2) / s - panY;

        const roomKey = detectRoomCollision(mapX, mapY);

        if (roomKey) {
            renderBoundaryHighlight(roomKey);
            if (tooltip) {
                tooltip.textContent   = roomKey;
                tooltip.style.display = "block";
                tooltip.style.left    = (event.clientX + 14) + "px";
                tooltip.style.top     = (event.clientY  - 28) + "px";
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

function detectRoomCollision(mapX, mapY) {
    for (const [roomKey, { x1, y1, x2, y2 }] of Object.entries(roomBoundaries)) {
        if (mapX >= Math.min(x1, x2) && mapX <= Math.max(x1, x2) &&
            mapY >= Math.min(y1, y2) && mapY <= Math.max(y1, y2)) {
            return roomKey;
        }
    }
    return null;
}