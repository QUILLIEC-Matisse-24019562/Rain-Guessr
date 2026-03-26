// moving_map_script.js — pan + zoom for map-room.html
// Controls:
//   Scroll wheel  → zoom in/out
//   Right click   → pan (drag)
//   Arrow keys    → pan

// Note: canvas and gl are already declared globally by render.js
let container, isDragging = false;
let startX = 0, startY = 0;

// Expose these globally so room_detection.js can read them
window.offsetX = 0;
window.offsetY = 0;
window.scale = 1;

function applyTransform() {
    container.style.transform = `translate(${window.offsetX}px, ${window.offsetY}px) scale(${window.scale})`;
}

window.addEventListener('DOMContentLoaded', () => {
    console.log('moving_map_script.js initializing...');
    
    container = document.getElementById('canvas-wrapper');
    canvas    = document.getElementById('canvas');
    overlay   = document.getElementById('canvas-overlay');

    if (!container || !canvas) {
        console.error('Canvas elements not found!');
        return;
    }

    // Ensure overlay doesn't block events
    if (overlay) overlay.style.pointerEvents = 'none';

    // --- Scroll wheel: zoom ---
    // Listen on canvas directly to intercept wheel before browser zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Wheel event: deltaY =', e.deltaY);

        const zoomIntensity = 0.1 * window.scale;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        window.scale = Math.min(Math.max(0.5, window.scale + delta), 10);

        applyTransform();
    }, { passive: false });

    // --- Right click drag: pan ---
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return;

        console.log('Right mouse button down - start dragging');

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

    // Suppress context menu on canvas
    canvas.addEventListener('contextmenu', (e) => {
        console.log('Context menu suppressed');
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

    console.log('moving_map_script.js ready');
});