/**
 * Map Pan & Zoom Script
 * Handles dragging and zooming for SVG map
 */

const container = document.getElementById('map-container');
const svg = document.getElementById('map-svg');

let isDragging = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let offsetX = 0, offsetY = 0;
let scale = 1;

// Make isDragging globally accessible
window.isDragging = false;

// Ensure container and svg exist
if (!container || !svg) {
    console.error('Map container or SVG not found');
}

/**
 * Gestion du zoom avec la molette
 */
container.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Get mouse position relative to SVG
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom
    const zoomIntensity = 0.1 * scale;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    const newScale = Math.min(Math.max(0.1, scale + delta), 10);

    // Adjust position to zoom towards mouse
    const scaleDiff = newScale - scale;
    offsetX -= mouseX * scaleDiff / scale;
    offsetY -= mouseY * scaleDiff / scale;

    scale = newScale;
    currentX = offsetX;
    currentY = offsetY;

    applyTransform();
});

/**
 * Début du drag au clic gauche
 */
container.addEventListener('mousedown', (e) => {
    // Only drag on left click, not on SVG elements
    if (e.button !== 0) return;
    
    // Don't drag if clicking on a room (allow room selection)
    const target = e.target.closest('.room-group');
    if (target) return;

    e.preventDefault();
    isDragging = true;
    window.isDragging = true;
    container.style.cursor = 'grabbing';

    startX = e.pageX - offsetX;
    startY = e.pageY - offsetY;
});

/**
 * Déplacement pendant le drag
 */
container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    offsetX = e.pageX - startX;
    offsetY = e.pageY - startY;

    currentX = offsetX;
    currentY = offsetY;

    applyTransform();
});

/**
 * Fin du drag
 */
container.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        window.isDragging = false;
        container.style.cursor = 'grab';
    }
});

/**
 * Annuler le drag si la souris quitte le conteneur
 */
container.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        window.isDragging = false;
        container.style.cursor = 'grab';
    }
});

/**
 * Apply CSS transform to SVG
 */
function applyTransform() {
    svg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
}

/**
 * Reset map view
 */
function resetMapView() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    currentX = 0;
    currentY = 0;
    applyTransform();
    console.log('Map view reset');
}

// Export functions for use in other scripts
window.mapControls = {
    getScale: () => scale,
    setScale: (newScale) => { scale = newScale; applyTransform(); },
    getOffset: () => ({ x: offsetX, y: offsetY }),
    setOffset: (x, y) => { offsetX = x; offsetY = y; applyTransform(); },
    reset: resetMapView
};

