// game.js — Rain Guessr game logic
// Responsibilities:
//   - Load the list of available screens from screens.txt
//   - Pick a random room
//   - Crop a square from that room's screenshot using Canvas API
//       · mode "hard"   : completely random square (can be black / empty / out of the playable area)
//       · mode "normal" : random square, but chosen among several candidates so that it shows
//                         something (not black, not a flat colour)
//   - Expose startGame() for use by the game UI
//C:\Users\matis\Documents\GitHub\Rain-Guessr\generate_game_picture\Screens\screens.txt
const SCREENS_PATH = "../../generate_game_picture/Screens";
const SCREENS_TXT  = `${SCREENS_PATH}/screens.txt`;
const CROP_SIZE    = 256; // side length of the challenge image in pixels

// ── Game mode ─────────────────────────────────────────────────────────────────
const GAME_MODES = ["normal", "hard"];
const MODE_STORAGE_KEY = "rainGuessrMode";

function loadSavedMode() {
    try {
        const m = localStorage.getItem(MODE_STORAGE_KEY);
        if (GAME_MODES.includes(m)) return m;
    } catch (e) { /* storage unavailable */ }
    return "normal";
}

// "normal" | "hard" — read by startGame()
window.gameMode = loadSavedMode();

function setGameMode(mode) {
    if (!GAME_MODES.includes(mode)) return window.gameMode;
    window.gameMode = mode;
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch (e) { /* ignore */ }
    return mode;
}

// ── "Interesting crop" settings (normal mode) ────────────────────────────────
const CROP_CANDIDATES = 80;   // random squares tried per round
const LUMA_VISIBLE    = 45;   // a pixel darker than this counts as "black"
const DETAIL_DELTA    = 10;   // luma gap with a neighbour for a pixel to count as "detail"
const MIN_VISIBLE     = 0.35; // wanted share of non-black pixels in the square
const MIN_DETAIL      = 0.05; // wanted share of detail pixels (rejects flat sky / flat colour)
const POOL_RATIO      = 0.70; // keep every candidate scoring >= 70 % of the best one

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

// ── Interesting-crop selection (pure functions, no DOM — testable in Node) ───

/**
 * Builds integral images of "visible" pixels (not black) and "detail" pixels (contrast with a
 * neighbour) so the share of each inside any square costs 4 lookups.
 * rgba : Uint8ClampedArray from getImageData, w × h pixels.
 * Returns scoreSquare(x, y, size) → { visible, detail, score } with score in 0..1
 * (1 = the square reaches both MIN_VISIBLE and MIN_DETAIL).
 */
function buildCropScorer(rgba, w, h) {
    const W1  = w + 1;
    const lum = new Float32Array(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
        lum[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    }

    const visI = new Uint32Array(W1 * (h + 1));
    const detI = new Uint32Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
        let visRow = 0, detRow = 0;
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const l = lum[i];
            if (l >= LUMA_VISIBLE) visRow++;
            const hasDetail =
                (x < w - 1 && Math.abs(l - lum[i + 1]) > DETAIL_DELTA) ||
                (y < h - 1 && Math.abs(l - lum[i + w]) > DETAIL_DELTA);
            if (hasDetail) detRow++;
            visI[(y + 1) * W1 + x + 1] = visI[y * W1 + x + 1] + visRow;
            detI[(y + 1) * W1 + x + 1] = detI[y * W1 + x + 1] + detRow;
        }
    }

    const rect = (I, x, y, s) =>
        I[(y + s) * W1 + x + s] - I[y * W1 + x + s] - I[(y + s) * W1 + x] + I[y * W1 + x];

    return function scoreSquare(x, y, size) {
        const area    = size * size;
        const visible = rect(visI, x, y, size) / area;
        const detail  = rect(detI, x, y, size) / area;
        return { visible, detail, score: Math.min(visible / MIN_VISIBLE, detail / MIN_DETAIL, 1) };
    };
}

