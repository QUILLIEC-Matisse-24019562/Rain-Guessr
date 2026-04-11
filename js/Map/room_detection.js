// room_detection.js — mouse hover + click detection
// Depends on: canvas (render.js), roomBoundaries (map_loader.js),
//             renderBoundaryHighlight(), renderSelectionHighlight(),
//             clearHighlight(), clearSelection() (render.js)
// Load order: render.js → map_loader.js → room_detection.js → moving_map_script.js

window.selectedRoom = null; // currently selected room key

window.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.getElementById("room-tooltip");

    // ── Shared: pixel → map space ─────────────────────────────────────────
    function pixelToMap(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        const cx   = (clientX - rect.left) * dpr;
        const cy   = (clientY - rect.top)  * dpr;
        const cw   = canvas.width;
        const ch   = canvas.height;
        const s    = window.scale   || 1;
        const panX = window.mapPanX || 0;
        const panY = window.mapPanY || 0;
        return {
            mapX:  (cx - cw/2) / s - panX,
            mapY: -(cy - ch/2) / s - panY
        };
    }

    // ── Hover: highlight + tooltip ────────────────────────────────────────
    canvas.addEventListener("mousemove", (event) => {
        const { mapX, mapY } = pixelToMap(event.clientX, event.clientY);
        const roomKey = detectRoomCollision(mapX, mapY);

        if (roomKey) {
            renderBoundaryHighlight(roomKey);
            if (tooltip) {
                tooltip.textContent   = roomKey.split("/")[1]; // show only room name
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

    // ── Left click: select room ───────────────────────────────────────────
    canvas.addEventListener("click", (event) => {
        // Ignore if it was a right-click drag (moving_map_script.js handles right click)
        const { mapX, mapY } = pixelToMap(event.clientX, event.clientY);
        const roomKey = detectRoomCollision(mapX, mapY);

        if (roomKey) {
            window.selectedRoom = roomKey;
            renderSelectionHighlight(roomKey);

            // Update game UI selection display
            const selDisplay = document.getElementById("selected-room-name");
            if (selDisplay) selDisplay.textContent = roomKey.split("/")[1];

            const validateBtn = document.getElementById("btn-validate");
            if (validateBtn) validateBtn.disabled = false;
        }
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