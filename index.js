import { levelsData } from "./levels.js";

// Game State
let gridSize = 5;
let currentLevelId = 1;
let currentLevel = null;
let gameMode = "classic"; // "classic" or "trial"
let isSoundEnabled = true;

// Grid State & Paths
let grid = []; // 2D array: { color, isEndpoint, pathId }
let pipes = {}; // color -> array of {x, y}
let drawingColor = null;
let drawingPath = [];
let movesCount = 0;
let completedFlows = 0;
let percentCovered = 0;

// Canvas details
let canvas, ctx;
let cellSize = 0;
let padding = 15;

// Sound Synthesizer (Web Audio API)
let audioCtx = null;

// Timer details (Time Trial)
let trialTimeLimit = 60;
let trialTimeRemaining = 60;
let trialTimerInterval = null;
let trialBoardsSolved = 0;

// DOM elements
const elements = {
    canvas: null,
    levelDisplay: null,
    flowsDisplay: null,
    movesDisplay: null,
    bestMovesDisplay: null,
    percentDisplay: null,
    levelButtonsContainer: null,
    soundBtn: null,
    soundOnIcon: null,
    soundOffIcon: null,
    restartBtn: null,
    nextBtn: null,
    helpBtn: null,
    helpModal: null,
    closeHelpBtn: null,
    completeModal: null,
    modalNextBtn: null,
    sumMoves: null,
    sumTarget: null,
    sumScore: null,
    trialTimerOverlay: null,
    timerProgress: null,
    timerText: null,
    trialResultsModal: null,
    trialBoardsSolvedDisplay: null,
    trialRetryBtn: null,
    trialExitBtn: null,
    modeClassicBtn: null,
    modeTrialBtn: null,
    debugOverlay: null // New diagnostic overlay
};

window.addEventListener("DOMContentLoaded", () => {
    initDOMElements();
    setupEventListeners();
    initAudio();
    changeSize(5); // Start with 5x5 Level 1
});

function initDOMElements() {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");
    elements.canvas = canvas;
    elements.levelDisplay = document.getElementById("level-display");
    elements.flowsDisplay = document.getElementById("flows-display");
    elements.movesDisplay = document.getElementById("moves-display");
    elements.bestMovesDisplay = document.getElementById("best-moves-display");
    elements.percentDisplay = document.getElementById("percent-display");
    elements.levelButtonsContainer = document.getElementById("level-buttons-container");
    elements.soundBtn = document.getElementById("sound-btn");
    elements.soundOnIcon = document.getElementById("sound-on-icon");
    elements.soundOffIcon = document.getElementById("sound-off-icon");
    elements.restartBtn = document.getElementById("restart-btn");
    elements.nextBtn = document.getElementById("next-btn");
    elements.helpBtn = document.getElementById("help-btn");
    elements.helpModal = document.getElementById("help-modal");
    elements.closeHelpBtn = document.getElementById("close-help-btn");
    elements.completeModal = document.getElementById("complete-modal");
    elements.modalNextBtn = document.getElementById("modal-next-btn");
    elements.sumMoves = document.getElementById("sum-moves");
    elements.sumTarget = document.getElementById("sum-target");
    elements.sumScore = document.getElementById("sum-score");
    elements.trialTimerOverlay = document.getElementById("trial-timer-overlay");
    elements.timerProgress = document.getElementById("timer-progress");
    elements.timerText = document.getElementById("timer-text");
    elements.trialResultsModal = document.getElementById("trial-results-modal");
    elements.trialBoardsSolvedDisplay = document.getElementById("trial-boards-solved");
    elements.trialRetryBtn = document.getElementById("trial-retry-btn");
    elements.trialExitBtn = document.getElementById("trial-exit-btn");
    elements.modeClassicBtn = document.getElementById("mode-classic-btn");
    elements.modeTrialBtn = document.getElementById("mode-trial-btn");

    // Dynamic creation of Diagnostics overlay if it doesn't exist
    let dbg = document.getElementById("game-diagnostics");
    if (!dbg) {
        dbg = document.createElement("div");
        dbg.id = "game-diagnostics";
        dbg.style.position = "absolute";
        dbg.style.bottom = "10px";
        dbg.style.left = "0";
        dbg.style.width = "100%";
        dbg.style.textAlign = "center";
        dbg.style.fontSize = "0.7rem";
        dbg.style.color = "rgba(0,229,255,0.7)";
        dbg.style.fontFamily = "monospace";
        dbg.style.pointerEvents = "none";
        dbg.innerText = "Diag: ready";
        canvas.parentElement.appendChild(dbg);
    }
    elements.debugOverlay = dbg;
}

