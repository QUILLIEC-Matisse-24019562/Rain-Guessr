import os

def parse_grid(input_text):
    """Parser le texte en grille 2D"""
    lines = [l.strip() for l in input_text.strip().split('\n') if l.strip()]
    
    grid = []
    for line in lines:
        row = line.split('|')
        if row and row[-1] == '':
            row = row[:-1]
        grid.append(row)
    
    return grid

def grid_to_text(grid):
    """Convertir la grille en texte formaté"""
    return '\n'.join(['|'.join(row) for row in grid])

def transpose(grid):
    """Transposition: inversion lignes/colonnes"""
    rows = len(grid)
    cols = len(grid[0])
    result = []
    for x in range(cols):
        col_values = [grid[y][x] for y in range(rows)]
        result.append(col_values)
    return result

def rotate_90_cw(grid):
    """Rotation 90° clockwise"""
    rows = len(grid)
    cols = len(grid[0])
    result = []
    for x in range(cols):
        new_row = [grid[rows - 1 - y][x] for y in range(rows)]
        result.append(new_row)
    return result

def rotate_90_ccw(grid):
    """Rotation 90° counter-clockwise"""
    rows = len(grid)
    cols = len(grid[0])
    result = []
    for x in range(cols - 1, -1, -1):
        new_row = [grid[y][x] for y in range(rows)]
        result.append(new_row)
    return result

def rotate_180(grid):
    """Rotation 180°"""
    rows = len(grid)
    cols = len(grid[0])
    result = []
    for y in range(rows - 1, -1, -1):
        new_row = [grid[y][cols - 1 - x] for x in range(cols)]
        result.append(new_row)
    return result

def flip_horizontal(grid):
    """Symétrie horizontale"""
    result = []
    for row in grid:
        result.append(row[::-1])
    return result

def flip_vertical(grid):
    """Symétrie verticale"""
    return grid[::-1]

def anti_transpose(grid):
    """Anti-transposition (symétrie diagonale inverse)"""
    rows = len(grid)
    cols = len(grid[0])
    result = []
    for x in range(cols - 1, -1, -1):
        col_values = [grid[rows - 1 - y][x] for y in range(rows)]
        result.append(col_values)
    return result

# Utilisation
text = ("")

if text != "":
    input_text = text
else:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    room_file = os.path.join(script_dir, '..', 'room.txt')
    with open(room_file, 'r') as f:
        input_text = f.read()

grid = parse_grid(input_text)

# Appliquer la transformation: TRANSPOSE
transformed_grid = transpose(grid)
result_text = grid_to_text(transformed_grid)

# Sauvegarder le résultat
script_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(script_dir, 'output.txt')
with open(output_file, 'w') as f:
    f.write(result_text)

print(f"Original: {len(grid)} rows × {len(grid[0])} cols")
print(f"Transposé: {len(transformed_grid)} rows × {len(transformed_grid[0])} cols")
print(f"\nFichier sauvegardé: output.txt")
print(f"\nAperçu (100 premiers caractères):")
print(result_text[:100])