/**
 * Tries CROP_CANDIDATES random squares and picks one of the good ones at random.
 * The bar adapts to the room: a room that is dark everywhere (shelters...) still gets
 * its best-looking squares instead of an error.
 * Returns { left, top, score }.
 */
function chooseInterestingCrop(rgba, w, h, size, rng = Math.random) {
    const scoreSquare = buildCropScorer(rgba, w, h);
    const maxX = w - size, maxY = h - size;

    const candidates = [];
    for (let i = 0; i < CROP_CANDIDATES; i++) {
        const left = Math.floor(rng() * (maxX + 1));
        const top  = Math.floor(rng() * (maxY + 1));
        candidates.push({ left, top, score: scoreSquare(left, top, size).score });
    }

    const best = Math.max(...candidates.map(c => c.score));
    const pool = candidates.filter(c => c.score >= best * POOL_RATIO);
    return pool[Math.floor(rng() * pool.length)];
}

// ── Crop random square ────────────────────────────────────────────────────────

/**
 * Crops a square of CROP_SIZE × CROP_SIZE from the given image.
 *   mode "hard"   : purely random position (may be black / outside the playable area)
 *   mode "normal" : random position among candidates that actually show something
 * Returns a data URL (PNG) of the cropped square.
 */
function cropRandomSquare(img, size = CROP_SIZE, mode = window.gameMode) {
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

    // Top-left corner guaranteed to fit the crop
    const maxX = drawW - size;
    const maxY = drawH - size;
    let left = Math.floor(Math.random() * (maxX + 1));
    let top  = Math.floor(Math.random() * (maxY + 1));

    if (mode !== "hard") {
        try {
            const { data } = offCtx.getImageData(0, 0, drawW, drawH);
            const pick = chooseInterestingCrop(data, drawW, drawH, size);
            left = pick.left;
            top  = pick.top;
            console.log(`Normal mode — crop quality ${pick.score.toFixed(2)}`);
        } catch (e) {
            // e.g. canvas tainted when the page is opened from file:// → keep the random square
            console.warn("Normal mode: could not analyse the image, using a random square.", e);
        }
    }

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
 *   4. Crops a square (random in "hard" mode, random-but-not-empty in "normal" mode)
 *   5. Returns { roomKey, imageDataUrl, mode } for the UI to display
 *
 * roomKey format: "SU/SU_A01"
 * The correct answer is roomKey — do NOT expose this to the player directly.
 */
async function startGame(cropSize = CROP_SIZE, mode = window.gameMode) {
    // 1. Load screen list
    const screenList = await loadScreenList();
    if (!screenList.length) throw new Error("screens.txt is empty.");

    // 2. Pick random room
    const roomEntry = pickRandomRoom(screenList); // "SU/SU_A01"
    const [region, roomName] = roomEntry.split("/");
    //window.currentRoom = roomEntry; //Region and room
    window.currentRoom = roomName; //just room

    // 3. Build image path and load
    const imgUrl = `${SCREENS_PATH}/${region}/${roomName}.png`;
    const img    = await loadImage(imgUrl);

    // 4. Crop random square
    const imageDataUrl = cropRandomSquare(img, cropSize, mode);

    console.log(`New game — room: ${roomEntry} (mode: ${mode})`);
    return { roomKey: roomEntry, imageDataUrl, mode };
}

// ── Answer checking ───────────────────────────────────────────────────────────

/**
 * Checks whether the player's answer matches the current room.
 * playerAnswer: room key string e.g. "SU/SU_A01"
 * Returns true/false.
 */
function checkAnswer(playerAnswer) {
    if (!window.currentRoom) return false;
    console.log(`Player Answer ${(playerAnswer.toLowerCase().split("/"))[1]}, good answer ${window.currentRoom.toLowerCase()}`);
    return (playerAnswer.toLowerCase().split("/"))[1] === window.currentRoom.toLowerCase();
}

// Node (tests) — ignored by the browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = { buildCropScorer, chooseInterestingCrop };
}