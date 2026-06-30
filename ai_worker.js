import config from './config.js';

class MctsNode {
    constructor(board, playerToMove, parent = null, move = null) {
        this.board = board;
        this.playerToMove = playerToMove;
        this.parent = parent;
        this.move = move;
        this.children = [];
        this.visits = 0;
        this.wins = 0;
        this.untriedMoves = [];

        for (let col = 0; col < board.cols; col++) {
            if (board.grid[0][col] === null) {
                this.untriedMoves.push(col);
            }
        }
    }

    isTerminal() {
        return Boolean(this.board.winning) || this.board.full || this.untriedMoves.length === 0;
    }
}

export default class AI {
    constructor(depth, algorithm, gameInstance) {
        this.depth = depth;
        this.algorithm = algorithm;
        this.game = gameInstance;
    }

    getMove(board) {
        const availableCols = this.getOrderedColumns(board);
        if (availableCols.length === 0) {
            return null;
        }

        let bestMove;
        switch (this.algorithm) {
            case 'negamax':
                bestMove = this.negamax(board, this.depth, 1, -Infinity, Infinity);
                this.log(`Negamax: Best move is column ${bestMove.col} with score ${bestMove.score}`);
                break;
            case 'mcts':
                bestMove = this.mcts(board, config.mctsIterations);
                this.log(`MCTS: Best move is column ${bestMove.col} with score ${bestMove.score}`);
                break;
            case 'minimax':
            default:
                bestMove = this.minimax(board, this.depth, true, -Infinity, Infinity);
                this.log(`Minimax: Best move is column ${bestMove.col} with score ${bestMove.score}`);
                break;
        }

        return bestMove?.col ?? availableCols[0];
    }

    minimax(board, depth, isMaximizingPlayer, alpha, beta) {
        const availableCols = this.getOrderedColumns(board);
        if (depth === 0 || this.isTerminalBoard(board, availableCols)) {
            return {
                score: this.evaluateBoard(board, depth),
                col: null
            };
        }

        let bestMove = {
            score: isMaximizingPlayer ? -Infinity : Infinity,
            col: availableCols[0]
        };

        for (const col of availableCols) {
            const nextBoard = this.simulateMove(board, col, isMaximizingPlayer ? 'ai' : 'player');
            const result = this.minimax(nextBoard, depth - 1, !isMaximizingPlayer, alpha, beta);

            if (isMaximizingPlayer) {
                if (result.score > bestMove.score) {
                    bestMove = { score: result.score, col };
                }
                alpha = Math.max(alpha, result.score);
            } else {
                if (result.score < bestMove.score) {
                    bestMove = { score: result.score, col };
                }
                beta = Math.min(beta, result.score);
            }

            if (beta <= alpha) {
                break;
            }
        }

        return bestMove;
    }

    negamax(board, depth, color, alpha, beta) {
        const availableCols = this.getOrderedColumns(board);
        if (depth === 0 || this.isTerminalBoard(board, availableCols)) {
            return {
                score: color * this.evaluateBoard(board, depth),
                col: null
            };
        }

        let bestMove = {
            score: -Infinity,
            col: availableCols[0]
        };

        for (const col of availableCols) {
            const nextBoard = this.simulateMove(board, col, color === 1 ? 'ai' : 'player');
            const result = this.negamax(nextBoard, depth - 1, -color, -beta, -alpha);
            const score = -result.score;

            if (score > bestMove.score) {
                bestMove = { score, col };
            }

            alpha = Math.max(alpha, score);
            if (alpha >= beta) {
                break;
            }
        }

        return bestMove;
    }

    mcts(board, iterations) {
        const root = new MctsNode(this.cloneBoard(board), 'ai');
        if (root.untriedMoves.length === 0) {
            return { col: null, score: 0 };
        }

        for (let i = 0; i < iterations; i++) {
            let node = root;

            while (node.untriedMoves.length === 0 && node.children.length > 0 && !node.isTerminal()) {
                node = this.bestUctChild(node);
            }

            if (node.untriedMoves.length > 0 && !node.board.winning && !node.board.full) {
                const move = node.untriedMoves.pop();
                const nextBoard = this.simulateMove(node.board, move, node.playerToMove);
                const child = new MctsNode(nextBoard, this.getOpponent(node.playerToMove), node, move);
                node.children.push(child);
                node = child;
            }

            const result = this.rollout(node.board, node.playerToMove);
            while (node) {
                node.visits += 1;
                node.wins += result;
                node = node.parent;
            }
        }

        const bestChild = root.children.reduce((best, child) => {
            if (!best) {
                return child;
            }
            if (child.visits > best.visits) {
                return child;
            }
            if (child.visits === best.visits && child.wins > best.wins) {
                return child;
            }
            return best;
        }, null);

        return {
            col: bestChild?.move ?? root.untriedMoves[0] ?? this.getOrderedColumns(board)[0],
            score: bestChild && bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 0
        };
    }

    bestUctChild(node, exploration = 1.41) {
        return node.children.reduce((best, child) => {
            const childScore = this.uctValue(child, exploration);
            if (!best || childScore > best.score) {
                return { child, score: childScore };
            }
            return best;
        }, null).child;
    }

    uctValue(node, exploration) {
        if (node.visits === 0) {
            return Infinity;
        }

        const exploitation = node.wins / node.visits;
        const explorationTerm = exploration * Math.sqrt(Math.log(Math.max(node.parent.visits, 1)) / node.visits);
        return exploitation + explorationTerm;
    }

