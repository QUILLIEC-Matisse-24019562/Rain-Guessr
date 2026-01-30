/**
 * Map Pan & Zoom Script
 * Handles dragging and zooming for SVG map using viewBox
 */

const container = document.getElementById('map-container');
const svg = document.getElementById('map-svg');

let isDragging = false;
let startX = 0, startY = 0;
let startViewBox = { x: 0, y: 0, width: 0, height: 0 };

// Current viewBox values
let viewBoxX = 0;
let viewBoxY = 0;
let viewBoxWidth = 10000;
let viewBoxHeight = 10000;

// Make isDragging globally accessible
window.isDragging = false;

// Ensure container and svg exist
if (!container || !svg) {
    console.error('Map container or SVG not found');
}

/**
 * Get current viewBox values from SVG
 */
function getViewBox() {
    const vb = svg.getAttribute('viewBox');
    if (vb) {
        const parts = vb.split(' ').map(Number);
        viewBoxX = parts[0] || 0;
        viewBoxY = parts[1] || 0;
        viewBoxWidth = parts[2] || 10000;
        viewBoxHeight = parts[3] || 10000;
    }
    return { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight };
}

/**
 * Set viewBox on SVG
 */
function setViewBox(x, y, width, height) {
    viewBoxX = x;
    viewBoxY = y;
    viewBoxWidth = width;
    viewBoxHeight = height;
    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
}

/**
 * Initialize viewBox from SVG
 */
window.addEventListener('load', () => {
    getViewBox();
    console.log('Initial viewBox:', { viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight });
});

/**
 * Zoom with mouse wheel
 */
container.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Get current viewBox
    getViewBox();

    // Get mouse position relative to container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const worldX = viewBoxX + (mouseX / rect.width) * viewBoxWidth;
    const worldY = viewBoxY + (mouseY / rect.height) * viewBoxHeight;

    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8; // Zoom out or zoom in
    const newWidth = Math.max(500, Math.min(50000, viewBoxWidth * zoomFactor));
    const newHeight = Math.max(500, Math.min(50000, viewBoxHeight * zoomFactor));

    // Maintain aspect ratio
    const aspectRatio = viewBoxWidth / viewBoxHeight;
    const newAspect = newWidth / newHeight;

    let finalWidth = newWidth;
    let finalHeight = newHeight;

    if (newAspect > aspectRatio) {
        finalHeight = newWidth / aspectRatio;
    } else {
        finalWidth = newHeight * aspectRatio;
    }

    // Calculate new viewBox position to zoom towards mouse
    const newX = worldX - (mouseX / rect.width) * finalWidth;
    const newY = worldY - (mouseY / rect.height) * finalHeight;

    setViewBox(newX, newY, finalWidth, finalHeight);
});

/**
 * Start dragging
 */
container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click

    // Don't drag if clicking on a room
    const target = e.target.closest('.room-group');
    if (target) return;

    e.preventDefault();
    isDragging = true;
    window.isDragging = true;
    container.style.cursor = 'grabbing';

    // Store starting position and viewBox
    startX = e.clientX;
    startY = e.clientY;
    getViewBox();
    startViewBox = { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight };
});

/**
 * Handle dragging
 */
container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Calculate how much the mouse moved
    const rect = container.getBoundingClientRect();
    const deltaX = (e.clientX - startX) / rect.width * startViewBox.width;
    const deltaY = (e.clientY - startY) / rect.height * startViewBox.height;

    // Update viewBox based on drag
    setViewBox(
        startViewBox.x - deltaX,
        startViewBox.y - deltaY,
        startViewBox.width,
        startViewBox.height
    );
});

/**
 * End dragging
 */
container.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        window.isDragging = false;
        container.style.cursor = 'grab';
    }
});

/**
 * Cancel drag if mouse leaves
 */
container.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        window.isDragging = false;
        container.style.cursor = 'grab';
    }
});

/**
 * Reset map view
 */
function resetMapView() {
    // Get world bounds from rooms
    const roomsGroup = document.getElementById('rooms-group');
    const rooms = roomsGroup.querySelectorAll('.room-group');
    
    if (rooms.length === 0) {
        setViewBox(0, 0, 10000, 10000);
        return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const room of rooms) {
        const x = parseInt(room.getAttribute('data-pos-x')) || 0;
        const y = parseInt(room.getAttribute('data-pos-y')) || 0;
        const w = parseInt(room.getAttribute('data-width')) || 0;
        const h = parseInt(room.getAttribute('data-height')) || 0;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    }

    const padding = 200;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    setViewBox(minX - padding, minY - padding, width, height);
    console.log('Map view reset');
}

// Export functions for use in other scripts
window.mapControls = {
    getViewBox: () => ({ x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight }),
    setViewBox: setViewBox,
    reset: resetMapView
};


