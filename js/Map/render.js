// render.js — WebGL initialisation and drawing
// Exposes: initRender(), renderRoom(segments), renderBoundaryHighlight(roomKey),
//          renderSelectionHighlight(roomKey), clearHighlight(), clearSelection(),
//          renderConnections(connections)
// Depends on: roomBoundaries (map_loader.js)
// Load order: render.js → map_loader.js → room_detection.js → moving_map_script.js

let gl;
let canvas;
let shaderProgram;
let positionAttribute;
let uTranslate, uScale, uViewport, uColor;

const allSegments      = []; // all WebGL geometry buffers
const storedConnections = []; // all connection data for redraw

window.addEventListener("DOMContentLoaded", () => {
    console.log("Initialising WebGL...");

    canvas = document.querySelector("#canvas");
    if (!canvas) { console.error("Cannot find #canvas"); return; }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    gl = canvas.getContext("webgl");
    if (!gl) { console.error("Cannot initialise WebGL"); return; }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.ONE);
    console.log("WebGL initialised.");
});

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";

    ["canvas-overlay", "canvas-connections"].forEach(id => {
        const c = document.getElementById(id);
        if (!c) return;
        c.width  = canvas.width;
        c.height = canvas.height;
        c.style.width  = canvas.style.width;
        c.style.height = canvas.style.height;
    });

    if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        redraw();
    }
}

