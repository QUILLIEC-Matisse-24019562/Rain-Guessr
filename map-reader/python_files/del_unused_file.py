import os

path = os.path.dirname(os.path.abspath(__file__))

file = "downpour\world"
file_path = os.path.join(path, file)

print(file_path)

for root, dirs, files in os.walk(file_path):
    print(root)
    print(dirs)
    print(files)
    for file in files:
        if "settings" in file and file.endswith(".txt") or file.endswith(".png"):
            print("Deleting", os.path.join(root, file))
            os.remove(os.path.join(root, file))