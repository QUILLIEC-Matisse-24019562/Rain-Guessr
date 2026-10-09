#!/usr/bin/env python3
"""
convert_rooms.py : extrait la géométrie des rooms Rain World depuis les fichiers
bruts du jeu (vanilla, Downpour, Watcher).

Usage :
    python convert_rooms.py <dossier_worlds> <dossier_sortie> [--fixes fixes.json]
    (sans --fixes, un fichier 'fixes.json' dans le dossier courant est utilisé s'il existe)
    python convert_rooms.py <dossier_worlds> <dossier_sortie> --show vanilla/su_b04

    <dossier_worlds> contient les dossiers 'world', 'world downpour', 'world Watcher'.

Sortie :
    <sortie>/<jeu>/<REGION>.json   géométrie de toutes les rooms de la région
    <sortie>/<jeu>/index.json      room -> région (+ 'overrides' si elle remplace une room vanilla)
    <sortie>/report.txt            LISIBLE : chaque room douteuse, avec coordonnées et extrait
    <sortie>/report.json           même chose, pour un programme

Corriger une room : on n'édite jamais les JSON de région (ils sont régénérés).
On écrit la correction dans fixes.json, puis on relance le script :

    {
      "vanilla/su_b04": {
        "tiles": {"29,19": 0, "31,19": 0},      # x,y -> terrain (0 air,1 solide,2 pente,3 sol,4 raccourci)
        "reviewed": "pentes flottantes, on laisse"   # (facultatif) marque l'avertissement comme vérifié
      }
    }
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
def problem(kind, message, cells=None):
    return {"type": kind, "message": message, "cells": cells or []}


def read_room(path, override=None):
    """Retourne (room, problèmes). room = None si la room est inutilisable.
    override : {(x, y): terrain} issu de fixes.json."""
    override = override or {}
    problems = []
    with open(path, errors="replace") as f:
        raw = f.read().replace("\r", "").split("\n")
    lines = [l for l in raw if l.strip()]
    if len(lines) < 5:
        return None, [problem("fichier_incomplet", "moins de 5 lignes")]
    name = lines[0].strip()
    try:
        w, h = (int(v) for v in lines[1].split("|")[0].split("*"))
    except ValueError:
        return None, [problem("ignoree", "IGNOREE : pas une room (settings, world_xx...)")]
    header = (w, h)
    # Fichier brut du jeu : tuiles à la ligne 12 (lignes 6 à 9 vides). Version réduite : dernière ligne.
    tile_line = raw[11] if len(raw) >= 12 else lines[-1]
    toks = tile_line.split("|")
    if toks and toks[-1] == "":
        toks = toks[:-1]

    n, expected = len(toks), w * h
    if n <= 1:
        return None, [problem("ignoree", "IGNOREE : pas de géométrie (stub)")]
    if n > expected:
        problems.append(problem("tuiles_en_trop",
            f"{n - expected} tuile(s) en trop à la fin du fichier ({n} tuiles pour {w}x{h}={expected}) : ignorées"))
    elif n < expected:
        msg = f"{n} tuiles dans le fichier pour {w}x{h}={expected} attendues ({expected - n} manquantes)"
        guess = []
        if n % h == 0:
            guess.append((n // h, h))
        if n % w == 0:
            guess.append((w, n // w))
        if not guess:
            return None, [problem("tuiles_manquantes", msg + " ; taille impossible à déduire")]
        w, h = guess[0]
        msg += f" ; taille déduite {w}x{h}"
        if len(guess) > 1:
            msg += f" (AMBIGU : l'autre option est {guess[1][0]}x{guess[1][1]})"
        problems.append(problem("tuiles_manquantes", msg))
        expected = w * h
    toks = toks[:expected]

    tiles = [[None] * w for _ in range(h)]
    bad_cells = []
    for x in range(w):  # les données sont rangées colonne par colonne
        for y in range(h):
            tok = toks[x * h + y]
            try:
                t = decode_tile(tok)
            except ValueError:
                t = (AIR, False, False)
                if (x, y) not in override:
                    bad_cells.append({"x": x, "y": y, "token": tok})
            if (x, y) in override:
                t = (override[(x, y)], t[1], t[2])
            tiles[y][x] = t
    if bad_cells:
        problems.append(problem("tuile_illisible",
            f"{len(bad_cells)} tuile(s) illisible(s), remplacée(s) par de l'air", bad_cells))
    room = {"name": name, "w": w, "h": h, "tiles": tiles, "header": header,
            "n_tiles": n, "bad": {(c["x"], c["y"]) for c in bad_cells}}
    return room, problems


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
SYM = {AIR: ".", SOLID: "#", SLOPE: "/", FLOOR: "=", SHORTCUT: "S"}


def snippet(room, x, y, r=4):
    """Petit extrait ASCII autour d'une case ('@' = la case, '?' = tuile illisible)."""
    out = []
    for yy in range(y - r, y + r + 1):
        row = ""
        for xx in range(x - r, x + r + 1):
            if not (0 <= xx < room["w"] and 0 <= yy < room["h"]):
                row += " "
            elif (xx, yy) == (x, y):
                row += "@"
            elif (xx, yy) in room["bad"]:
                row += "?"
            else:
                row += SYM[room["tiles"][yy][xx][0]]
        out.append(row)
    return out


