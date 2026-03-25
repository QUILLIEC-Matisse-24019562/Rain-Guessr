let gl;
let canvas;
let geometry;
const roomBoundaries = {}; // key: "Region/RoomName", value: { x1, y1, x2, y2 }

// Wait until the DOM (HTML Document) is loaded
window.addEventListener("DOMContentLoaded", () => {
    console.log("Initialisation of WebGL...");

    canvas = document.querySelector("#canvas");
    if (!canvas) {
        console.error("Error : Impossible to find the canvas");
        return;
    }

    gl = canvas.getContext("webgl");
    if (!gl) {
        console.error("Error : Impossible to initialize Webgl");
        return;
    }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.ONE);
    console.log("WebGL initialize with success !");
});

let map_path = "../map/World/Regions/Rooms";
let rooms = {};

console.log("Starting to load rooms map from :", map_path);

fetch(map_path + "/regions.txt")
    .then(response => response.text())
    .then(async function(data) {
        let region_abbrs = data.replaceAll("\r", "").split("\n").map(r => r.trim()).filter(r => r !== "");

        let fetchPromises = region_abbrs.map(region =>
            fetch(map_path + "/" + region + "/cf-" + region + ".txt")
                .then(response => response.text())
                .then(data => {
                    rooms[region] = data.split("\n").map(room => room.trim());
                })
                .catch(error => console.error("Error while loading rooms for region " + region, error))
        );

        await Promise.all(fetchPromises);
        initRender();

        let loadRegionPromises = Object.keys(rooms).map(region => loadRegion(region));
        let geometryArray = await Promise.all(loadRegionPromises);

        geometryArray.forEach(geometry => {
            if (geometry.length > 0) renderRoom(geometry);
        });
    })
    .catch(error => console.error("Error while loading rooms:", error));

async function loadRegion(Region) {
    rooms[Region].pop();

    let geom = [];

    for (let i = 0; i < rooms[Region].length; i++) {
        let Room = rooms[Region][i];

        if (Room.endsWith(".txt")) {
            Room = Room.slice(0, -4);
        }

        if (Region && Room) {
            try {
                let roomGeom = await loadRoomGeometry(Region, Room);
                if (roomGeom) {
                    geom.push(...roomGeom);
                }
            } catch (error) {
                console.error(`Error loading geometry for ${Region}/${Room}:`, error);
            }
        } else {
            console.warn("No room found.");
        }
    }

    return geom;
}

async function loadRoomGeometry(region, room) {
    let roomPath = `${map_path}/${region}/${room}.txt`;
    let region_pos_path = `${map_path}/region_pos.txt`;

    try {
        let response = await fetch(roomPath);
        if (!response.ok) throw new Error(`File not found: ${roomPath}`);
        let data = await response.text();

        let response2 = await fetch(region_pos_path);
        if (!response2.ok) throw new Error(`File not found: ${region_pos_path}`);
        let pos_region = await response2.text();

        let pos_region_lines = pos_region.split("\n").map(line => line.trim()).filter(line => line);
        let region_position = null;

        for (let i = 0; i < pos_region_lines.length; i++) {
            let region_pos = pos_region_lines[i].split(":");
            if (region_pos[0].trim() === region.split('-')[0]) {
                region_position = region_pos[1].split("x").map(Number);
                break;
            }
        }

        if (!region_position) {
            throw new Error(`Region ${region} not found in ${region_pos_path}`);
        }

        // Pass the room name (e.g. "SU/SU_A01") as the key for roomBoundaries
        return parseRoomGeometry(data, region_position, `${region}/${room}`);
    } catch (error) {
        console.error(`Error loading ${room}:`, error);
        return [];
    }
}