function initRender() {
    if (!gl) { console.error("initRender: gl is null"); return; }

    const vertexShaderSource = `
        attribute vec2 a_position;
        uniform vec2 u_translate;
        uniform float u_scale;
        uniform vec2 u_viewport;
        void main() {
            vec2 pos = (a_position + u_translate) * u_scale;
            vec2 ndc = pos / (u_viewport * 0.5);
            gl_Position = vec4(ndc.x, ndc.y, 0, 1);
        }
    `;
    const fragmentShaderSource = `
        precision mediump float;
        uniform vec4 u_color;
        void main() {
            gl_FragColor = u_color;
        }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertexShaderSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
        console.error("Vertex shader error:", gl.getShaderInfoLog(vs));

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentShaderSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
        console.error("Fragment shader error:", gl.getShaderInfoLog(fs));

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vs);
    gl.attachShader(shaderProgram, fs);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
        console.error("Shader link error:", gl.getProgramInfoLog(shaderProgram));

    gl.useProgram(shaderProgram);
    positionAttribute = gl.getAttribLocation(shaderProgram, "a_position");
    uTranslate = gl.getUniformLocation(shaderProgram, "u_translate");
    uScale     = gl.getUniformLocation(shaderProgram, "u_scale");
    uViewport  = gl.getUniformLocation(shaderProgram, "u_viewport");
    uColor     = gl.getUniformLocation(shaderProgram, "u_color");
    gl.enableVertexAttribArray(positionAttribute);
    gl.viewport(0, 0, canvas.width, canvas.height);

    console.log("Shader compiled and ready.");
}

function setRenderTransform(mapOffsetX, mapOffsetY, scale) {
    if (!shaderProgram) return;
    gl.useProgram(shaderProgram);
    gl.uniform2f(uTranslate, mapOffsetX, mapOffsetY);
    gl.uniform1f(uScale,     scale);
    gl.uniform2f(uViewport,  canvas.width, canvas.height);
}

// segments : [{x1,y1,x2,y2}] en coordonnées carte (tuiles, y vers le haut)
// color    : [r,g,b,a] (0..1) — rouge par défaut comme avant
function renderRoom(segments, color = [1, 0, 0, 1]) {
    if (!shaderProgram) { console.error("renderRoom called before initRender"); return; }

    const flatVertices = new Float32Array(segments.length * 4);
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        flatVertices[i * 4]     = s.x1;
        flatVertices[i * 4 + 1] = s.y1;
        flatVertices[i * 4 + 2] = s.x2;
        flatVertices[i * 4 + 3] = s.y2;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, flatVertices, gl.STATIC_DRAW);
    allSegments.push({ buf, count: flatVertices.length / 2, color });

    gl.useProgram(shaderProgram);
    gl.uniform4fv(uColor, color);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, flatVertices.length / 2);
}

function redraw() {
    if (!gl || !shaderProgram) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(shaderProgram);
    for (const { buf, count, color } of allSegments) {
        gl.uniform4fv(uColor, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, count);
    }
    redrawConnections();
    // Redraw persistent overlays (selection + located room) on top
    refreshOverlay();
}

// ---------------------------------------------------------------------------
// Map space → 2D canvas physical pixel
// Exact inverse of shader: px = (mapX + panX) * scale + cw/2
//                          py = -(mapY + panY) * scale + ch/2
// ---------------------------------------------------------------------------
function mapToCanvas(mx, my, targetCanvas) {
    const s    = window.scale   || 1;
    const panX = window.mapPanX || 0;
    const panY = window.mapPanY || 0;
    return {
        px:  (mx + panX) * s + targetCanvas.width  / 2,
        py: -(my + panY) * s + targetCanvas.height / 2
    };
}

// Draw a rect on the overlay canvas for a given room boundary
function drawRoomRect(ctx, roomKey, color, lineWidth, labelColor) {
    const dpr = window.devicePixelRatio || 1;
    const overlay = ctx.canvas;
    const b = roomBoundaries[roomKey];
    if (!b) return;

    const p1 = mapToCanvas(b.x1, b.y1, overlay);
    const p2 = mapToCanvas(b.x2, b.y2, overlay);
    const rx = Math.min(p1.px, p2.px);
    const ry = Math.min(p1.py, p2.py);
    const rw = Math.abs(p2.px - p1.px);
    const rh = Math.abs(p2.py - p1.py);

    ctx.strokeStyle = color;
    ctx.lineWidth   = lineWidth * dpr;
    ctx.strokeRect(rx, ry, rw, rh);

    if (labelColor) {
        ctx.fillStyle = labelColor;
        ctx.font = `bold ${14 * dpr}px monospace`;
        ctx.fillText(roomKey.split("/")[1], rx + 4, ry - 6 * dpr);
    }
}

// ── Located room (cyan, set from the console with locateRoom(), see room_locate.js) ──
window.locatedRoom = null;

function drawLocated(ctx) {
    if (window.locatedRoom) drawRoomRect(ctx, window.locatedRoom, "#00e5ff", 3, "#00e5ff");
}

// Clears the overlay and redraws every persistent highlight
function refreshOverlay() {
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (window.selectedRoom) drawRoomRect(ctx, window.selectedRoom, "#ff8800", 2.5, "#ff8800");
    drawLocated(ctx);
}

// ── Hover highlight (green, temporary) ──────────────────────────────────────
function renderBoundaryHighlight(roomKey) {
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    drawRoomRect(ctx, roomKey, "#00ff00", 2, "#00ff00");

    // Redraw selection on top if one exists
    if (window.selectedRoom && window.selectedRoom !== roomKey) {
        drawRoomRect(ctx, window.selectedRoom, "#ff8800", 2.5, "#ff8800");
    }
    drawLocated(ctx);
}

function clearHighlight() {
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Keep selection visible after hover clears
    if (window.selectedRoom) {
        drawRoomRect(ctx, window.selectedRoom, "#ff8800", 2.5, "#ff8800");
    }
    drawLocated(ctx);
}

// ── Selection highlight (orange, persistent) ─────────────────────────────────
function renderSelectionHighlight(roomKey) {
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawRoomRect(ctx, roomKey, "#ff8800", 2.5, "#ff8800");
    drawLocated(ctx);
}

function clearSelection() {
    window.selectedRoom = null;
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawLocated(ctx);
}

// ── Connections ───────────────────────────────────────────────────────────────
function renderConnections(connections) {
    storedConnections.push(...connections);
    redrawConnections();
}

function redrawConnections() {
    const connCanvas = document.getElementById("canvas-connections");
    if (!connCanvas) return;
    const ctx = connCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, connCanvas.width, connCanvas.height);
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth   = 0.5 * dpr;
    ctx.setLineDash([12 * dpr, 8 * dpr]);

    const DIR = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] };

    for (const c of storedConnections) {
        const p1 = mapToCanvas(c.x1, c.y1, connCanvas);
        const p2 = mapToCanvas(c.x2, c.y2, connCanvas);
        const dist   = Math.hypot(p2.px - p1.px, p2.py - p1.py);
        const cpDist = Math.max(20 * dpr, dist / 8);
        const d1 = DIR[c.dir1] || [0,0];
        const d2 = DIR[c.dir2] || [0,0];
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.bezierCurveTo(
            p1.px + d1[0]*cpDist, p1.py + d1[1]*cpDist,
            p2.px + d2[0]*cpDist, p2.py + d2[1]*cpDist,
            p2.px, p2.py
        );
        ctx.stroke();
    }
    ctx.setLineDash([]);
}