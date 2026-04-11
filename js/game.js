// game.js — Rain Guessr game logic
// Responsibilities:
//   - Load the list of available screens from screens.txt
//   - Pick a random room
//   - Crop a random square from that room's screenshot using Canvas API
//   - Expose startGame() for use by the game UI

const SCREENS_PATH = "../map-reader/Screens";
const SCREENS_TXT  = `${SCREENS_PATH}/screens.txt`;
const CROP_SIZE    = 256; // side length of the challenge image in pixels

// Current game state — accessible by other scripts
window.currentRoom = null; // e.g. "SU/SU_A01"

// ── Load screen list ──────────────────────────────────────────────────────────

/**
 * Fetches screens.txt and returns an array of room entries.
 * Each entry is a string like "SU/SU_A01".
 */
async function loadScreenList() {
    const response = await fetch(SCREENS_TXT);
    if (!response.ok) throw new Error(`Could not load screens.txt (${response.status}). Run generate_image.py first.`);
    const text = await response.text();
    return text.split("\n").map(l => l.trim()).filter(Boolean);
}

// ── Pick random room ──────────────────────────────────────────────────────────

/**
 * Picks a random entry from the screen list.
 * Returns a string like "SU/SU_A01".
 */
function pickRandomRoom(screenList) {
    return screenList[Math.floor(Math.random() * screenList.length)];
}

// ── Load image ────────────────────────────────────────────────────────────────

/**
 * Loads an image from a URL and returns an HTMLImageElement.
 * Rejects if the image fails to load.
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

// ── Crop random square ────────────────────────────────────────────────────────

/**
 * Crops a random square of CROP_SIZE × CROP_SIZE from the given image.
 * Returns a data URL (PNG) of the cropped square.
 */
function cropRandomSquare(img, size = CROP_SIZE) {
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;

    // If the image is smaller than the crop size, scale it up first
    let drawW = srcW, drawH = srcH;
    if (srcW < size || srcH < size) {
        const scale = Math.max(size / srcW, size / srcH);
        drawW = Math.ceil(srcW * scale);
        drawH = Math.ceil(srcH * scale);
    }

    // Offscreen canvas at the (possibly upscaled) image size
    const offscreen = document.createElement("canvas");
    offscreen.width  = drawW;
    offscreen.height = drawH;
    const offCtx = offscreen.getContext("2d");
    offCtx.drawImage(img, 0, 0, drawW, drawH);

    // Random top-left corner guaranteed to fit the crop
    const maxX = drawW - size;
    const maxY = drawH - size;
    const left = Math.floor(Math.random() * (maxX + 1));
    const top  = Math.floor(Math.random() * (maxY + 1));

    // Crop canvas
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width  = size;
    cropCanvas.height = size;
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.drawImage(offscreen, left, top, size, size, 0, 0, size, size);

    console.log(`Cropped ${size}×${size} from (${left},${top}) of ${drawW}×${drawH}`);
    return cropCanvas.toDataURL("image/png");
}

// ── Full game start ───────────────────────────────────────────────────────────

/**
 * Starts a new game round:
 *   1. Loads screens.txt
 *   2. Picks a random room
 *   3. Loads its screenshot
 *   4. Crops a random square
 *   5. Returns { roomKey, imageDataUrl } for the UI to display
 *
 * roomKey format: "SU/SU_A01"
 * The correct answer is roomKey — do NOT expose this to the player directly.
 */
async function startGame(cropSize = CROP_SIZE) {
    // 1. Load screen list
    const screenList = await loadScreenList();
    if (!screenList.length) throw new Error("screens.txt is empty.");

    // 2. Pick random room
    const roomEntry = pickRandomRoom(screenList); // "SU/SU_A01"
    const [region, roomName] = roomEntry.split("/");
    window.currentRoom = roomEntry;

    // 3. Build image path and load
    const imgUrl = `${SCREENS_PATH}/${region}/${roomName}.png`;
    const img    = await loadImage(imgUrl);

    // 4. Crop random square
    const imageDataUrl = cropRandomSquare(img, cropSize);

    console.log(`New game — room: ${roomEntry}`);
    return { roomKey: roomEntry, imageDataUrl };
}

// ── Answer checking ───────────────────────────────────────────────────────────

/**
 * Checks whether the player's answer matches the current room.
 * playerAnswer: room key string e.g. "SU/SU_A01"
 * Returns true/false.
 */
function checkAnswer(playerAnswer) {
    if (!window.currentRoom) return false;
    return playerAnswer.toLowerCase() === window.currentRoom.toLowerCase();
}