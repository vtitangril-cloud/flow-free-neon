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
    modeTrialBtn: null
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
}

function initAudio() {
    // Lazy initialize on first interaction
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
        console.error("Audio Synthesis Error: ", e);
    }
}

function playClickSound() {
    playTone(880, "triangle", 0.08, 0.08);
}

function playBuzzSound() {
    playTone(110, "sawtooth", 0.25, 0.15);
}

function playConnectionSound() {
    playTone(523.25, "sine", 0.1, 0.1);
    setTimeout(() => {
        playTone(659.25, "sine", 0.15, 0.1);
    }, 80);
}

function playWinSound() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((note, i) => {
        setTimeout(() => {
            playTone(note, "sine", 0.3, 0.12);
        }, i * 120);
    });
}

function playWarningSound() {
    playTone(987.77, "sine", 0.15, 0.05);
}

// Event Listeners Setup
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

    // Canvas Draw interactions
    canvas.addEventListener("mousedown", handleStart);
    canvas.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);

    canvas.addEventListener("touchstart", handleStart, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

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
    
    // Choose random grid sizes and levels for time trial
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
    const sizes = [5, 6]; // 5x5 or 6x6 for quicker solving
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
    
    // SVG dashoffset logic for 60s countdown
    const circumference = 2 * Math.PI * 45; // ~282.7
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
    // Load first level of the selected size
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
        
        // Show completion state from localStorage
        const storageKey = `flow_free_completed_${gridSize}x${gridSize}_${lvl.id}`;
        if (localStorage.getItem(storageKey) === "true") {
            btn.classList.add("completed");
            btn.innerHTML = `${lvl.id} <span style="font-size: 0.7rem; margin-top: 2px;">✓</span>`;
        }

        btn.addEventListener("click", () => {
            playClickSound();
            loadLevel(gridSize, lvl.id);
        });
        elements.levelButtonsContainer.appendChild(btn);
    });
}

function highlightActiveLevelButton() {
    document.querySelectorAll(".lvl-btn").forEach(btn => {
        if (parseInt(btn.textContent) === currentLevelId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function resetLevel() {
    initGrid();
    drawBoard();
    updateStats();
}

function loadNextLevel() {
    const list = levelsData[`${gridSize}x${gridSize}`];
    const nextLvl = list.find(l => l.id === currentLevelId + 1);
    if (nextLvl) {
        currentLevelId = nextLvl.id;
        loadLevel(gridSize, currentLevelId);
    } else {
        // Go to next grid size if available
        const nextSize = gridSize + 1;
        const nextSizeList = levelsData[`${nextSize}x${nextSize}`];
        if (nextSizeList) {
            document.querySelectorAll(".size-btn").forEach(btn => {
                if (parseInt(btn.dataset.size) === nextSize) {
                    btn.click();
                }
            });
        } else {
            // Circle back to Level 1
            loadLevel(gridSize, 1);
        }
    }
}

// Layout sizing
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height, 480);
    canvas.width = size;
    canvas.height = size;
    cellSize = (size - padding * 2) / gridSize;
    drawBoard();
}

// Coords Translation
function getGridCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - padding;
    const y = clientY - rect.top - padding;
    
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    
    if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
        return { x: cellX, y: cellY };
    }
    return null;
}

// Interaction Handlers
function handleStart(e) {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pt = getGridCoords(clientX, clientY);
    if (!pt) return;

    const cell = grid[pt.y][pt.x];
    if (cell.color) {
        drawingColor = cell.color;
        // If clicking on an endpoint, reset current pipe
        if (cell.isEndpoint) {
            resetPipe(drawingColor);
            drawingPath = [pt];
            pipes[drawingColor] = [pt];
            updateGridWithPipe(drawingColor);
            playClickSound();
        } else {
            // Clicking along an existing pipe -> truncate from here
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
    e.preventDefault();
    if (!drawingColor) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pt = getGridCoords(clientX, clientY);
    if (!pt) return;

    const lastPt = drawingPath[drawingPath.length - 1];
    if (pt.x === lastPt.x && pt.y === lastPt.y) return; // Same cell

    // Must be orthogonal neighbor
    const dx = Math.abs(pt.x - lastPt.x);
    const dy = Math.abs(pt.y - lastPt.y);
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        
        // Truncate path if backtracking
        const existingIdx = drawingPath.findIndex(p => p.x === pt.x && p.y === pt.y);
        if (existingIdx !== -1) {
            // Backtracking: Slice back to that point
            drawingPath = drawingPath.slice(0, existingIdx + 1);
            pipes[drawingColor] = [...drawingPath];
            updateGridWithPipe(drawingColor);
            playClickSound();
            drawBoard();
            return;
        }

        const cell = grid[pt.y][pt.x];
        
        // Check if endpoint of another color
        if (cell.isEndpoint && cell.color !== drawingColor) return;

        // Check if endpoint of the same color
        if (cell.isEndpoint && cell.color === drawingColor) {
            // Complete connection!
            drawingPath.push(pt);
            pipes[drawingColor] = [...drawingPath];
            updateGridWithPipe(drawingColor);
            drawingColor = null; // stop drawing
            movesCount++;
            playConnectionSound();
            checkWinCondition();
            drawBoard();
            return;
        }

        // Check if intersecting another color's pipe
        if (cell.color && cell.color !== drawingColor && !cell.isEndpoint) {
            // Break the other pipe!
            const hitColor = cell.color;
            resetPipe(hitColor);
            playBuzzSound();
        }

        // Draw forward
        drawingPath.push(pt);
        pipes[drawingColor] = [...drawingPath];
        updateGridWithPipe(drawingColor);
        drawBoard();
    }
}

function handleEnd() {
    if (drawingColor) {
        // Released draw mid-way
        drawingColor = null;
        movesCount++;
        checkWinCondition();
        updateStats();
        drawBoard();
    }
}

function resetPipe(color) {
    // Remove pipe styling from grid
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x].color === color && !grid[y][x].isEndpoint) {
                grid[y][x] = { color: null, isEndpoint: false, pathId: null };
            }
        }
    }
    pipes[color] = [];
}

