#!/usr/bin/env python3
"""
convert_rooms.py : extrait la géométrie des rooms Rain World depuis les fichiers
bruts du jeu (vanilla, Downpour, Watcher).

Usage :
    python convert_rooms.py <dossier_worlds> <dossier_sortie>

    <dossier_worlds> contient les dossiers 'world', 'world downpour', 'world Watcher'
    (chacun avec un sous-dossier 'world' contenant les <region>-rooms).

Sortie :
    <sortie>/<jeu>/<REGION>/<room>.json   géométrie vectorielle de la room
    <sortie>/<jeu>/index.json             room -> région (+ 'overrides' si elle remplace une room vanilla)
    <sortie>/report.json                  rooms douteuses, avec la raison
"""
import json, os, sys
from collections import defaultdict

# ── 1. Décodage d'une tuile ───────────────────────────────────────────────
# Une tuile = "terrain,flag,flag,..."  (l'ordre des flags n'a AUCUNE importance)
#   terrain : 0 air | 1 solide | 2 pente | 3 sol traversable | 4 entrée de raccourci
#   flags   : 1 poteau vertical | 2 poteau horizontal | (les autres : ignorés ici)
AIR, SOLID, SLOPE, FLOOR, SHORTCUT = range(5)


def decode_tile(tok):
    parts = [p for p in tok.split(",") if p != ""]
    if not parts:
        raise ValueError("tuile vide")
    terrain = int(parts[0])
    flags = {int(p) for p in parts[1:]}
    if terrain > SHORTCUT:
        raise ValueError(f"terrain invalide {terrain}")
    return terrain, (1 in flags), (2 in flags)