function parseRoomGeometry(data, region_pos, roomKey) {
    const lines = data.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    // Line 1: "HEIGHTxWIDTH" in file — but lx spans along X (width tiles) and ly spans along Y (height tiles)
    // The file format is actually WIDTHxHEIGHT relative to the render axes, so swap:
    const [width, height] = lines[1].split("x").map(Number);

    // Line 2: room position in tile space
    const [pos_x, pos_y] = lines[2].split("x").map(Number);

    // Boundary box — must use the exact same origin as the geometry lines:
    //   geometry renderX = pos_x/2 + lx + region_pos[0]  → origin is pos_x/2 + region_pos[0]
    //   geometry renderY = pos_y/2 - ly + region_pos[1]  → origin is pos_y/2 + region_pos[1], Y flipped
    //
    // lx ranges from 0 → width,  ly ranges from 0 → height (but subtracted, so Y goes down)
    const x1 = (pos_x / 2 + region_pos[0]);
    const x2 = x1 + width;
    const y1 = (pos_y / 2 + region_pos[1]);
    const y2 = y1 - height;  // Y is flipped: subtract height

    roomBoundaries[roomKey] = { x1, y1, x2, y2 };

    return lines.slice(-7, -1).flatMap(line =>
        line === "None|" ? [] : line.split("|").map(pair => pair.trim()).filter(Boolean).map(pair => {
            const [lx1, ly1, lx2, ly2] = pair.replace(/[()]/g, "").split(",").map(Number);
            return {
                x1: (pos_x / 2 + lx1 + region_pos[0]),
                y1: (pos_y / 2 - ly1 + region_pos[1]),
                x2: (pos_x / 2 + lx2 + region_pos[0]),
                y2: (pos_y / 2 - ly2 + region_pos[1])
            };
        })
    );
}

function initRender() {
    if (!gl) {
        console.error("WebGL Error : Initiation of WebGL failed. `gl` is null !");
        return;
    }
}

/**
 * Draw a green boundary rectangle on the 2D overlay canvas for the given roomKey.
 * The overlay canvas sits on top of the WebGL canvas (see map-room.html).
 * Coordinates are converted from raw map space → canvas pixel space.
 */
function renderBoundaryHighlight(roomKey) {
    const overlayCanvas = document.getElementById("canvas-overlay");
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext("2d");

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const boundary = roomBoundaries[roomKey];
    if (!boundary) return;

    const { x1, y1, x2, y2 } = boundary;

    // Map space → NDC (same transform renderRoom uses):
    //   ndcX = (mapX / canvas.width)  * 2
    //   ndcY = (mapY / canvas.height) * 2
    // NDC → pixel (canvas 2D origin = top-left, Y down):
    //   pixelX = (ndcX + 1) / 2 * canvas.width
    //   pixelY = (1 - ndcY) / 2 * canvas.height

    function mapToPixel(mapX, mapY) {
        const ndcX = (mapX / canvas.width)  * 2;
        const ndcY = (mapY / canvas.height) * 2;
        return {
            px: (ndcX + 1) / 2 * overlayCanvas.width,
            py: (1 - ndcY) / 2 * overlayCanvas.height
        };
    }

    const p1 = mapToPixel(x1, y1);
    const p2 = mapToPixel(x2, y2);

    const rectX = Math.min(p1.px, p2.px);
    const rectY = Math.min(p1.py, p2.py);
    const rectW = Math.abs(p2.px - p1.px);
    const rectH = Math.abs(p2.py - p1.py);

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth   = 3;
    ctx.strokeRect(rectX, rectY, rectW, rectH);

    // Label
    ctx.fillStyle  = "#00ff00";
    ctx.font       = "bold 14px monospace";
    ctx.fillText(roomKey, rectX + 4, rectY - 6);
}

function clearHighlight() {
    const overlayCanvas = document.getElementById("canvas-overlay");
    if (!overlayCanvas) return;
    overlayCanvas.getContext("2d").clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function renderRoom(segments) {
    let flatVertices = segments.flatMap(s => [s.x1, s.y1, s.x2, s.y2]);

    // Transform raw map-space coords into WebGL NDC space ([-1, 1])
    flatVertices = flatVertices.map((value, index) =>
        index % 2 === 0
            ? (value / canvas.width) * 2
            : (value / canvas.height) * 2
    );

    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatVertices), gl.STATIC_DRAW);

    let vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0, 1);
        }
    `;

    let fragmentShaderSource = `
        void main() {
            gl_FragColor = vec4(1, 0, 0, 1);
        }
    `;

    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    let shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader compilation failed: " + gl.getShaderInfoLog(vertexShader));
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader compilation failed: " + gl.getShaderInfoLog(fragmentShader));
    }
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Program linking failed: " + gl.getProgramInfoLog(shaderProgram));
    }

    gl.useProgram(shaderProgram);

    let positionAttribute = gl.getAttribLocation(shaderProgram, "a_position");
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.LINES, 0, flatVertices.length / 2);
}