def show_room(room):
    """Affiche toute la room en ASCII avec une règle de coordonnées."""
    w = room["w"]
    print("     " + "".join(str((x // 10) % 10) if x % 10 == 0 else " " for x in range(w)))
    print("     " + "".join(str(x % 10) for x in range(w)))
    for y in range(room["h"]):
        print(f"{y:4d} " + "".join("?" if (x, y) in room["bad"] else SYM[room["tiles"][y][x][0]]
                                    for x in range(w)))
    print("légende : . air   # solide   / pente   = sol traversable   S raccourci   ? illisible")


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


def load_fixes(path):
    """fixes.json -> {'jeu/room': {'tiles': {(x,y): terrain}, 'reviewed': str}}"""
    if not path:
        return {}
    import re
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"(?m)\s+#.*$", "", text)  # commentaires '# ...' tolérés en fin de ligne
    out = {}
    for key, v in json.loads(text).items():
        tiles = {}
        for xy, t in v.get("tiles", {}).items():
            x, y = (int(n) for n in xy.split(","))
            tiles[(x, y)] = int(t)
        out[key.lower()] = {"tiles": tiles, "reviewed": v.get("reviewed")}
    return out


def format_report(entries, src):
    lines = []
    order = {"ECHEC": 0, "A VERIFIER": 1, "VERIFIE": 2}
    for key, e in sorted(entries.items(), key=lambda kv: (order[kv[1]["status"]], kv[0])):
        lines.append(f"[{e['status']}] {key}   (région {e['region']})")
        lines.append(f"    fichier : {e['source']}")
        lines.append(f"    en-tête : {e['header'][0]}x{e['header'][1]}   tuiles dans le fichier : {e['n_tiles']}"
                     f"   taille utilisée : {e['size'][0]}x{e['size'][1]}")
        if e.get("reviewed"):
            lines.append(f"    vérifié : {e['reviewed']}")
        fix_cells = []
        for p in e["problems"]:
            lines.append(f"    - {p['type']} : {p['message']}")
            for c in p["cells"][:6]:
                extra = f"  token {c['token']!r}" if c.get("token") else ""
                if "voisins_solides" in c:
                    extra += "  murs : " + ", ".join(f"{k}={'oui' if v else 'non'}"
                                                      for k, v in c["voisins_solides"].items())
                lines.append(f"        case x={c['x']}, y={c['y']}{extra}")
                for row in c.get("context", []):
                    lines.append("            " + row)
                fix_cells.append(f'"{c["x"]},{c["y"]}": 0')
            if len(p["cells"]) > 6:
                lines.append(f"        ... et {len(p['cells']) - 6} autre(s) (voir report.json)")
        if fix_cells:
            lines.append(f'    pour corriger (fixes.json) : "{key}": {{"tiles": {{{", ".join(fix_cells)}}}}}'
                         "   # 0 air, 1 solide, 2 pente, 3 sol, 4 raccourci")
        lines.append(f"    pour voir la room : python convert_rooms.py {src} <sortie> --show {key}")
        lines.append("")
    return "\n".join(lines)


def main():
    args = sys.argv[1:]
    opt = lambda name: args[args.index(name) + 1] if name in args else None
    src, dst = args[0], args[1]
    # --fixes <fichier>, sinon 'fixes.json' dans le dossier courant s'il existe
    fixes_path = opt("--fixes") or ("fixes.json" if os.path.exists("fixes.json") else None)
    fixes = load_fixes(fixes_path)
    if fixes_path:
        print(f"corrections : {fixes_path} ({len(fixes)} room(s))")
    show = opt("--show")
    trees = {}
    for entry in sorted(os.scandir(src), key=lambda e: e.name):
        if entry.is_dir():
            trees[game_name(entry.name)] = collect(entry.path)

    if show:
        game, key = show.lower().split("/")
        path, _ = trees[game][key]
        room, problems = read_room(path, {k: v for k, v in fixes.get(show.lower(), {}).get("tiles", {}).items()})
        print(f"{show}  {room['w']}x{room['h']}  ({path})")
        show_room(room)
        return

    report, counts = {}, {}
    for game, rooms in trees.items():
        index, done, bundles = {}, 0, {}
        for key, (path, region) in rooms.items():
            fx = fixes.get(f"{game}/{key}", {})
            room, problems = read_room(path, fx.get("tiles"))
            rel = os.path.relpath(path, src)
            if room is None:
                if problems[0]["type"] != "ignoree":
                    report[f"{game}/{key}"] = {"status": "ECHEC", "region": region.upper(), "source": rel,
                                               "header": [0, 0], "n_tiles": 0, "size": [0, 0],
                                               "problems": problems}
                continue
            data = extract(room)
            if data["broken_slopes"]:
                cells = []
                for x, y in data["broken_slopes"]:
                    solid = lambda dx, dy: terrain_at(room["tiles"], room["w"], room["h"], x + dx, y + dy) == SOLID
                    nb = {k: solid(dx, dy) for k, (dx, dy) in
                          {"gauche": (-1, 0), "droite": (1, 0), "haut": (0, -1), "bas": (0, 1)}.items()}
                    cells.append({"x": x, "y": y, "context": snippet(room, x, y),
                                  "token": None, "voisins_solides": nb})
                problems.append(problem("pente_sans_orientation",
                    f"{len(cells)} pente(s) que le jeu ne peut pas orienter (il faut un mur à gauche OU à droite, "
                    "ET un mur au-dessus OU en dessous) : rien n'est dessiné", cells))
            for p in problems:  # extrait pour les tuiles illisibles aussi
                for c in p["cells"]:
                    c.setdefault("context", snippet(room, c["x"], c["y"]))
            if not selfcheck(room, data):
                problems.append(problem("aire_incoherente", "l'aire des contours ne correspond pas à la grille"))
            if problems:
                report[f"{game}/{key}"] = {
                    "status": "VERIFIE" if fx.get("reviewed") else "A VERIFIER",
                    "region": region.upper(), "source": rel, "reviewed": fx.get("reviewed"),
                    "header": list(room["header"]), "n_tiles": room["n_tiles"],
                    "size": [room["w"], room["h"]], "problems": problems}
            reg = region.upper()
            bundles.setdefault(reg, {})[key] = data
            index[key] = {"region": reg}
            if game != "vanilla" and key in trees.get("vanilla", {}):
                index[key]["overrides"] = True
            done += 1
        os.makedirs(os.path.join(dst, game), exist_ok=True)
        for reg, content in bundles.items():
            with open(os.path.join(dst, game, reg + ".json"), "w") as out:
                json.dump(content, out, separators=(",", ":"))
        with open(os.path.join(dst, game, "index.json"), "w") as out:
            json.dump(index, out, indent=0)
        counts[game] = done
        print(f"{game:9s}: {done} rooms converties")

    summary = {"rooms": counts}
    for st in ("ECHEC", "A VERIFIER", "VERIFIE"):
        summary[st] = sum(1 for e in report.values() if e["status"] == st)
    with open(os.path.join(dst, "report.json"), "w") as out:
        json.dump({"summary": summary, "rooms": report}, out, indent=1, ensure_ascii=False)
    with open(os.path.join(dst, "report.txt"), "w", encoding="utf-8") as out:
        out.write(f"Résumé : {summary['ECHEC']} échec(s), {summary['A VERIFIER']} à vérifier, "
                  f"{summary['VERIFIE']} vérifiée(s)\n\n" + format_report(report, src))
    print(f"{summary['ECHEC']} échec(s), {summary['A VERIFIER']} à vérifier, "
          f"{summary['VERIFIE']} vérifiée(s) -> {dst}/report.txt")


if __name__ == "__main__":
    main()