# ── 2. Lecture + validation d'une room ────────────────────────────────────
def read_room(path):
    """Retourne (room, problèmes). room = None si la room est inutilisable."""
    problems = []
    with open(path, errors="replace") as f:
        raw = f.read().replace("\r", "").split("\n")
    lines = [l for l in raw if l.strip()]
    if len(lines) < 5:
        return None, ["fichier incomplet (moins de 5 lignes)"]
    name = lines[0].strip()
    try:
        w, h = (int(v) for v in lines[1].split("|")[0].split("*"))
    except ValueError:
        return None, ["IGNOREE : pas une room (settings, world_xx, gates...)"]
    # Fichier brut du jeu : les tuiles sont à la ligne 12 (les lignes 6 à 9 sont
    # vides, donc on compte sur le fichier non filtré). Version réduite : dernière ligne.
    tile_line = raw[11] if len(raw) >= 12 else lines[-1]
    toks = tile_line.split("|")
    if toks and toks[-1] == "":
        toks = toks[:-1]

    n, expected = len(toks), w * h
    if n <= 1:
        return None, ["IGNOREE : pas de géométrie (fichier de passerelle/stub)"]
    if n > expected:
        # Tuiles en trop à la fin : on garde les premières, mais on le signale
        problems.append(f"{n - expected} tuile(s) en trop ({n} pour {w}x{h}={expected}), ignorées")
    elif n < expected:
        problems.append(f"{n} tuiles pour {w}x{h}={expected}")
        # Une seule dimension du header est fausse : on la déduit des données
        guess = []
        if n % h == 0:
            guess.append((n // h, h))
        if n % w == 0:
            guess.append((w, n // w))
        if not guess:
            return None, problems + ["taille impossible à déduire"]
        w, h = guess[0]
        problems.append(f"taille déduite des données : {w}x{h}"
                        + (" (AMBIGU : l'autre option est %dx%d)" % guess[1] if len(guess) > 1 else ""))
        expected = w * h
    toks = toks[:expected]  # tuiles en trop en fin de ligne : ignorées

    tiles = [[None] * w for _ in range(h)]
    bad = 0
    for x in range(w):  # les données sont rangées colonne par colonne
        for y in range(h):
            try:
                tiles[y][x] = decode_tile(toks[x * h + y])
            except ValueError:
                tiles[y][x] = (AIR, False, False)
                bad += 1
    if bad:
        problems.append(f"{bad} tuile(s) illisible(s) (flux de données décalé ?)")
    return {"name": name, "w": w, "h": h, "tiles": tiles}, problems


# ── 3. Pentes : même logique que le jeu (Room.IdentifySlope) ──────────────
def terrain_at(tiles, w, h, x, y):
    if x < 0 or y < 0 or x >= w or y >= h:
        return SOLID  # hors de la room = solide, comme dans le jeu
    return tiles[y][x][0]


def slope_triangle(tiles, w, h, x, y):
    """Sommets (sens horaire) de la partie SOLIDE d'une pente, ou None."""
    s = lambda dx, dy: terrain_at(tiles, w, h, x + dx, y + dy) == SOLID
    if s(-1, 0):
        if s(0, -1): d = "UL"
        elif s(0, 1): d = "DL"
        else: return None
    elif s(1, 0):
        if s(0, -1): d = "UR"
        elif s(0, 1): d = "DR"
        else: return None
    else:
        return None
    X, Y = x, y
    return {
        "UL": [(X, Y), (X + 1, Y), (X, Y + 1)],
        "UR": [(X, Y), (X + 1, Y), (X + 1, Y + 1)],
        "DL": [(X, Y), (X + 1, Y + 1), (X, Y + 1)],
        "DR": [(X + 1, Y), (X + 1, Y + 1), (X, Y + 1)],
    }[d]


# ── 4. Contours exacts : annulation d'arêtes puis chaînage ────────────────
def solid_polygons(room):
    tiles, w, h = room["tiles"], room["w"], room["h"]
    pieces = []
    unresolved = []
    for y in range(h):
        for x in range(w):
            t = tiles[y][x][0]
            if t == SOLID:
                pieces.append([(x, y), (x + 1, y), (x + 1, y + 1), (x, y + 1)])
            elif t == SLOPE:
                tri = slope_triangle(tiles, w, h, x, y)
                if tri is None:
                    unresolved.append((x, y))  # pente cassée : comme le jeu, on n'y met rien
                else:
                    pieces.append(tri)

    # Toutes les pièces sont orientées pareil ; une arête partagée apparaît
    # une fois dans chaque sens → elles s'annulent, il ne reste que le contour.
    edges = defaultdict(int)
    for p in pieces:
        area = sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
                   for i in range(len(p)))
        if area < 0:
            p = p[::-1]
        for i in range(len(p)):
            a, b = p[i], p[(i + 1) % len(p)]
            if edges.get((b, a), 0) > 0:
                edges[(b, a)] -= 1
            else:
                edges[(a, b)] += 1
    out = defaultdict(list)
    for (a, b), c in edges.items():
        for _ in range(c):
            out[a].append(b)

    polys = []
    while out:
        start = next(iter(out))
        loop, cur = [start], start
        while True:
            nxts = out[cur]
            nxt = nxts.pop()
            if not nxts:
                del out[cur]
            if nxt == start:
                break
            loop.append(nxt)
            cur = nxt
        polys.append(simplify(loop))
    return polys, unresolved


def simplify(loop):
    """Retire les points alignés."""
    res, n = [], len(loop)
    for i in range(n):
        p0, p1, p2 = loop[i - 1], loop[i], loop[(i + 1) % n]
        cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0])
        if cross != 0:
            res.append(p1)
    return res


def polygon_area(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
               for i in range(len(p))) / 2


# ── 5. Poteaux, sols, raccourcis ──────────────────────────────────────────
def runs(flags, w, h, horizontal):
    """Fusionne les cases alignées en segments."""
    segs = []
    outer, inner = (h, w) if horizontal else (w, h)
    for o in range(outer):
        start = None
        for i in range(inner + 1):
            x, y = (i, o) if horizontal else (o, i)
            on = i < inner and flags(x, y)
            if on and start is None:
                start = i
            if not on and start is not None:
                segs.append([start, o + .5, i, o + .5] if horizontal
                            else [o + .5, start, o + .5, i])
                start = None
    return segs


def extract(room):
    tiles, w, h = room["tiles"], room["w"], room["h"]
    polys, unresolved = solid_polygons(room)
    air = lambda x, y: tiles[y][x][0] in (AIR, FLOOR, SHORTCUT)
    floors = []
    for y in range(h):
        start = None
        for x in range(w + 1):
            on = x < w and tiles[y][x][0] == FLOOR
            if on and start is None: start = x
            if not on and start is not None:
                floors.append([start, y, x, y]); start = None
    return {
        "name": room["name"], "w": w, "h": h,
        "solid": [[list(p) for p in poly] for poly in polys],
        "floors": floors,
        "poles_v": runs(lambda x, y: tiles[y][x][1] and air(x, y), w, h, False),
        "poles_h": runs(lambda x, y: tiles[y][x][2] and air(x, y), w, h, True),
        "shortcuts": [[x, y] for y in range(h) for x in range(w)
                      if tiles[y][x][0] == SHORTCUT],
        "broken_slopes": [list(c) for c in unresolved],
    }


def selfcheck(room, data):
    """Aire des contours (trous déduits) == aire des cases solides."""
    tiles = room["tiles"]
    want = 0.0
    for y in range(room["h"]):
        for x in range(room["w"]):
            t = tiles[y][x][0]
            if t == SOLID: want += 1
            elif t == SLOPE and slope_triangle(tiles, room["w"], room["h"], x, y): want += .5
    got = sum(polygon_area([tuple(p) for p in poly]) for poly in data["solid"])
    return abs(got) == want or abs(got - want) < 1e-6


# ── 6. Programme principal ────────────────────────────────────────────────
def collect(tree):
    """Toutes les rooms d'un dossier : {nom: (chemin, région)}.
    Une room = un fichier dont la ligne 2 ressemble à '54*35|-1|0'."""
    import re
    found = {}
    for root, _, files in sorted(os.walk(tree)):
        folder = os.path.basename(root).lower()
        region = folder[:-6] if folder.endswith("-rooms") else folder
        for f in sorted(files):
            if not f.endswith(".txt") or "settings" in f:
                continue
            path = os.path.join(root, f)
            with open(path, errors="replace") as fh:
                head = [fh.readline() for _ in range(2)]
            if not re.fullmatch(r"\d+\*\d+\|.*", head[1].strip()):
                continue
            key = f[:-4].lower()
            # doublon (ex: ss_ai présent dans 2 dossiers) : on garde le dossier '-rooms'
            if key not in found or (folder.endswith("-rooms") and not found[key][2]):
                found[key] = (path, region, folder.endswith("-rooms"))
    return {k: (v[0], v[1]) for k, v in found.items()}


def game_name(folder):
    n = folder.lower()
    return "downpour" if "downpour" in n else "watcher" if "watcher" in n else "vanilla"


def main():
    src, dst = sys.argv[1], sys.argv[2]
    report, trees = {}, {}
    for entry in sorted(os.scandir(src), key=lambda e: e.name):
        if entry.is_dir():
            trees[game_name(entry.name)] = collect(entry.path)
    for game, rooms in trees.items():
        index, done = {}, 0
        for key, (path, region) in rooms.items():
            room, problems = read_room(path)
            if room is None:
                if not problems[0].startswith("IGNOREE"):
                    report[f"{game}/{key}"] = {"status": "ECHEC", "problems": problems}
                continue
            data = extract(room)
            if data["broken_slopes"]:
                problems.append(f"{len(data['broken_slopes'])} pente(s) sans orientation")
            if not selfcheck(room, data):
                problems.append("contours incohérents avec la grille (aire différente)")
            if problems:
                report[f"{game}/{key}"] = {"status": "A VERIFIER", "problems": problems}
            reg = region.upper()
            os.makedirs(os.path.join(dst, game, reg), exist_ok=True)
            with open(os.path.join(dst, game, reg, key + ".json"), "w") as out:
                json.dump(data, out, separators=(",", ":"))
            index[key] = {"region": reg}
            if game != "vanilla" and key in trees.get("vanilla", {}):
                index[key]["overrides"] = True
            done += 1
        with open(os.path.join(dst, game, "index.json"), "w") as out:
            json.dump(index, out, indent=0)
        print(f"{game:9s}: {done} rooms converties")
    with open(os.path.join(dst, "report.json"), "w") as out:
        json.dump(report, out, indent=1, ensure_ascii=False)
    print(f"{len(report)} signalée(s) -> {dst}/report.json")


if __name__ == "__main__":
    main()