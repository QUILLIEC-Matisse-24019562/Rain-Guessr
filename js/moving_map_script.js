// moving_map_script.js — pan + zoom for map-room.html
// Controls:
//   Scroll wheel  → zoom in/out (centered on cursor)
//   Right click   → pan (drag)
//   Arrow keys    → pan

let container;
let isDragging = false;
let startX = 0, startY = 0;

// Small value = far away, Big value = very close
const min_scale = 10
const max_scale = 0.2

window.offsetX = 0;
window.offsetY = 0;
window.scale   = 1;

function applyTransform() {
    container.style.transform = `translate(${window.offsetX}px, ${window.offsetY}px) scale(${window.scale})`;
}

window.addEventListener('DOMContentLoaded', () => {
    container = document.getElementById('canvas-wrapper');
    const canvasEl = document.getElementById('canvas');
    const overlay  = document.getElementById('canvas-overlay');

    if (!container || !canvasEl) { console.error('Canvas elements not found!'); return; }
    if (overlay) overlay.style.pointerEvents = 'none';

    // Center the canvas in the viewport on load
    window.offsetX = (window.innerWidth  - canvasEl.width)  / 2;
    window.offsetY = (window.innerHeight - canvasEl.height) / 2;
    applyTransform();

    // --- Scroll wheel: zoom centered on cursor ---
    canvasEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const oldScale = window.scale;
        const zoomIntensity = 0.1 * oldScale;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = Math.min(Math.max(max_scale, oldScale + delta), min_scale);

        const cursorX = e.clientX;
        const cursorY = e.clientY;

        window.offsetX = cursorX - (cursorX - window.offsetX) * (newScale / oldScale);
        window.offsetY = cursorY - (cursorY - window.offsetY) * (newScale / oldScale);
        window.scale   = newScale;

        applyTransform();
    }, { passive: false });

    // --- Right click drag: pan ---
    canvasEl.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        document.body.style.cursor = 'grabbing';

        startX = e.pageX - window.offsetX;
        startY = e.pageY - window.offsetY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        window.offsetX = e.pageX - startX;
        window.offsetY = e.pageY - startY;
        applyTransform();
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button !== 2) return;
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = '';
        }
    });

    canvasEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    // --- Arrow keys: pan ---
    const keyPanStep = 40;

    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') return;

        let moved = true;
        switch (e.key) {
            case 'ArrowLeft':  window.offsetX += keyPanStep; break;
            case 'ArrowRight': window.offsetX -= keyPanStep; break;
            case 'ArrowUp':    window.offsetY += keyPanStep; break;
            case 'ArrowDown':  window.offsetY -= keyPanStep; break;
            default: moved = false;
        }

        if (moved) {
            e.preventDefault();
            applyTransform();
        }
    });
});