function updateGridWithPipe(color) {
    // Clear old pipe route
    resetPipe(color);
    // Draw new pipe route
    pipes[color].forEach(pt => {
        if (!grid[pt.y][pt.x].isEndpoint) {
            grid[pt.y][pt.x] = {
                color: color,
                isEndpoint: false,
                pathId: color
            };
        }
    });
}

// Game Stats
function updateStats() {
    if (gameMode === "classic") {
        elements.levelDisplay.textContent = `${gridSize}x${gridSize} #${currentLevelId}`;
    } else {
        elements.levelDisplay.textContent = `TRIAL MODE`;
    }
    
    // Count connection states
    completedFlows = 0;
    let totalFlows = currentLevel.pairs.length;
    currentLevel.pairs.forEach(pair => {
        const path = pipes[pair.color];
        if (path && path.length > 1) {
            const start = pair.pts[0];
            const end = pair.pts[1];
            // Valid if start is start-pt and end is end-pt
            const connectsStart = path[0].x === start.x && path[0].y === start.y;
            const connectsEnd = path[path.length - 1].x === end.x && path[path.length - 1].y === end.y;
            if (connectsStart && connectsEnd) {
                completedFlows++;
            }
        }
    });

    elements.flowsDisplay.textContent = `${completedFlows} / ${totalFlows}`;
    elements.movesDisplay.textContent = movesCount;

    // Check best moves in localStorage
    const storageKey = `flow_free_best_${gridSize}x${gridSize}_${currentLevelId}`;
    const storedBest = localStorage.getItem(storageKey);
    if (storedBest && gameMode === "classic") {
        elements.bestMovesDisplay.textContent = `best: ${storedBest}`;
    } else {
        elements.bestMovesDisplay.textContent = `best: -`;
    }

    // Pipe Coverage
    let filledCells = 0;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (grid[y][x].color !== null) {
                filledCells++;
            }
        }
    }
    percentCovered = Math.round((filledCells / (gridSize * gridSize)) * 100);
    elements.percentDisplay.textContent = `${percentCovered}%`;

    // Toggle next-level buttons if solved
    const solved = (completedFlows === totalFlows && percentCovered === 100);
    elements.nextBtn.disabled = !solved;
}

// Logic: Check Win Condition
function checkWinCondition() {
    updateStats();
    let totalFlows = currentLevel.pairs.length;
    if (completedFlows === totalFlows && percentCovered === 100) {
        // Solved successfully!
        if (gameMode === "classic") {
            // Save completion
            const storageLvlKey = `flow_free_completed_${gridSize}x${gridSize}_${currentLevelId}`;
            localStorage.setItem(storageLvlKey, "true");
            
            // Save best score
            const storageBestKey = `flow_free_best_${gridSize}x${gridSize}_${currentLevelId}`;
            const prevBest = localStorage.getItem(storageBestKey);
            if (!prevBest || movesCount < parseInt(prevBest)) {
                localStorage.setItem(storageBestKey, movesCount);
            }

            // Render stats into modal
            elements.sumMoves.textContent = movesCount;
            elements.sumTarget.textContent = totalFlows;
            elements.sumScore.textContent = (movesCount === totalFlows) ? "PERFECT!" : "COMPLETED";

            setTimeout(() => {
                elements.completeModal.classList.remove("hidden");
                playWinSound();
                renderLevelButtons();
            }, 300);
        } else {
            // Time Trial: Solve random levels to increase score
            trialBoardsSolved++;
            playWinSound();
            setTimeout(() => {
                chooseRandomTrialLevel();
            }, 300);
        }
    }
}

// Board Canvas Renderer
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= gridSize; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(padding + i * cellSize, padding);
        ctx.lineTo(padding + i * cellSize, canvas.height - padding);
        ctx.stroke();

        // Horizontal lines
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

            // Glow style
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

    // Reset shadow style for endpoints
    ctx.shadowBlur = 0;

    // Draw Endpoints
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const cell = grid[y][x];
            if (cell.isEndpoint) {
                const cx = padding + x * cellSize + cellSize / 2;
                const cy = padding + y * cellSize + cellSize / 2;
                const radius = cellSize * 0.28;

                // Glowing outer ring for endpoint dots
                ctx.shadowBlur = 10;
                ctx.shadowColor = cell.color;

                ctx.fillStyle = cell.color;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();

                // Inner core highlights
                ctx.shadowBlur = 0;
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                ctx.beginPath();
                ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