    rollout(board, currentPlayer) {
        let rolloutBoard = this.cloneBoard(board);
        let player = currentPlayer;
        let depth = 0;

        while (!rolloutBoard.winning && !rolloutBoard.full && depth < 20) {
            const moves = this.getOrderedColumns(rolloutBoard);
            if (moves.length === 0) {
                break;
            }

            const move = moves[Math.floor(Math.random() * moves.length)];
            rolloutBoard = this.simulateMove(rolloutBoard, move, player);
            player = this.getOpponent(player);
            depth++;
        }

        if (rolloutBoard.winning === 'ai') {
            return 1;
        }
        if (rolloutBoard.winning === 'player') {
            return -1;
        }
        return 0;
    }

    isTerminalBoard(board, availableCols = this.getOrderedColumns(board)) {
        return Boolean(board.winning) || board.full || availableCols.length === 0;
    }

    getOrderedColumns(board) {
        const center = (board.cols - 1) / 2;
        const columns = [];

        for (let col = 0; col < board.cols; col++) {
            if (board.grid[0][col] === null) {
                columns.push(col);
            }
        }

        return columns.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    }

    cloneBoard(board) {
        return {
            rows: board.rows,
            cols: board.cols,
            connect: board.connect,
            grid: board.grid.map(row => [...row]),
            winning: board.winning ?? null,
            full: board.full ?? false
        };
    }

    simulateMove(board, col, player) {
        const nextBoard = this.cloneBoard(board);
        if (col === null || col < 0 || col >= nextBoard.cols || nextBoard.grid[0][col] !== null) {
            return nextBoard;
        }

        for (let row = nextBoard.rows - 1; row >= 0; row--) {
            if (nextBoard.grid[row][col] === null) {
                nextBoard.grid[row][col] = player;
                if (this.checkWin(nextBoard, row, col, player)) {
                    nextBoard.winning = player;
                }
                nextBoard.full = this.isBoardFull(nextBoard);
                return nextBoard;
            }
        }

        return nextBoard;
    }

    isBoardFull(board) {
        return board.grid[0].every(cell => cell !== null);
    }

    checkWin(board, row, col, player) {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            let count = 1;
            count += this.countDirection(board, row, col, dr, dc, player);
            count += this.countDirection(board, row, col, -dr, -dc, player);
            if (count >= board.connect) {
                return true;
            }
        }

        return false;
    }

    countDirection(board, row, col, dr, dc, player) {
        let count = 0;
        for (let step = 1; step < board.connect; step++) {
            const nextRow = row + dr * step;
            const nextCol = col + dc * step;
            if (
                nextRow < 0 ||
                nextRow >= board.rows ||
                nextCol < 0 ||
                nextCol >= board.cols ||
                board.grid[nextRow][nextCol] !== player
            ) {
                break;
            }
            count++;
        }
        return count;
    }

    evaluateBoard(board, depth = 0) {
        if (board.winning === 'ai') {
            return 100000 + depth;
        }
        if (board.winning === 'player') {
            return -100000 - depth;
        }
        if (board.full) {
            return 0;
        }

        let score = 0;
        const centerColumn = Math.floor(board.cols / 2);
        for (let row = 0; row < board.rows; row++) {
            if (board.grid[row][centerColumn] === 'ai') {
                score += 6;
            } else if (board.grid[row][centerColumn] === 'player') {
                score -= 6;
            }
        }

        score += this.evaluateAllWindows(board, 'ai', 'player');
        score -= this.evaluateAllWindows(board, 'player', 'ai');
        return score;
    }

    evaluateAllWindows(board, player, opponent) {
        let score = 0;
        const connect = board.connect;

        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col <= board.cols - connect; col++) {
                const window = [];
                for (let offset = 0; offset < connect; offset++) {
                    window.push(board.grid[row][col + offset]);
                }
                score += this.evaluateWindow(window, connect, player, opponent);
            }
        }

        for (let col = 0; col < board.cols; col++) {
            for (let row = 0; row <= board.rows - connect; row++) {
                const window = [];
                for (let offset = 0; offset < connect; offset++) {
                    window.push(board.grid[row + offset][col]);
                }
                score += this.evaluateWindow(window, connect, player, opponent);
            }
        }

        for (let row = 0; row <= board.rows - connect; row++) {
            for (let col = 0; col <= board.cols - connect; col++) {
                const downRight = [];
                const downLeft = [];
                for (let offset = 0; offset < connect; offset++) {
                    downRight.push(board.grid[row + offset][col + offset]);
                    downLeft.push(board.grid[row + offset][col + connect - 1 - offset]);
                }
                score += this.evaluateWindow(downRight, connect, player, opponent);
                score += this.evaluateWindow(downLeft, connect, player, opponent);
            }
        }

        return score;
    }

    evaluateWindow(window, connect, player, opponent) {
        const playerCount = window.filter(cell => cell === player).length;
        const opponentCount = window.filter(cell => cell === opponent).length;
        const emptyCount = window.filter(cell => cell === null).length;

        if (playerCount > 0 && opponentCount > 0) {
            return 0;
        }

        if (playerCount === connect) {
            return 1000;
        }
        if (playerCount === connect - 1 && emptyCount === 1) {
            return 120;
        }
        if (playerCount === connect - 2 && emptyCount === 2) {
            return 18;
        }
        if (opponentCount === connect - 1 && emptyCount === 1) {
            return -140;
        }
        if (opponentCount === connect - 2 && emptyCount === 2) {
            return -16;
        }
        return 0;
    }

    getOpponent(player) {
        return player === 'ai' ? 'player' : 'ai';
    }

    log(message) {
        this.game?.appendToConsole?.(message);
    }
}