function initAudio() {
    const initCtx = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    };
    document.addEventListener("mousedown", initCtx, { once: true });
    document.addEventListener("touchstart", initCtx, { once: true });
}

// Sound Synthesizer Functions
function playTone(freq, type, duration, volume) {
    if (!isSoundEnabled || !audioCtx) return;
    try {
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.error(e);
    }
}
function playClickSound() { playTone(300, "sine", 0.08, 0.1); }
function playConnectionSound() { playTone(600, "triangle", 0.2, 0.15); }
function playBuzzSound() { playTone(120, "sawtooth", 0.15, 0.1); }
function playWarningSound() { playTone(440, "sine", 0.1, 0.08); }
function playWinSound() {
    playTone(523.25, "sine", 0.1, 0.1); // C5
    setTimeout(() => playTone(659.25, "sine", 0.1, 0.1), 100); // E5
    setTimeout(() => playTone(783.99, "sine", 0.1, 0.1), 200); // G5
    setTimeout(() => playTone(1046.50, "sine", 0.25, 0.15), 300); // C6
}

function setupEventListeners() {
    elements.soundBtn.addEventListener("click", () => {
        isSoundEnabled = !isSoundEnabled;
        elements.soundOnIcon.classList.toggle("hidden", !isSoundEnabled);
        elements.soundOffIcon.classList.toggle("hidden", isSoundEnabled);
        playClickSound();
    });

    elements.restartBtn.addEventListener("click", () => {
        playClickSound();
        resetLevel();
    });

    elements.nextBtn.addEventListener("click", () => {
        playClickSound();
        loadNextLevel();
    });

    elements.helpBtn.addEventListener("click", () => {
        playClickSound();
        elements.helpModal.classList.remove("hidden");
    });

    elements.closeHelpBtn.addEventListener("click", () => {
        playClickSound();
        elements.helpModal.classList.add("hidden");
    });

    elements.modalNextBtn.addEventListener("click", () => {
        playClickSound();
        elements.completeModal.classList.add("hidden");
        loadNextLevel();
    });

    elements.modeClassicBtn.addEventListener("click", () => {
        if (gameMode !== "classic") {
            playClickSound();
            setGameMode("classic");
        }
    });

    elements.modeTrialBtn.addEventListener("click", () => {
        if (gameMode !== "trial") {
            playClickSound();
            setGameMode("trial");
        }
    });

    elements.trialRetryBtn.addEventListener("click", () => {
        playClickSound();
        elements.trialResultsModal.classList.add("hidden");
        startTrialMode();
    });

    elements.trialExitBtn.addEventListener("click", () => {
        playClickSound();
        elements.trialResultsModal.classList.add("hidden");
        setGameMode("classic");
    });

    // Level size buttons
    document.querySelectorAll(".size-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            playClickSound();
            document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            changeSize(parseInt(e.target.dataset.size));
        });
    });

    // Use Pointer Events for unified touch and mouse support
    canvas.addEventListener("pointerdown", handleStart, { passive: false });
    canvas.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleEnd);

    // Prevent touch scrolling and zooming inside the canvas
    canvas.addEventListener("touchstart", (e) => {
        if (e.cancelable) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener("resize", resizeCanvas);
}

// State Operations
function setGameMode(mode) {
    gameMode = mode;
    elements.modeClassicBtn.classList.toggle("active", mode === "classic");
    elements.modeTrialBtn.classList.toggle("active", mode === "trial");

    if (mode === "classic") {
        elements.trialTimerOverlay.classList.add("hidden");
        clearInterval(trialTimerInterval);
        document.querySelector(".control-panel").classList.remove("hidden");
        changeSize(gridSize);
    } else {
        startTrialMode();
    }
}

function startTrialMode() {
    elements.trialTimerOverlay.classList.remove("hidden");
    document.querySelector(".control-panel").classList.add("hidden");
    trialBoardsSolved = 0;
    trialTimeRemaining = trialTimeLimit;
    
    chooseRandomTrialLevel();
    updateTimerUI();

    clearInterval(trialTimerInterval);
    trialTimerInterval = setInterval(() => {
        trialTimeRemaining--;
        updateTimerUI();

        if (trialTimeRemaining <= 10 && trialTimeRemaining > 0) {
            playWarningSound();
        }

        if (trialTimeRemaining <= 0) {
            clearInterval(trialTimerInterval);
            finishTrialMode();
        }
    }, 1000);
}

function chooseRandomTrialLevel() {
    const sizes = [5, 6];
    const chosenSize = sizes[Math.floor(Math.random() * sizes.length)];
    const list = levelsData[`${chosenSize}x${chosenSize}`];
    const chosenLvl = list[Math.floor(Math.random() * list.length)];
    
    gridSize = chosenSize;
    currentLevel = chosenLvl;
    initGrid();
    resizeCanvas();
}

function updateTimerUI() {
    elements.timerText.textContent = trialTimeRemaining;
    const progress = elements.timerProgress;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (trialTimeRemaining / trialTimeLimit) * circumference;
    progress.style.strokeDashoffset = offset;

    if (trialTimeRemaining <= 10) {
        progress.classList.add("warning");
    } else {
        progress.classList.remove("warning");
    }
}

function finishTrialMode() {
    elements.trialBoardsSolvedDisplay.textContent = trialBoardsSolved;
    elements.trialResultsModal.classList.remove("hidden");
    playWinSound();
}

function changeSize(size) {
    gridSize = size;
    currentLevelId = 1;
    loadLevel(gridSize, currentLevelId);
    renderLevelButtons();
}

function loadLevel(size, lvlId) {
    const list = levelsData[`${size}x${size}`];
    currentLevel = list.find(l => l.id === lvlId) || list[0];
    currentLevelId = currentLevel.id;
    initGrid();
    resizeCanvas();
    updateStats();
    highlightActiveLevelButton();
}

function initGrid() {
    grid = Array(gridSize).fill().map(() => Array(gridSize).fill().map(() => ({
        color: null,
        isEndpoint: false,
        pathId: null
    })));

    pipes = {};
    drawingColor = null;
    drawingPath = [];
    movesCount = 0;
    completedFlows = 0;
    percentCovered = 0;

    currentLevel.pairs.forEach(pair => {
        const { color, pts } = pair;
        pipes[color] = [];
        pts.forEach(pt => {
            grid[pt.y][pt.x] = {
                color: color,
                isEndpoint: true,
                pathId: color
            };
        });
    });
}

function renderLevelButtons() {
    elements.levelButtonsContainer.innerHTML = "";
    const list = levelsData[`${gridSize}x${gridSize}`] || [];
    list.forEach(lvl => {
        const btn = document.createElement("button");
        btn.className = "lvl-btn";
        btn.textContent = lvl.id;
        if (lvl.id === currentLevelId) btn.classList.add("active");
        btn.addEventListener("click", () => {
            playClickSound();
            loadLevel(gridSize, lvl.id);
        });
        elements.levelButtonsContainer.appendChild(btn);
    });
}

function highlightActiveLevelButton() {
    document.querySelectorAll(".lvl-btn").forEach(btn => {
        const isCurrent = parseInt(btn.textContent) === currentLevelId;
        btn.classList.toggle("active", isCurrent);
    });
}

function loadNextLevel() {
    const list = levelsData[`${gridSize}x${gridSize}`];
    const nextLvl = list.find(l => l.id === currentLevelId + 1);
    if (nextLvl) {
        currentLevelId = nextLvl.id;
        loadLevel(gridSize, currentLevelId);
    } else {
        const nextSize = gridSize + 1;
        const nextSizeList = levelsData[`${nextSize}x${nextSize}`];
        if (nextSizeList) {
            document.querySelectorAll(".size-btn").forEach(btn => {
                if (parseInt(btn.dataset.size) === nextSize) {
                    btn.click();
                }
            });
        } else {
            loadLevel(gridSize, 1);
        }
    }
}

// Layout sizing
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    let size = rect.width;
    if (!size || size < 50) {
        size = Math.min(window.innerWidth * 0.9, 480);
    }
    canvas.width = size;
    canvas.height = size;
    cellSize = (size - padding * 2) / gridSize;
    drawBoard();
}

