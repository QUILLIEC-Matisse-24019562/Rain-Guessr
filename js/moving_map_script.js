// moving_map_script.js — pan + zoom for map-room.html
// Controls:
//   Scroll wheel  → zoom in/out (centered on cursor)
//   Right click   → pan (drag)
//   Arrow keys    → pan
//
// Instead of CSS transform on #canvas-wrapper, pan/zoom is applied via
// WebGL uniforms (setRenderTransform) so the canvas renders at native
// screen resolution and stays sharp at any zoom level.

let isDragging = false;
let startX = 0, startY = 0;

// Pan in map-space units, zoom is a scale factor
window.mapPanX = 0;
window.mapPanY = 0;
window.scale   = 1;

// Legacy CSS offset aliases (used by room_detection.js for coordinate math)
Object.defineProperty(window, 'offsetX', { get: () => 0 });
Object.defineProperty(window, 'offsetY', { get: () => 0 });

function applyTransform() {
    // Push pan/zoom into the WebGL shader
    if (typeof setRenderTransform === 'function') {
        setRenderTransform(window.mapPanX, window.mapPanY, window.scale);
    }
    if (typeof redraw === 'function') redraw();
}

window.addEventListener('DOMContentLoaded', () => {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) { console.error('Canvas not found'); return; }

    // Center map on load — canvas is now viewport-sized
    // Map coordinate (0,0) maps to canvas center at scale 1
    // No initial offset needed; map data is centred by its own coordinates
    applyTransform();

    // --- Scroll wheel: zoom centered on cursor ---
    canvasEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const oldScale = window.scale;
        const zoomIntensity = 0.1 * oldScale;
        const delta    = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = Math.min(Math.max(0.01, oldScale + delta), 50);

        // Cursor position in canvas physical pixels
        const dpr  = window.devicePixelRatio || 1;
        const rect = canvasEl.getBoundingClientRect();
        const cx   = (e.clientX - rect.left)  * dpr;
        const cy   = (e.clientY - rect.top)   * dpr;

        // Convert cursor physical px → map space at current transform
        // Inverse of shader: mapX = (cx - cw/2) / scale - panX
        const cw = canvasEl.width, ch = canvasEl.height;
        const mapCursorX =  (cx - cw/2) / oldScale - window.mapPanX;
        const mapCursorY = -(cy - ch/2) / oldScale - window.mapPanY;

        // After scale change, keep the same map point under the cursor:
        // mapCursorX = (cx - cw/2) / newScale - newPanX
        // → newPanX = (cx - cw/2) / newScale - mapCursorX
        window.mapPanX =  (cx - cw/2) / newScale - mapCursorX;
        window.mapPanY = -(cy - ch/2) / newScale - mapCursorY;
        window.scale   = newScale;

        applyTransform();
    }, { passive: false });

    // --- Right click drag: pan ---
    canvasEl.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return;
        e.preventDefault();
        isDragging = true;
        document.body.style.cursor = 'grabbing';
        startX = e.clientX;
        startY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dpr = window.devicePixelRatio || 1;
        // Convert CSS pixel drag to map-space delta
        const dx =  (e.clientX - startX) * dpr / window.scale;
        const dy = -(e.clientY - startY) * dpr / window.scale; // Y flipped
        window.mapPanX += dx;
        window.mapPanY += dy;
        startX = e.clientX;
        startY = e.clientY;
        applyTransform();
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button !== 2) return;
        isDragging = false;
        document.body.style.cursor = '';
    });

    canvasEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    // --- Arrow keys: pan ---
    const keyPanStep = 20; // map-space units per keypress

    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') return;

        let moved = true;
        switch (e.key) {
            case 'ArrowLeft':  window.mapPanX -= keyPanStep; break;
            case 'ArrowRight': window.mapPanX += keyPanStep; break;
            case 'ArrowUp':    window.mapPanY += keyPanStep; break;
            case 'ArrowDown':  window.mapPanY -= keyPanStep; break;
            default: moved = false;
        }
        if (moved) { e.preventDefault(); applyTransform(); }
    });
});