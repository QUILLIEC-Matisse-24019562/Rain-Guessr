def transpose_grid(input_text):
    # Parser la grille
    lines = [l.strip() for l in input_text.strip().split('\n') if l.strip()]
    
    grid = []
    for line in lines:
        row = line.split('|')
        if row and row[-1] == '':  # supprimer la cellule vide si la ligne finit par |
            row = row[:-1]
        grid.append(row)
    
    rows = len(grid)
    cols = len(grid[0])
    
    # Transposer: pour chaque colonne x, lire grid[y][x] pour tout y
    output_lines = []
    for x in range(cols):
        col_values = [grid[y][x] for y in range(rows)]
        output_lines.append('|'.join(col_values))
    
    return '\n'.join(output_lines)


# Utilisation
with open('input.txt', 'r') as f:
    input_text = f.read()

result = transpose_grid(input_text)

with open('output.txt', 'w') as f:
    f.write(result)

print(f"Terminé.")