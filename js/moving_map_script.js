// moving_map_script.js — pan + zoom for map-room.html
// Controls:
//   Scroll wheel  → zoom in/out
//   Right click   → pan (drag)
//   Arrow keys    → pan

const container = document.getElementById('canvas-wrapper');
const canvas    = document.getElementById('canvas');

let isDragging = false;
let startX = 0, startY = 0;
let offsetX = 0, offsetY = 0;
let scale = 1;

function applyTransform() {
    container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// --- Scroll wheel: zoom ---
// Must be on window with passive:false to intercept before the page scrolls
window.addEventListener('wheel', (e) => {
    e.preventDefault();

    const zoomIntensity = 0.1 * scale;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    scale = Math.min(Math.max(0.5, scale + delta), 10);

    applyTransform();
}, { passive: false });

// --- Right click drag: pan ---
window.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    isDragging = true;
    document.body.style.cursor = 'grabbing';

    startX = e.pageX - offsetX;
    startY = e.pageY - offsetY;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    offsetX = e.pageX - startX;
    offsetY = e.pageY - startY;

    applyTransform();
});

window.addEventListener('mouseup', (e) => {
    if (e.button !== 2) return;
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
    }
});

// Suppress context menu everywhere on this page
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// --- Arrow keys: pan ---
const keyPanStep = 40;

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;

    let moved = true;
    switch (e.key) {
        case 'ArrowLeft':  offsetX += keyPanStep; break;
        case 'ArrowRight': offsetX -= keyPanStep; break;
        case 'ArrowUp':    offsetY += keyPanStep; break;
        case 'ArrowDown':  offsetY -= keyPanStep; break;
        default: moved = false;
    }

    if (moved) {
        e.preventDefault();
        applyTransform();
    }
});