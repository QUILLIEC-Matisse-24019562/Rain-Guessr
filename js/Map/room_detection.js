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

function detectRoomCollision(mouseX, mouseY) {
    for (const [room, { x1, y1, x2, y2 }] of Object.entries(roomBoundaries)) {
        //console.log("Checking boundaries:", x1, y1, x2, y2, "Mouse coordinates:", mouseX, mouseY);
        if (mouseX >= x1 && mouseX <= x2 && mouseY >= y1 && mouseY <= y2) {
            console.log("Mouse is inside room:", roomBoundaries[room]);
            return;
        }
    }
    //console.log("Mouse is not inside any room.");
}
