// render.js — WebGL initialisation and drawing
// Exposes: initRender(), renderRoom(segments), renderBoundaryHighlight(roomKey), clearHighlight()
// Depends on: roomBoundaries (defined in map_loader.js)
// Load order: render.js → map_loader.js → room_detection.js

let gl;
let canvas;
let shaderProgram;       // compiled once in initRender()
let positionAttribute;   // cached after compile

window.addEventListener("DOMContentLoaded", () => {
    console.log("Initialising WebGL...");

    canvas = document.querySelector("#canvas");
    if (!canvas) { console.error("Cannot find #canvas"); return; }

    gl = canvas.getContext("webgl");
    if (!gl) { console.error("Cannot initialise WebGL"); return; }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.ONE);
    console.log("WebGL initialised.");
});

// Compile shaders once. Called by map_loader.js after gl is ready.
function initRender() {
    if (!gl) { console.error("initRender: gl is null"); return; }

    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0, 1);
        }
    `;
    const fragmentShaderSource = `
        void main() {
            gl_FragColor = vec4(1, 0, 0, 1);
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
    gl.enableVertexAttribArray(positionAttribute);
    gl.viewport(0, 0, canvas.width, canvas.height);

    console.log("Shader compiled and ready.");
}

// Draw a batch of line segments (map space coords) onto the WebGL canvas.
function renderRoom(segments) {
    if (!shaderProgram) { console.error("renderRoom called before initRender"); return; }

    // Map space → WebGL NDC: ndcX = (mapX / canvas.width) * 2, same for Y
    const flatVertices = new Float32Array(
        segments.flatMap(s => [s.x1, s.y1, s.x2, s.y2])
                .map((v, i) => i % 2 === 0
                    ? (v / canvas.width)  * 2
                    : (v / canvas.height) * 2)
    );

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatVertices, gl.STATIC_DRAW);

    gl.useProgram(shaderProgram);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, flatVertices.length / 2);
}

// Draw a green boundary rectangle on the 2D overlay canvas for the hovered room.
function renderBoundaryHighlight(roomKey) {
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const b = roomBoundaries[roomKey];
    if (!b) return;

    // Map space → overlay pixel space (inverse of renderRoom's NDC transform)
    function mapToPixel(mx, my) {
        const ndcX = (mx / canvas.width)  * 2;
        const ndcY = (my / canvas.height) * 2;
        return {
            px: (ndcX + 1) / 2 * overlay.width,
            py: (1 - ndcY)  / 2 * overlay.height
        };
    }

    const p1 = mapToPixel(b.x1, b.y1);
    const p2 = mapToPixel(b.x2, b.y2);
    const rx = Math.min(p1.px, p2.px);
    const ry = Math.min(p1.py, p2.py);
    const rw = Math.abs(p2.px - p1.px);
    const rh = Math.abs(p2.py - p1.py);

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth   = 3;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle   = "#00ff00";
    ctx.font        = "bold 14px monospace";
    ctx.fillText(roomKey, rx + 4, ry - 6);
}

function clearHighlight() {
    const overlay = document.getElementById("canvas-overlay");
    if (!overlay) return;
    overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
}

// Draw connection lines between rooms on the dedicated 2D connections canvas.
function renderConnections(segments) {
    const connCanvas = document.getElementById("canvas-connections");
    if (!connCanvas) return;
    const ctx = connCanvas.getContext("2d");

    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth   = 2;

    function mapToPixel(mx, my) {
        const ndcX = (mx / canvas.width)  * 2;
        const ndcY = (my / canvas.height) * 2;
        return {
            px: (ndcX + 1) / 2 * connCanvas.width,
            py: (1 - ndcY)  / 2 * connCanvas.height
        };
    }

    for (const s of segments) {
        const p1 = mapToPixel(s.x1, s.y1);
        const p2 = mapToPixel(s.x2, s.y2);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
    }
}