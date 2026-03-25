let gl;
let geometry;
const roomBoundaries = {};

// Wait until the DOM (HTML Document) is loaded
window.addEventListener("DOMContentLoaded", () => {
    console.log("Initialisation of WebGL...");
    
    //try yo load the canvas to draw (the line) on the page
    let canvas = document.querySelector("#canvas");
    if (!canvas) {
        console.error("Error : Impossible to find the canvas");
        return;
    }
    //try to get the webgl context
    gl = canvas.getContext("webgl");
    if (!gl) {
        console.error("Error : Impossible to initialize Webgl");
        return;
    }

    gl.enable(gl.BLEND); //enable transparent color
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.ONE);
    console.log("WebGL initialize with success !");
});

let map_path = "../map/World/Regions/Rooms";
let rooms = {}; // Store the rooms by region

console.log("Starting to load rooms map from :", map_path);

// get the list of regions
fetch(map_path + "/regions.txt")
    .then(response => response.text())
    .then(async function(data) {
        let region_abbrs = data.replaceAll("\r", "").split("\n").map(region => region.trim()).filter(region => region !== "");

        let fetchPromises = region_abbrs.map(region =>
            fetch(map_path + "/" + region + "/cf-" + region + ".txt")
                .then(response => response.text())
                .then(data => {
                    rooms[region] = data.split("\n").map(room => room.trim()); // store the list of rooms by region
                })
                .catch(error => console.error("Error while loading rooms for region " + region, error))
        );

        // Wait until all room lists are loaded
        await Promise.all(fetchPromises);
        initRender();

        // Load all room geometries
        let loadRegionPromises = Object.keys(rooms).map(region => loadRegion(region));
        let geometryArray = await Promise.all(loadRegionPromises);

        geometryArray.forEach(geometry => {
            if (geometry.length > 0) renderRoom(geometry);
        });
    })
    .catch(error => console.error("Error while loading rooms:", error));

canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect(); // Get the canvas position on the page (relative to the viewport, the scroll)
    //const mouseX = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
    //const mouseY = ((rect.bottom - event.clientY) / canvas.height) * 2 - 1;
    const mouseX = event.clientX - rect.left - (canvas.width / 2);
    const mouseY = rect.bottom - event.clientY - (canvas.height / 2);
    //console.log("Mouse X:", mouseX, " event.clientX:", event.clientX, " rect.left:", rect.left, " canvas.width:", canvas.width)
    //console.log("Mouse Y:", mouseY, " event.clientY:", event.clientY, " rect.top:", rect.top, " rect.bottom:", rect.bottom, " canvas.height:", canvas.height)
    //correct pos = event.clientX - rect.left

    detectRoomCollision(mouseX, mouseY);
});

async function loadRegion(Region) {
    rooms[Region].pop(); // Remove last empty element if it exists

    let geom = [];

    for (let i = 0; i < rooms[Region].length; i++) {
        let Room = rooms[Region][i];

        if (Room.endsWith(".txt")) {
            Room = Room.slice(0, -4); // Remove ".txt" extension
        }

        if (Region && Room) {
            try {
                let roomGeom = await loadRoomGeometry(Region, Room); // Await result
                if (roomGeom) {
                    geom.push(...roomGeom); // Store geometry data
                }
            } catch (error) {
                console.error(`Error loading geometry for ${Region}/${Room}:`, error);
            }
        } else {
            console.warn("No room found.");
        }
    }

    return geom; // Return the collected geometry
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

        //console.log("Raw region position data:", pos_region);
        
        let pos_region_lines = pos_region.split("\n").map(line => line.trim()).filter(line => line);
        //console.log(pos_region_lines);
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
        
        return parseRoomGeometry(data, region_position);
    } catch (error) {
        console.error(`Error loading ${room}:`, error);
        return [];
    }
}
    
function parseRoomGeometry(data, region_pos) {
    const lines = data.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const [height, width] = lines[1].split("x").map(Number);
    const [pos_x, pos_y] = lines[2].split("x").map(Number);

    // Convert room position to WebGL space
    const x1 = (pos_x / 2 + region_pos[0]);
    const y1 = (pos_y / 2 + region_pos[1]);
    const x2 = x1 + width;
    const y2 = y1 + height;

    roomBoundaries[data] = { x1, y1, x2, y2 };

    return lines.slice(-7, -1).flatMap(line =>
        line === "None|" ? [] : line.split("|").map(pair => pair.trim()).filter(Boolean).map(pair => {
            const [x1, y1, x2, y2] = pair.replace(/[()]/g, "").split(",").map(Number);
            return {
                x1: (pos_x / 2 + x1 + region_pos[0]),
                y1: (pos_y / 2 - y1 + region_pos[1]),
                x2: (pos_x / 2 + x2 + region_pos[0]),
                y2: (pos_y / 2 - y2 + region_pos[1])
            };
        })
    );
}

function initRender() {
    if (!gl) {
        console.error("WebGL Error : Initiation of WebGL failed,. `gl` is null !");
        return;
    }
}

function detectRoomCollision(mouseX, mouseY) {
    for (const [room, { x1, y1, x2, y2 }] of Object.entries(roomBoundaries)) {
        //console.log("Checking boundaries:", x1, y1, x2, y2, "Mouse coordinates:", mouseX, mouseY);
        if (mouseX >= x1 && mouseX <= x2 && mouseY >= y1 && mouseY <= y2) {
            console.log("Mouse is inside room:");
            return;
        }
    }
    console.log("Mouse is not inside any room.");
}

function renderRoom(segments) {
    //console.log("WebGL rendering:", segments);
    //console.log("WebGL rendering:", segments.length, "segments");

    let flatVertices = segments.flatMap(s => [s.x1, s.y1, s.x2, s.y2]);

    // Center the coordinates in WebGL space ([-1, 1])
    const scaleX = 2 / canvas.width;  // Échelle pour l'axe X
    const scaleY = 2 / canvas.height; // Échelle pour l'axe Y

    flatVertices = flatVertices.map((value, index) => 
        index % 2 === 0  // X coordinate
            ? (value / canvas.width) * 2  // Transformation X pour centrer
            : (value / canvas.height) * 2 // Transformation Y pour centrer
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
            gl_FragColor = vec4(1, 0, 0, 1);  // Red color for the lines
        }
    `;

    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource)
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

    //gl.clearColor(0, 0, 0, 1); // Clear the canvas to black
    //gl.clear(gl.COLOR_BUFFER_BIT); // Actually clear the canvas

    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.drawArrays(gl.LINES, 0, flatVertices.length / 2);
}