// Coordinate Translation logic (unifying device DPI and wrapper offset)
function getGridCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    
    // Scale client coords to fit canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX - padding;
    const y = (clientY - rect.top) * scaleY - padding;
    
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    
    if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
        return { x: cellX, y: cellY };
    }
    return null;
}

// Interaction Handlers
function handleStart(e) {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const pt = getGridCoords(clientX, clientY);

    // Update diagnostic logs
    if (elements.debugOverlay) {
        elements.debugOverlay.innerText = `Start: screen(${Math.round(clientX)},${Math.round(clientY)}) -> cell(${pt ? pt.x : 'x'},${pt ? pt.y : 'x'})`;
    }

    if (!pt) return;

    const cell = grid[pt.y][pt.x];
    if (cell.color) {
        if (e.cancelable) e.preventDefault();
        drawingColor = cell.color;
        
        if (cell.isEndpoint) {
            resetPipe(drawingColor);
            drawingPath = [pt];
            pipes[drawingColor] = [pt];
            updateGridWithPipe(drawingColor);
            playClickSound();
        } else {
            const idx = pipes[drawingColor].findIndex(p => p.x === pt.x && p.y === pt.y);
            if (idx !== -1) {
                pipes[drawingColor] = pipes[drawingColor].slice(0, idx + 1);
                drawingPath = [...pipes[drawingColor]];
                updateGridWithPipe(drawingColor);
                playClickSound();
            }
        }
        drawBoard();
    }
}

