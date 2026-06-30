import config from './config.js';
import Board from './board.js';
import AI from './ai_worker.js';

$(document).ready(function () {
    class Game {
        constructor() {
            this.canvas = $('#boardGame')[0];
            this.ctx = this.canvas.getContext('2d');
            this.boardPanel = $('#boardPanel');
            this.restartBtn = $('#restartGame');
            this.depthSelect = $('#depthSelect');
            this.algorithmSelect = $('#algorithmSelect');
            this.firstMoveSelect = $('#firstMoveSelect');
            this.playerNameInput = $('#playerNameInput');
            this.historyTable = $('#historyTable');
            this.gestureIndicator = $('#gestureIndicator');
            this.toggleGestureControlBtn = $('#toggleGestureControl');
            this.historyOpen = $('#historyOpenBtn');
            this.rankingOpen = $('#rankingOpenBtn');
            this.instructionsOpen = $('#instructionsOpenBtn');
            this.toggleFullscreenBoardBtn = $('#toggleFullscreenBoard');
            this.toggleWebcamPanelBtn = $('#toggleWebcamPanel');
            this.toggleConsolePanelBtn = $('#toggleConsolePanel');
            this.webcamPanelRow = $('#webcamPanelRow');
            this.consolePanelRow = $('#consolePanelRow');
            this.modalBox = document.getElementById('modalBox');
            this.offcanvasBottom = document.getElementById('offcanvasBottom');
            this.menuButtonContainer = $('.menu-button-container');
            this.defaultToastColorClass = 'text-bg-primary';

            this.lastClickTime = 0;
            this.gestureStartTime = 0;
            this.isGestureActive = false;
            this.isGestureControlEnabled = false;
            this.consoleOutputEnabled = true;
            this.isAiThinking = false;
            this.currentTurn = 'player';
            this.gameStarted = false;
            this.gameEnded = false;
            this.pendingAiMoveTimeout = null;
            this.gameId = null;
            this.backendSessionReady = false;
            this.board = null;
            this.ai = null;
            this.history = [];
            this.moveNumber = 0;
            this.activePlayerName = '';
            this.isWebcamPanelVisible = true;
            this.isConsolePanelVisible = true;
            this.hasAppliedMobilePanelDefaults = false;
            this.currentReplay = null;

            this.fingerMarker = {
                x: 0,
                y: 0,
                radius: 10
            };

            this.initGame();
            this.addEventListeners();
        }

        initGame() {
            console.log('Initializing game...');
            this.clearPendingAiMove();
            this.board = new Board(config.rows, config.cols, config.connect);
            this.ai = new AI(config.depth, config.algorithm, this);
            this.history = [];
            this.moveNumber = 0;
            this.gameStarted = false;
            this.gameEnded = false;
            this.activePlayerName = this.getPlayerName();
            this.currentTurn = 'player';
            this.gameId = null;
            this.backendSessionReady = false;
            this.lastClickTime = 0;
            this.gestureStartTime = 0;
            this.isGestureActive = false;
            this.setAiThinking(false);
            this.stopReplay(true);

            this.syncControls();
            this.updateCanvasSize();
            this.applyResponsivePanelVisibility();
            this.hidePlayError();
            this.gameStarted = true;
            this.currentTurn = this.firstMoveSelect.val() === 'AI' ? 'ai' : 'player';
            this.updateUI();
            this.updateHistoryTable();
            if (this.currentTurn === 'ai') {
                this.queueAiMove();
            }
            this.startNewGame();
        }

        syncControls() {
            this.depthSelect.val(String(config.depth));
            this.algorithmSelect.val(config.algorithm);
            this.playerNameInput.val(this.activePlayerName || this.loadStoredPlayerName());
            $('#toggleConsoleOutput').prop('checked', this.consoleOutputEnabled);
            $('#customRangeRow').val(config.rows);
            $('#customRangeCol').val(config.cols);
        }

        loadStoredPlayerName() {
            const storedName = window.localStorage.getItem('connect4PlayerName');
            return this.sanitizePlayerName(storedName || 'Spieler');
        }

        sanitizePlayerName(value) {
            const trimmed = String(value || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 80);

            return trimmed || 'Spieler';
        }

        getPlayerName() {
            const safeName = this.sanitizePlayerName(this.playerNameInput.val() || this.loadStoredPlayerName());
            this.playerNameInput.val(safeName);
            window.localStorage.setItem('connect4PlayerName', safeName);

            return safeName;
        }

        getWinnerLabel(winnerToken) {
            if (winnerToken === 'player') {
                return this.activePlayerName || this.getPlayerName();
            }
            if (winnerToken === 'ai') {
                return 'AI';
            }
            if (winnerToken === 'Draw') {
                return 'Unentschieden';
            }

            return winnerToken;
        }

        getWinnerToastMessage(winnerToken) {
            return winnerToken === 'Draw'
                ? 'Unentschieden!'
                : `${this.getWinnerLabel(winnerToken)} hat gewonnen!`;
        }

        initCameraAndHands() {
            const webcamContainer = $('#webcam');
            if (!webcamContainer.length) {
                console.error('Webcam container not found!');
                return;
            }

            this.videoElement = $('<video playsinline></video>').appendTo(webcamContainer)[0];
            const hands = new Hands({
                locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            hands.onResults(this.onHandResults.bind(this));
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    await hands.send({ image: this.videoElement });
                },
                width: 1280,
                height: 720
            });

            this.startCamera();
        }

        onHandResults(results) {
            this.lastHandResults = results;
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                const fingerTip = landmarks[8];
                this.updateMarkerPosition(
                    fingerTip.x * window.innerWidth,
                    fingerTip.y * window.innerHeight
                );
            } else {
                this.isGestureActive = false;
                this.gestureStartTime = 0;
                this.updateGestureIndicator(0, false);
            }
        }

        updateGestureIndicator(progress, isVisible) {
            if (!this.gestureIndicator?.length) {
                return;
            }

            const clampedProgress = Math.max(0, Math.min(progress, 1));
            this.gestureIndicator.toggleClass('gesture-indicator-active', isVisible);
            this.gestureIndicator.css('display', isVisible ? 'block' : 'none');
            this.gestureIndicator.css('width', `${clampedProgress * 100}%`);
        }

        isClickGestureDetected() {
            const now = Date.now();
            if (now - this.lastClickTime < config.clickLockoutPeriod) {
                this.updateGestureIndicator(0, false);
                return false;
            }
            if (!this.lastHandResults || !this.lastHandResults.multiHandLandmarks?.length) {
                this.updateGestureIndicator(0, false);
                return false;
            }

            const thumbTip = this.lastHandResults.multiHandLandmarks[0][4];
            const indexTip = this.lastHandResults.multiHandLandmarks[0][8];
            const dx = thumbTip.x - indexTip.x;
            const dy = thumbTip.y - indexTip.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < config.clickThreshold) {
                if (!this.isGestureActive) {
                    this.isGestureActive = true;
                    this.gestureStartTime = now;
                }
            } else if (distance > config.clickReleaseThreshold) {
                this.isGestureActive = false;
                this.gestureStartTime = 0;
            }

            const progress = this.isGestureActive
                ? Math.min((now - this.gestureStartTime) / config.clickDurationRequired, 1)
                : 0;
            this.updateGestureIndicator(progress, this.isGestureActive);

            if (this.isGestureActive && now - this.gestureStartTime > config.clickDurationRequired) {
                this.isGestureActive = false;
                this.lastClickTime = now;
                this.updateGestureIndicator(0, false);
                return true;
            }

            return false;
        }

        updateMarkerPosition(x, y) {
            const rect = this.canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }

            const canvasX = ((x - rect.left) / rect.width) * this.canvas.width;
            const canvasY = ((y - rect.top) / rect.height) * this.canvas.height;
            const correctedX = this.canvas.width - canvasX;

            this.fingerMarker.x = Math.min(Math.max(correctedX, 0), this.canvas.width);
            this.fingerMarker.y = Math.min(Math.max(canvasY, 0), this.canvas.height);
            this.drawFingerMarker();

            if (!this.canPlayerMove()) {
                return;
            }

            const col = Math.floor(this.fingerMarker.x / (this.canvas.width / this.board.cols));
            if (this.isClickGestureDetected()) {
                this.onPlayerMove(col);
            }
        }

        updateCanvasSize() {
            if (!this.canvas || !this.board) {
                return;
            }

            const container = this.boardPanel[0] || this.canvas.parentElement;
            const availableWidth = Math.floor(container?.clientWidth || this.canvas.width || 800);
            const maxBoardWidth = Math.min(availableWidth, 960);
            const cellSize = Math.max(24, Math.floor(maxBoardWidth / this.board.cols));
            const width = cellSize * this.board.cols;
            const height = cellSize * this.board.rows;

            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
            this.ctx = this.canvas.getContext('2d');
        }

        getColumnFromClientX(clientX) {
            const rect = this.canvas.getBoundingClientRect();
            if (!rect.width) {
                return -1;
            }

            const relativeX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
            const columnWidth = rect.width / this.board.cols;
            const col = Math.floor(relativeX / columnWidth);

            return Math.min(Math.max(col, 0), this.board.cols - 1);
        }

        isMobileViewport() {
            return window.matchMedia('(max-width: 768px)').matches;
        }

        setPanelVisibility(panelName, isVisible) {
            const isWebcam = panelName === 'webcam';
            const panelRow = isWebcam ? this.webcamPanelRow : this.consolePanelRow;
            const button = isWebcam ? this.toggleWebcamPanelBtn : this.toggleConsolePanelBtn;
            const visibleText = isWebcam ? 'Webcam ausblenden' : 'Konsole ausblenden';
            const hiddenText = isWebcam ? 'Webcam anzeigen' : 'Konsole anzeigen';

            if (isWebcam) {
                this.isWebcamPanelVisible = isVisible;
            } else {
                this.isConsolePanelVisible = isVisible;
            }

            panelRow.toggleClass('panel-hidden', !isVisible);
            button.text(isVisible ? visibleText : hiddenText);
        }

        applyResponsivePanelVisibility(forceDesktopVisible = false) {
            if (forceDesktopVisible || !this.isMobileViewport()) {
                this.setPanelVisibility('webcam', true);
                this.setPanelVisibility('console', true);
                this.hasAppliedMobilePanelDefaults = false;
                return;
            }

            if (!this.hasAppliedMobilePanelDefaults) {
                this.setPanelVisibility('webcam', false);
                this.setPanelVisibility('console', false);
                this.hasAppliedMobilePanelDefaults = true;
            }
        }

        async toggleBoardFullscreen() {
            const panelElement = this.boardPanel[0];
            if (!panelElement) {
                return;
            }

            if (document.fullscreenElement === panelElement) {
                await document.exitFullscreen();
                return;
            }

            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }

            await panelElement.requestFullscreen();
        }

        handleFullscreenChange() {
            const panelElement = this.boardPanel[0];
            const isFullscreen = document.fullscreenElement === panelElement;
            this.boardPanel.toggleClass('fullscreen-board', isFullscreen);
            this.toggleFullscreenBoardBtn.text(isFullscreen ? 'Vollbild beenden' : 'Vollbild');
            this.updateUI();
        }

        drawFingerMarker() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.board.draw(this.ctx);
            this.ctx.fillStyle = 'red';
            this.ctx.beginPath();
            this.ctx.arc(this.fingerMarker.x, this.fingerMarker.y, this.fingerMarker.radius, 0, 2 * Math.PI);
            this.ctx.fill();
        }

        showPlayError(message) {
            const errorDiv = document.getElementById('playError');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        hidePlayError() {
            document.getElementById('playError').style.display = 'none';
        }

        showToast(message, colorClass = this.defaultToastColorClass) {
            const toast = $('#liveToast');
            const toastBody = toast.find('.toast-body');

            toastBody.text(message);
            toast.removeClass(function (index, className) {
                return (className.match(/(^|\s)text-bg-\S+/g) || []).join(' ');
            });
            toast.addClass(colorClass);

            bootstrap.Toast.getOrCreateInstance(toast[0]).show();
        }

        hideToast() {
            const toast = $('#liveToast');
            const toastInstance = bootstrap.Toast.getInstance(toast[0]);
            if (toastInstance) {
                toastInstance.hide();
            }
        }

        setAiThinking(isThinking) {
            this.isAiThinking = isThinking;
            document.getElementById('lockoutIndicator').style.display = isThinking ? 'block' : 'none';
        }

        clearPendingAiMove() {
            if (this.pendingAiMoveTimeout) {
                clearTimeout(this.pendingAiMoveTimeout);
                this.pendingAiMoveTimeout = null;
            }
        }

        queueAiMove(delay = config.aiDelay) {
            this.clearPendingAiMove();
            this.setAiThinking(true);
            this.showToast('AI is thinking ...', 'text-bg-info');
            this.pendingAiMoveTimeout = setTimeout(() => {
                this.pendingAiMoveTimeout = null;
                this.aiMove();
            }, delay);
        }

        canPlayerMove() {
            return this.gameStarted &&
                !this.gameEnded &&
                !this.isAiThinking &&
                !this.board.winning &&
                !this.board.full &&
                this.currentTurn === 'player';
        }

        finishGame(winner) {
            if (this.gameEnded) {
                return;
            }

            this.gameEnded = true;
            this.currentTurn = null;
            this.clearPendingAiMove();
            this.setAiThinking(false);
            this.updateUI();
            this.endGame(winner);
        }

        startNewGame() {
            fetch('php/start_game.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    player_name: this.activePlayerName,
                    ai_name: 'AI',
                    rows: config.rows,
                    cols: config.cols,
                    algorithm: config.algorithm,
                    depth: config.depth
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status !== 'success') {
                        throw new Error(data.message || 'Spiel konnte nicht gestartet werden.');
                    }

                    this.gameId = data.game_id;
                    this.backendSessionReady = true;
                    this.updateHistoryTable();
                    this.syncHistoryToBackend();
                    if (this.gameEnded) {
                        this.endGame(this.board.winning || 'Draw');
                    }
                })
                .catch(error => {
                    console.error('Fehler beim Starten des Spiels:', error);
                    this.backendSessionReady = false;
                    this.appendToConsole(`Backend nicht erreichbar: ${error.message || 'Spiel läuft lokal ohne Speicherung.'}`);
                    this.showToast('Spiel läuft lokal ohne DB-Speicherung.', 'text-bg-secondary');
                });
        }

        updateUI() {
            this.updateCanvasSize();
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.board.draw(this.ctx);

            if (this.board.winning) {
                this.showToast(this.getWinnerToastMessage(this.board.winning), 'text-bg-warning');
            } else if (this.board.full) {
                this.showToast('Unentschieden!', 'text-bg-secondary');
            } else if (!this.isAiThinking) {
                this.hideToast();
            }
        }

        onPlayerMove(col) {
            this.hidePlayError();

            if (!this.gameStarted) {
                this.showPlayError('Das Spiel wird noch initialisiert.');
                return;
            }
            if (!this.canPlayerMove()) {
                if (this.isAiThinking) {
                    this.showPlayError('Die KI ist gerade am Zug.');
                }
                return;
            }
            if (!this.board.isColumnPlayable(col)) {
                this.showPlayError('Diese Spalte ist bereits voll oder ungültig.');
                return;
            }

            const row = this.board.placeToken(col, 'player');
            if (row === null) {
                this.showPlayError('Zug konnte nicht gesetzt werden.');
                return;
            }

            this.history.push({
                player: this.activePlayerName,
                col,
                row,
                moveNumber: this.moveNumber++
            });
            this.storeMove(this.activePlayerName, col, row);
            this.updateUI();
            this.updateHistoryTable();

            if (this.board.winning) {
                this.finishGame('player');
                return;
            }
            if (this.board.full) {
                this.finishGame('Draw');
                return;
            }

            this.currentTurn = 'ai';
            this.queueAiMove();
        }

        aiMove() {
            if (this.gameEnded || this.board.winning || this.board.full) {
                this.setAiThinking(false);
                return;
            }

            const availableCols = this.board.getAvailableColumns();
            if (availableCols.length === 0) {
                this.finishGame('Draw');
                return;
            }

            let col = this.ai.getMove(this.board);
            if (!this.board.isColumnPlayable(col)) {
                col = availableCols[0];
            }

            const row = this.board.placeToken(col, 'ai');
            if (row === null) {
                this.setAiThinking(false);
                this.showPlayError('Die KI konnte keinen gültigen Zug finden.');
                return;
            }

            this.history.push({
                player: 'AI',
                col,
                row,
                moveNumber: this.moveNumber++
            });
            this.storeMove('AI', col, row);
            this.updateUI();
            this.updateHistoryTable();

            if (this.board.winning || this.board.full) {
                this.finishGame(this.board.winning || 'Draw');
                return;
            }

            this.currentTurn = 'player';
            this.setAiThinking(false);
            this.hideToast();
        }

        addEventListeners() {
            $(this.canvas).on('pointerup', e => {
                if (e.pointerType === 'mouse' && e.button !== 0) {
                    return;
                }
                const col = this.getColumnFromClientX(e.clientX);
                this.onPlayerMove(col);
            });

            $(window).on('resize.connect4 orientationchange.connect4', () => {
                this.applyResponsivePanelVisibility();
                this.updateUI();
            });

            $(document).on('fullscreenchange.connect4', () => {
                this.handleFullscreenChange();
            });

            this.toggleGestureControlBtn.click(() => {
                this.toggleGestureControl();
            });

            this.toggleFullscreenBoardBtn.click(() => {
                this.toggleBoardFullscreen().catch(error => {
                    console.error('Fullscreen konnte nicht aktiviert werden:', error);
                });
            });

            this.toggleWebcamPanelBtn.click(() => {
                this.setPanelVisibility('webcam', !this.isWebcamPanelVisible);
            });

            this.toggleConsolePanelBtn.click(() => {
                this.setPanelVisibility('console', !this.isConsolePanelVisible);
            });

            this.restartBtn.click(() => {
                this.restartGame();
            });

            this.depthSelect.change(e => {
                config.depth = parseInt($(e.target).val(), 10);
                this.ai.depth = config.depth;
                this.showToast(`Depth changed to ${config.depth}`, 'text-bg-info');
            });

            this.algorithmSelect.change(e => {
                config.algorithm = $(e.target).val();
                this.ai.algorithm = config.algorithm;
                this.showToast(`Algorithm changed to ${config.algorithm}`, 'text-bg-info');
            });

            this.historyOpen.click(() => {
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modalHistory')).show();
            });

            this.rankingOpen.click(() => {
                this.openRankingsModal();
            });

            this.instructionsOpen.click(() => {
                this.updateModalContent({
                    title: 'Spiel Anleitung',
                    size: 'lg',
                    closeButton: true,
                    htmlContent: config.gameInstructions,
                    isScrollable: true
                });
            });

            $('#toggleConsoleOutput').on('change', event => {
                this.toggleConsoleOutput(event.target.checked);
            });

            $('#customRangeRow').on('change', e => {
                const newRows = parseInt($(e.target).val(), 10);
                this.updateBoardDimensions(newRows, null);
            });

            $('#customRangeCol').on('change', e => {
                const newCols = parseInt($(e.target).val(), 10);
                this.updateBoardDimensions(null, newCols);
            });

            $(document).on('click', '.js-ranking-player', event => {
                const playerName = $(event.currentTarget).data('playerName');
                this.openRankingsModal(playerName);
            });

            $(document).on('click', '.js-clear-ranking-filter', () => {
                this.openRankingsModal();
            });

            $(document).on('click', '.js-open-match-details', event => {
                const gameId = parseInt($(event.currentTarget).data('gameId'), 10);
                if (Number.isInteger(gameId) && gameId > 0) {
                    this.openMatchDetailsModal(gameId);
                }
            });

            $(document).on('click', '.js-start-replay', () => {
                this.startReplay();
            });

            $(document).on('click', '.js-reset-replay', () => {
                this.resetReplayBoard();
            });

            $(this.modalBox).on('hidden.bs.modal', () => {
                this.stopReplay(true);
            });

            $(this.offcanvasBottom).on('show.bs.offcanvas', () => {
                this.menuButtonContainer.addClass('menu-hidden');
            });

            $(this.offcanvasBottom).on('hidden.bs.offcanvas', () => {
                this.menuButtonContainer.removeClass('menu-hidden');
            });
        }

        updateHistoryTable() {
            let html = `<thead>
                <tr>
                    <th>Player</th>
                    <th>Column</th>
                    <th>Row</th>
                    <th>Move Number</th>
                </tr>
            </thead><tbody>`;

            this.history.forEach(move => {
                html += `<tr>
                    <td>${this.escapeHtml(move.player)}</td>
                    <td>${move.col}</td>
                    <td>${move.row !== null ? move.row + 1 : '-'}</td>
                    <td>${move.moveNumber + 1}</td>
                </tr>`;
            });

            html += '</tbody>';
            this.historyTable.html(html);
        }

        syncHistoryToBackend() {
            if (!this.gameId || !this.history.length) {
                return;
            }

            this.history.forEach(move => {
                this.storeMove(move.player, move.col, move.row, move.moveNumber + 1);
            });
        }

        storeMove(player, col, row, moveNumber = this.moveNumber) {
            if (!this.gameId) {
                return;
            }

            fetch('php/store_move.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: this.gameId,
                    player,
                    col,
                    row,
                    moveNumber
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status !== 'success') {
                        console.error('Error storing move:', data.message);
                    }
                })
                .catch(error => {
                    console.error('Error parsing JSON:', error);
                });
        }

        toggleGestureControl() {
            this.isGestureControlEnabled = !this.isGestureControlEnabled;
            if (this.isGestureControlEnabled) {
                this.enableGestureControl();
                this.toggleGestureControlBtn.text('Gestensteuerung deaktivieren');
            } else {
                this.disableGestureControl();
                this.toggleGestureControlBtn.text('Gestensteuerung aktivieren');
            }
        }

        disableGestureControl() {
            if (this.camera?.video?.srcObject) {
                const tracks = this.camera.video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                this.camera.video.srcObject = null;
            }
        }

        enableGestureControl() {
            if (!this.camera) {
                this.initCameraAndHands();
            } else {
                this.startCamera();
            }
        }

        startCamera() {
            if (this.camera) {
                this.camera.start();
            }
        }

        toggleConsoleOutput(enabled) {
            this.consoleOutputEnabled = enabled;
            console.log(`Konsolenausgabe ist jetzt ${this.consoleOutputEnabled ? 'aktiviert' : 'deaktiviert'}.`);
        }

        appendToConsole(message) {
            if (!this.consoleOutputEnabled) {
                return;
            }

            const consoleDiv = $('#consoleOutput');
            if (consoleDiv.length === 0) {
                return;
            }

            consoleDiv.append($('<div>').text(message));
            consoleDiv.scrollTop(consoleDiv.prop('scrollHeight'));
        }

        updateBoardDimensions(newRows, newCols) {
            if (newRows !== null) {
                config.rows = Math.max(config.minRows, Math.min(config.maxRows, newRows));
            }
            if (newCols !== null) {
                config.cols = Math.max(config.minCols, Math.min(config.maxCols, newCols));
            }

            this.restartGame();
        }

        restartGame() {
            this.initGame();
            this.updateUI();
            this.updateHistoryTable();
        }

        escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        formatDateTime(value) {
            if (!value) {
                return 'Unbekannt';
            }

            const normalizedValue = value.replace(' ', 'T');
            const date = new Date(normalizedValue);
            if (Number.isNaN(date.getTime())) {
                return value;
            }

            return new Intl.DateTimeFormat('de-CH', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date);
        }

        fetchJson(url) {
            return fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (data.status !== 'success') {
                        throw new Error(data.message || 'Daten konnten nicht geladen werden.');
                    }
                    return data;
                });
        }

        openRankingsModal(playerName = '') {
            this.stopReplay(true);
            const query = playerName ? `?player_name=${encodeURIComponent(playerName)}` : '';

            this.updateModalContent({
                title: 'Highscore & Matches',
                size: 'xl',
                htmlContent: '<div class="text-center py-4">Lade Highscore ...</div>',
                isScrollable: true
            });

            this.fetchJson(`php/get_rankings.php${query}`)
                .then(data => {
                    const activeFilter = data.filter?.player_name || '';
                    const rankingRows = data.rankings.length
                        ? data.rankings.map((entry, index) => `
                            <tr class="js-ranking-player${entry.player_name === activeFilter ? ' table-active' : ''}" data-player-name="${this.escapeHtml(entry.player_name)}">
                                <td>${index + 1}</td>
                                <td>${this.escapeHtml(entry.player_name)}</td>
                                <td>${entry.wins}</td>
                                <td>${entry.losses}</td>
                                <td>${entry.draws}</td>
                                <td>${entry.matches}</td>
                                <td>${entry.win_rate.toFixed(1)}%</td>
                                <td>${this.formatDateTime(entry.last_played)}</td>
                            </tr>
                        `).join('')
                        : '<tr><td colspan="8">Noch keine abgeschlossenen Spiele vorhanden.</td></tr>';

                    const matchRows = data.matches.length
                        ? data.matches.map(match => `
                            <tr>
                                <td>#${match.id}</td>
                                <td>${this.escapeHtml(match.player_name)}</td>
                                <td>${this.escapeHtml(match.result_label)}</td>
                                <td>${this.escapeHtml(match.algorithm || '-')}</td>
                                <td>${match.depth ?? '-'}</td>
                                <td>${match.move_count}</td>
                                <td>${match.rows} x ${match.cols}</td>
                                <td>${this.formatDateTime(match.completed_at || match.started_at)}</td>
                                <td class="text-end">
                                    <button type="button" class="btn btn-sm btn-outline-info js-open-match-details" data-game-id="${match.id}">Züge ansehen</button>
                                </td>
                            </tr>
                        `).join('')
                        : '<tr><td colspan="9">Für diesen Filter wurden keine Matches gefunden.</td></tr>';

                    const filterBadge = activeFilter
                        ? `<div class="ranking-filter-bar">Filter aktiv: <strong>${this.escapeHtml(activeFilter)}</strong> <button type="button" class="btn btn-sm btn-outline-light js-clear-ranking-filter">Alle anzeigen</button></div>`
                        : '<div class="ranking-filter-bar">Klick auf einen Spielernamen filtert die Matchliste.</div>';

                    this.updateModalContent({
                        title: 'Highscore & Matches',
                        size: 'xl',
                        htmlContent: `
                            <div class="ranking-layout">
                                ${filterBadge}
                                <section class="ranking-section">
                                    <h6>Rangliste</h6>
                                    <div class="table-responsive">
                                        <table class="table table-striped table-dark table-hover align-middle ranking-table">
                                            <thead>
                                                <tr>
                                                    <th>Rang</th>
                                                    <th>Spieler</th>
                                                    <th>Siege</th>
                                                    <th>Niederlagen</th>
                                                    <th>Unentschieden</th>
                                                    <th>Spiele</th>
                                                    <th>Siegquote</th>
                                                    <th>Zuletzt gespielt</th>
                                                </tr>
                                            </thead>
                                            <tbody>${rankingRows}</tbody>
                                        </table>
                                    </div>
                                </section>
                                <section class="ranking-section">
                                    <h6>Abgeschlossene Matches</h6>
                                    <div class="table-responsive">
                                        <table class="table table-striped table-dark align-middle">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Spieler</th>
                                                    <th>Ergebnis</th>
                                                    <th>Algorithmus</th>
                                                    <th>Tiefe</th>
                                                    <th>Züge</th>
                                                    <th>Brett</th>
                                                    <th>Gespielt</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>${matchRows}</tbody>
                                        </table>
                                    </div>
                                </section>
                            </div>
                        `,
                        isScrollable: true
                    });
                })
                .catch(error => {
                    this.updateModalContent({
                        title: 'Highscore & Matches',
                        size: 'lg',
                        htmlContent: `<div class="alert alert-danger mb-0">${this.escapeHtml(error.message)}</div>`,
                        isScrollable: true
                    });
                });
        }

        openMatchDetailsModal(gameId) {
            this.stopReplay(true);
            this.updateModalContent({
                title: `Match #${gameId}`,
                size: 'xl',
                htmlContent: '<div class="text-center py-4">Lade Match ...</div>',
                isScrollable: true
            });

            this.fetchJson(`php/get_game_details.php?game_id=${gameId}`)
                .then(data => {
                    this.currentReplay = {
                        moves: data.moves,
                        rows: data.game.rows,
                        cols: data.game.cols,
                        gameId: data.game.id,
                        timerId: null
                    };

                    const winnerLabel = data.game.winner === 'Draw'
                        ? 'Unentschieden'
                        : data.game.winner === 'player'
                            ? data.game.player_name
                            : data.game.winner === 'ai'
                                ? data.game.ai_name
                                : data.game.winner;

                    const moveRows = data.moves.length
                        ? data.moves.map(move => `
                            <tr>
                                <td>${move.move_number}</td>
                                <td>${this.escapeHtml(move.player)}</td>
                                <td>${move.col + 1}</td>
                                <td>${move.row + 1}</td>
                            </tr>
                        `).join('')
                        : '<tr><td colspan="4">Für dieses Match wurden noch keine Züge gespeichert.</td></tr>';

                    this.updateModalContent({
                        title: `Match #${data.game.id}`,
                        size: 'xl',
                        htmlContent: `
                            <div class="match-detail-grid">
                                <section class="match-summary-card">
                                    <div class="match-summary-row"><span>Spieler</span><strong>${this.escapeHtml(data.game.player_name)}</strong></div>
                                    <div class="match-summary-row"><span>KI</span><strong>${this.escapeHtml(data.game.ai_name || 'AI')}</strong></div>
                                    <div class="match-summary-row"><span>Gewinner</span><strong>${this.escapeHtml(winnerLabel || 'Unbekannt')}</strong></div>
                                    <div class="match-summary-row"><span>Algorithmus</span><strong>${this.escapeHtml(data.game.algorithm || '-')}</strong></div>
                                    <div class="match-summary-row"><span>Tiefe</span><strong>${data.game.depth ?? '-'}</strong></div>
                                    <div class="match-summary-row"><span>Brett</span><strong>${data.game.rows} x ${data.game.cols}</strong></div>
                                    <div class="match-summary-row"><span>Beendet</span><strong>${this.formatDateTime(data.game.completed_at || data.game.started_at)}</strong></div>
                                    <div class="replay-controls">
                                        <button type="button" class="btn btn-primary js-start-replay">Replay starten</button>
                                        <button type="button" class="btn btn-outline-light js-reset-replay">Replay zurücksetzen</button>
                                    </div>
                                </section>
                                <section class="match-replay-card">
                                    <div class="replay-canvas-wrap">
                                        <canvas id="replayCanvas" class="replay-canvas"></canvas>
                                    </div>
                                </section>
                            </div>
                            <section class="ranking-section mt-4">
                                <h6>Spielzüge</h6>
                                <div class="table-responsive">
                                    <table class="table table-striped table-dark align-middle">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Spieler</th>
                                                <th>Spalte</th>
                                                <th>Zeile</th>
                                            </tr>
                                        </thead>
                                        <tbody>${moveRows}</tbody>
                                    </table>
                                </div>
                            </section>
                        `,
                        isScrollable: true
                    });

                    requestAnimationFrame(() => {
                        this.resetReplayBoard();
                    });
                })
                .catch(error => {
                    this.updateModalContent({
                        title: `Match #${gameId}`,
                        size: 'lg',
                        htmlContent: `<div class="alert alert-danger mb-0">${this.escapeHtml(error.message)}</div>`,
                        isScrollable: true
                    });
                });
        }

        createReplayBoardContext() {
            if (!this.currentReplay) {
                return null;
            }

            const canvas = document.getElementById('replayCanvas');
            if (!canvas) {
                return null;
            }

            const maxWidth = Math.min(window.innerWidth - 120, 520);
            const cellSize = Math.max(32, Math.floor(maxWidth / this.currentReplay.cols));
            canvas.width = cellSize * this.currentReplay.cols;
            canvas.height = cellSize * this.currentReplay.rows;
            canvas.style.width = `${canvas.width}px`;
            canvas.style.height = `${canvas.height}px`;

            const ctx = canvas.getContext('2d');
            const board = new Board(this.currentReplay.rows, this.currentReplay.cols, config.connect);
            board.draw(ctx);

            return { canvas, ctx, board };
        }

        normalizeReplayPlayer(playerLabel) {
            return String(playerLabel).trim().toLowerCase() === 'ai' ? 'ai' : 'player';
        }

        resetReplayBoard() {
            this.stopReplay();
            const replayContext = this.createReplayBoardContext();
            if (!replayContext) {
                return;
            }

            this.currentReplay.board = replayContext.board;
            this.currentReplay.ctx = replayContext.ctx;
            this.currentReplay.canvas = replayContext.canvas;
        }

        startReplay() {
            if (!this.currentReplay?.moves?.length) {
                return;
            }

            this.resetReplayBoard();
            let moveIndex = 0;

            const playNextMove = () => {
                if (!this.currentReplay?.board || moveIndex >= this.currentReplay.moves.length) {
                    this.stopReplay();
                    return;
                }

                const move = this.currentReplay.moves[moveIndex];
                this.currentReplay.board.placeToken(move.col, this.normalizeReplayPlayer(move.player));
                this.currentReplay.ctx.clearRect(0, 0, this.currentReplay.canvas.width, this.currentReplay.canvas.height);
                this.currentReplay.board.draw(this.currentReplay.ctx);
                moveIndex += 1;

                if (moveIndex >= this.currentReplay.moves.length) {
                    this.stopReplay(false);
                }
            };

            playNextMove();
            this.currentReplay.timerId = window.setInterval(playNextMove, 650);
        }

        stopReplay(clearReference = false) {
            if (this.currentReplay?.timerId) {
                window.clearInterval(this.currentReplay.timerId);
                this.currentReplay.timerId = null;
            }

            if (clearReference) {
                this.currentReplay = null;
            }
        }

        fetchModalContent() {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve('<p>Dies ist dynamisch geladener Inhalt aus einer asynchronen Quelle.</p>');
                }, 1000);
            });
        }

        updateModalContent(options) {
            const {
                title,
                content = '',
                size = 'default',
                closeButton = true,
                asyncContent = null,
                htmlContent = null,
                isScrollable = true
            } = options;

            const modalElement = document.getElementById('modalBox');
            const modalTitle = modalElement?.querySelector('.modal-title');
            const modalBody = modalElement?.querySelector('.modal-body');
            const modalDialog = modalElement?.querySelector('.modal-dialog');
            const closeButtonElem = modalElement?.querySelector('.btn-close');

            if (!modalElement || !modalTitle || !modalBody || !modalDialog) {
                console.error('Modal elements konnten im DOM nicht gefunden werden.');
                return;
            }

            modalTitle.textContent = title;
            modalBody.innerHTML = content;

            const sizeClass = size !== 'default' ? ` modal-${size}` : '';
            const scrollableClass = isScrollable ? ' modal-dialog-scrollable' : '';
            modalDialog.className = `modal-dialog${sizeClass}${scrollableClass}`;

            if (closeButtonElem) {
                closeButtonElem.style.display = closeButton ? 'block' : 'none';
            }

            const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
            modal.show();

            if (asyncContent) {
                asyncContent()
                    .then(resolvedContent => {
                        modalBody.innerHTML = resolvedContent;
                        this.triggerContentUpdated();
                    })
                    .catch(error => {
                        modalBody.innerHTML = 'Fehler beim Laden des Inhalts';
                        console.error('Fehler beim Laden des Inhalts:', error);
                    });
            } else if (htmlContent) {
                modalBody.innerHTML = htmlContent;
                this.triggerContentUpdated();
            } else {
                modalBody.innerHTML = content;
                this.triggerContentUpdated();
            }
        }

        triggerContentUpdated() {
            const event = new CustomEvent('contentUpdated', {
                bubbles: true,
                cancelable: true
            });
            document.getElementById('modalBox')?.dispatchEvent(event);
        }

        endGame(winner) {
            const toastMessage = this.getWinnerToastMessage(winner);
            const toastClass = winner === 'Draw' ? 'text-bg-secondary' : 'text-bg-warning';

            if (!this.gameId) {
                return;
            }

            fetch('php/end_game.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: this.gameId,
                    winner
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status !== 'success') {
                        console.error('Error ending game:', data.message);
                    }
                    this.showToast(toastMessage, toastClass);
                })
                .catch(error => {
                    console.error('Error parsing JSON:', error);
                    this.showToast(toastMessage, toastClass);
                });
        }
    }

    new Game();
});
