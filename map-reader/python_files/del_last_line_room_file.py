import os
import time

# Define the base path
path = os.path.dirname(os.path.abspath(__file__))

# Specify the target directory relative to the script
file = "downpour\world"  # Use forward slash for compatibility
file_path = os.path.join(path, file)

# Walk through the directories and files
for root, dirs, files in os.walk(file_path):
    for file in files:
        file_full_path = os.path.join(root, file)

        try:
            with open(file_full_path, 'r') as f:
                lines = f.readlines()
            # Specify the line to delete 
            updated_lines = []
            
            for i, line in enumerate(lines):
                if 0 <= i <= 3:
                    updated_lines.append(line)
            updated_lines.append('')
            updated_lines.append(lines[-1])
                
        except:
            print(f"Failed to delete 11th line from {file_full_path}")

        try:
            # Write back the updated lines to the file
            with open(file_full_path, 'w') as f:
                f.writelines(updated_lines)
        except:
            print(f"Failed to delete 11th line from {file_full_path}")