function handleMove(e) {
    if (!drawingColor) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.clientX;
    const clientY = e.clientY;
    const pt = getGridCoords(clientX, clientY);

    if (elements.debugOverlay) {
        elements.debugOverlay.innerText = `Move: screen(${Math.round(clientX)},${Math.round(clientY)}) -> cell(${pt ? pt.x : 'x'},${pt ? pt.y : 'x'}) color=${drawingColor}`;
    }

    if (!pt) return;

    const lastPt = drawingPath[drawingPath.length - 1];
    if (pt.x === lastPt.x && pt.y === lastPt.y) return; // Same cell

    // Orthogonal movement check
    const dx = Math.abs(pt.x - lastPt.x);
    const dy = Math.abs(pt.y - lastPt.y);
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        
        // Truncating current path on backtrack
        const existingIdx = drawingPath.findIndex(p => p.x === pt.x && p.y === pt.y);
        if (existingIdx !== -1) {
            drawingPath = drawingPath.slice(0, existingIdx + 1);
            pipes[drawingColor] = [...drawingPath];
            updateGridWithPipe(drawingColor);
            playClickSound();
            drawBoard();
            return;
        }

        const cell = grid[pt.y][pt.x];
        
        if (cell.isEndpoint && cell.color !== drawingColor) return;

        if (cell.isEndpoint && cell.color === drawingColor) {
            drawingPath.push(pt);
            pipes[drawingColor] = [...drawingPath];
            updateGridWithPipe(drawingColor);
            drawingColor = null; // Complete
            movesCount++;
            playConnectionSound();
            checkWinCondition();
            drawBoard();
            return;
        }

        if (cell.color && cell.color !== drawingColor && !cell.isEndpoint) {
            const hitColor = cell.color;
            resetPipe(hitColor);
            playBuzzSound();
        }

        drawingPath.push(pt);
        pipes[drawingColor] = [...drawingPath];
        updateGridWithPipe(drawingColor);
        drawBoard();
    }
}

