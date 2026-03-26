// room_detection.js — mouse hover detection, boundary highlight, tooltip
// Depends on: canvas (render.js), roomBoundaries (map_loader.js),
//             renderBoundaryHighlight(), clearHighlight() (render.js)
// Load order: render.js → map_loader.js → room_detection.js → moving_map_script.js

window.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.getElementById("room-tooltip");

    canvas.addEventListener("mousemove", (event) => {
        // getBoundingClientRect() already accounts for any CSS transform
        // (pan/zoom applied to #canvas-wrapper), so we do NOT need to
        // manually reverse offsetX/offsetY/scale — that would apply it twice.
        const rect = canvas.getBoundingClientRect();

        // Mouse position in canvas pixel space (0..canvas.width, 0..canvas.height)
        // rect.width reflects the visually scaled size, so we scale back to
        // the canvas's actual resolution
        const px = (event.clientX - rect.left) * (canvas.width  / rect.width);
        const py = (event.clientY - rect.top)  * (canvas.height / rect.height);

        // Canvas pixel → NDC: ndcX = (px / canvas.width) * 2 - 1, ndcY flips Y
        // NDC → map space:    mapX = ndcX * canvas.width / 2
        const ndcX =  (px / canvas.width)  * 2 - 1;
        const ndcY = -((py / canvas.height) * 2 - 1);
        const mapX = ndcX * canvas.width  / 2;
        const mapY = ndcY * canvas.height / 2;

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