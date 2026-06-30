![beitragsbild](https://github.com/Toadzi/connect-4-v2/blob/main/connect4-v2.png)

# Leroy's Connect 4

This project is an implementation in JavaScript of the algorithm [minimax with Alpha-Beta] and [negamax with Alpha-Beta] applied to the game "Connect Four". It features a robust AI that can challenge both novice and experienced players, providing a dynamic gaming experience. This project also incorporates a gesture recognition technology to allow players to control the game using physical gestures.

# Example
You can find it here https://web-app-server.de/leroys-connect-4-v2/

# How it works
The AI determines the optimal move using either the minimax or negamax algorithm, both of which are enhanced with Alpha-Beta pruning to improve efficiency. These algorithms simulate possible moves in the game up to a certain depth and evaluate the game board at each node using a heuristic analysis.

By integrating these algorithms, the AI efficiently analyzes potential moves and counters, making it a challenging opponent. The game can be controlled through a gesture recognition technology, allowing the players to interact with the game.

# Setup
The PHP backend now reads configuration from a project-root `.env` file.

Required variables:
- `CONNECT4_DB_HOST`
- `CONNECT4_DB_USER`
- `CONNECT4_DB_PASSWORD`
- `CONNECT4_DB_NAME`

An example file is included as `.env.example`.

# Start Guide
1. Create or edit `.env` in the project root.
2. Fill in your database credentials.
3. Start a local PHP server from the project folder:

```bash
php -S localhost:8000
```

4. Open:

```text
http://localhost:8000/index.html
```

Optionaler Smoke-Test:

```text
http://localhost:8000/smoke-test.php
```

If you use Apache or Nginx instead, make sure the document root points to this project folder and PHP is enabled for the `php/` endpoints.

# Highscore
The game now stores the player name together with completed matches.

- Enter your name in the menu before starting or restarting a game.
- Open `Highscore & Matches` to see the ranking and recent finished games.
- Click a player in the ranking to filter the match list.
- Click `Zuege ansehen` on a match to inspect the recorded moves and start a replay.

# Current Status
Active game implementation:
- `index.html`
- `game.js`
- `board.js`
- `ai_worker.js`
- `css/connectfour.css`
- `img/`
- `lib/`
- `php/`

The in-game AI variants `minimax`, `negamax`, and `mcts` are active.
There is no active OpenAI or external move-generation dependency anymore.
Unused template assets and legacy backups were removed to keep the project structure lean.

# Mobile
The active app is optimized for mobile use:
- responsive canvas sizing
- pointer/touch input on the board
- mobile-friendly menu widths and spacing
- safer layout for small screens
- Collapsible webcam and console panels
- Optional fullscreen mode for the game board (or "game field")

# Copyright
Licensed under the MIT license.