function handleEnd() {
    if (drawingColor) {
        drawingColor = null;
        movesCount++;
        checkWinCondition();
        updateStats();
        drawBoard();
    }
    if (elements.debugOverlay) {
        elements.debugOverlay.innerText = `End: ready`;
    }
}

function resetPipe(color) {
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x].pathId === color && !grid[y][x].isEndpoint) {
                grid[y][x].color = null;
                grid[y][x].pathId = null;
            }
        }
    }
    pipes[color] = [];
}

function updateGridWithPipe(color) {
    // Clear old non-endpoint styles for this pipe
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x].pathId === color && !grid[y][x].isEndpoint) {
                grid[y][x].color = null;
                grid[y][x].pathId = null;
            }
        }
    }
    // Repopulate using current path coordinates
    const path = pipes[color] || [];
    path.forEach(pt => {
        if (!grid[pt.y][pt.x].isEndpoint) {
            grid[pt.y][pt.x].color = color;
            grid[pt.y][pt.x].pathId = color;
        }
    });
}

function resetLevel() {
    initGrid();
    drawBoard();
    updateStats();
}

function updateStats() {
    completedFlows = 0;
    let cellsFilled = 0;

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x].color) {
                cellsFilled++;
            }
        }
    }

    const flowCount = currentLevel.pairs.length;
    currentLevel.pairs.forEach(pair => {
        const path = pipes[pair.color] || [];
        if (path.length > 1) {
            const first = path[0];
            const last = path[path.length - 1];
            const ep1 = grid[first.y][first.x];
            const ep2 = grid[last.y][last.x];
            if (ep1.isEndpoint && ep2.isEndpoint && first !== last) {
                completedFlows++;
            }
        }
    });

    percentCovered = Math.round((cellsFilled / (gridSize * gridSize)) * 100);

    elements.flowsDisplay.textContent = `${completedFlows} / ${flowCount}`;
    elements.movesDisplay.textContent = movesCount;
    elements.percentDisplay.textContent = `${percentCovered}%`;

    const nextDisabled = (completedFlows !== flowCount || percentCovered < 100);
    elements.nextBtn.disabled = nextDisabled;
}

function checkWinCondition() {
    updateStats();
    const flowCount = currentLevel.pairs.length;
    if (completedFlows === flowCount && percentCovered >= 100) {
        if (gameMode === "classic") {
            playWinSound();
            showWinModal();
        } else {
            // Time Trial Solved Board
            trialBoardsSolved++;
            playConnectionSound();
            chooseRandomTrialLevel();
        }
    }
}

function showWinModal() {
    const target = currentLevel.pairs.length;
    elements.sumMoves.textContent = movesCount;
    elements.sumTarget.textContent = target;
    elements.sumScore.textContent = (movesCount === target) ? "PERFECT" : "SOLVED";
    elements.completeModal.classList.remove("hidden");
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(padding + i * cellSize, padding);
        ctx.lineTo(padding + i * cellSize, canvas.height - padding);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(padding, padding + i * cellSize);
        ctx.lineTo(canvas.width - padding, padding + i * cellSize);
        ctx.stroke();
    }

    // Draw Connected Pipes
    Object.keys(pipes).forEach(color => {
        const path = pipes[color];
        if (path.length > 1) {
            ctx.strokeStyle = color;
            ctx.lineWidth = cellSize * 0.35;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.shadowBlur = 15;
            ctx.shadowColor = color;

            ctx.beginPath();
            ctx.moveTo(
                padding + path[0].x * cellSize + cellSize / 2,
                padding + path[0].y * cellSize + cellSize / 2
            );

            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(
                    padding + path[i].x * cellSize + cellSize / 2,
                    padding + path[i].y * cellSize + cellSize / 2
                );
            }
            ctx.stroke();
        }
    });

    ctx.shadowBlur = 0;

    // Draw Endpoints
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const cell = grid[y][x];
            if (cell.isEndpoint) {
                const cx = padding + x * cellSize + cellSize / 2;
                const cy = padding + y * cellSize + cellSize / 2;
                const radius = cellSize * 0.28;

                ctx.shadowBlur = 10;
                ctx.shadowColor = cell.color;

                ctx.fillStyle = cell.color;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                ctx.beginPath();
                ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
