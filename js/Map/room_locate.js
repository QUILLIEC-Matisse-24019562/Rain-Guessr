// room_locate.js — commandes console pour localiser une room sur la carte
// Dépend de : roomBoundaries (map_loader.js), canvas / refreshOverlay() (render.js),
//             applyTransform() (moving_map_script.js)
// Ordre de chargement : après moving_map_script.js
//
// Dans la console du navigateur (F12) :
//   locateRoom("su_a01")        → centre la vue sur la room, zoom automatique, cadre cyan
//   locateRoom("su_a01", 3)     → idem avec un zoom fixe de 3
//   locateRoom("su_a01", false) → centre sans changer le zoom
//   locateRoom("b10")           → recherche partielle (liste les résultats s'il y en a plusieurs)
//   listRooms("cc_")            → liste les rooms dont le nom contient "cc_"
//   clearLocate()               → retire le cadre cyan

(function () {
    // Nom court d'une clé : "CC-rooms/cc_b10" → "cc_b10"
    const shortName = key => key.split("/")[1];

    function matchRooms(query) {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return [];
        const keys = Object.keys(roomBoundaries);

        // 1. correspondance exacte (nom court ou clé complète)
        const exact = keys.filter(k => shortName(k).toLowerCase() === q || k.toLowerCase() === q);
        if (exact.length) return exact;

        // 2. correspondance partielle
        return keys.filter(k => k.toLowerCase().includes(q));
    }

    window.listRooms = function (query = "") {
        const keys = Object.keys(roomBoundaries);
        if (!keys.length) { console.warn("Carte pas encore chargée."); return []; }
        const q = String(query).trim().toLowerCase();
        const names = keys.filter(k => !q || k.toLowerCase().includes(q)).map(shortName).sort();
        console.log(`${names.length} room(s)${q ? ` contenant "${q}"` : ""}`);
        console.log(names.join(", "));
        return names;
    };

    window.clearLocate = function () {
        window.locatedRoom = null;
        if (typeof refreshOverlay === "function") refreshOverlay();
    };

    window.locateRoom = function (query, zoom) {
        if (!Object.keys(roomBoundaries).length) {
            console.warn("Carte pas encore chargée : réessaie quand l'écran CHARGEMENT a disparu.");
            return null;
        }

        const found = matchRooms(query);
        if (!found.length) {
            console.warn(`Aucune room ne correspond à "${query}". Essaie listRooms("${String(query).slice(0, 3)}").`);
            return null;
        }
        if (found.length > 1) {
            console.warn(`${found.length} rooms correspondent à "${query}" : ${found.map(shortName).join(", ")}`);
            console.warn(`→ je montre la première (${shortName(found[0])}). Utilise le nom exact pour choisir.`);
        }

        const key = found[0];
        const b   = roomBoundaries[key];
        const cx  = (b.x1 + b.x2) / 2;
        const cy  = (b.y1 + b.y2) / 2;
        const w   = Math.abs(b.x2 - b.x1);
        const h   = Math.abs(b.y2 - b.y1);

        // Centrer : le point carte (cx, cy) doit tomber au centre du canvas → pan = -centre
        window.mapPanX = -cx;
        window.mapPanY = -cy;

        // Zoom : fixe si un nombre est donné, inchangé si false, sinon la room occupe ~35 % de l'écran
        if (typeof zoom === "number") {
            window.scale = Math.min(Math.max(0.01, zoom), 50);
        } else if (zoom !== false) {
            const fit = Math.min((canvas.width * 0.35) / Math.max(w, 1), (canvas.height * 0.35) / Math.max(h, 1));
            window.scale = Math.min(Math.max(0.05, fit), 6);
        }

        window.locatedRoom = key;
        if (typeof applyTransform === "function") applyTransform(); // redessine aussi l'overlay

        console.log(`📍 ${shortName(key)} — centre (${cx.toFixed(1)}, ${cy.toFixed(1)}), taille ${w}×${h}`);
        return { room: shortName(key), key, x: cx, y: cy, width: w, height: h };
    };
})();