Geo Guesser for Rain World

This is a project to make a Geo Guesser style game for Rain World

It will work by taking a random part of a random screenshot of a room, and with it, you will need to find the room where it come from (the closer, the more point, more about this bellow)

The map will be show in one layer (not like in Rain World), but it will probably be an option to switch to the classic 3 layer map

Going on the site, you will have a menu very similar to the main menu of rain world, It have multiple button: Play, Account, Setting, Credit, Help
-The play button lead you to the selection page, it allow you to choose the game mode (more about it bellow), and the difficulty
-The account button will allow you to login/disconnect/create an account and see data linked to it
-The settings page allow you to make some change, like choosing the type of map (like said before, 1 or 3 layer)
-The credit is credit (yes I know very complicated)
-The help button will lead you to a page to send a message to an admin (by email)

The game modes:
-classic (like describe above)
-art-amator (similar to classic, but only with screenshot containing wall grafiti)

Game loop:
For classic, when you launch a game, you will be given a random part of a random screenshot, a chrono will start, you can place a point by right clicking, moving around with left click and zoom with mouse-wheel. When a point is placed, you can press enter to validate your selection. Then your points will be calculated by how far you was to the real place (their an amount of point for time taken, for good region, for good room, and distance in room).
When a game is finish, a small menu will pop, with two button, play again and main menu.

To launch the local server:

python -m http.server 8000

and go to : http://localhost:8000/  on your browser