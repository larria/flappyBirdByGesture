const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'START'; // START, COUNTDOWN, PLAYING, GAMEOVER
let frames = 0;
let score = 0;
let highScore = localStorage.getItem('flappyHighScore') || 0;
let countdownValue = 3;
let lastTime = 0;

// DOM Elements
const scoreDisplay = document.getElementById('score-display');
const finalScoreSpan = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game Settings
const GRAVITY = 0.12; // Reduced from 0.25 for easier difficulty
const JUMP_STRENGTH = -4.5;
const PIPE_SPEED = 2;
const PIPE_SPAWN_RATE = 200; // Frames
const INITIAL_PIPE_GAP = 220; // Easier start
const MIN_PIPE_GAP = 150; // Hardest difficulty (original value)

// Bird Entity
const bird = {
    x: 50,
    y: 150,
    w: 30,
    h: 30,
    radius: 12,
    velocity: 0,

    draw: function () {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eye
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2 + 6, this.y + this.h / 2 - 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2 + 8, this.y + this.h / 2 - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
    },

    update: function () {
        if (window.isHovering) {
            this.velocity = 0; // Suspend gravity
        } else {
            this.velocity += GRAVITY;
        }
        this.y += this.velocity;

        // Floor collision
        if (this.y + this.h >= canvas.height) {
            this.y = canvas.height - this.h;
            gameOver();
        }

        // Ceiling collision
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
    },

    flap: function () {
        this.velocity = JUMP_STRENGTH;
    },

    reset: function () {
        this.y = 150;
        this.velocity = 0;
    }
};

// Pipes
const pipes = {
    items: [],

    draw: function () {
        ctx.fillStyle = '#2E8B57'; // SeaGreen
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        for (let pipe of this.items) {
            // Top pipe
            ctx.fillRect(pipe.x, 0, pipe.w, pipe.top);
            ctx.strokeRect(pipe.x, 0, pipe.w, pipe.top);

            // Bottom pipe
            ctx.fillRect(pipe.x, canvas.height - pipe.bottom, pipe.w, pipe.bottom);
            ctx.strokeRect(pipe.x, canvas.height - pipe.bottom, pipe.w, pipe.bottom);
        }
    },

    update: function () {
        // Add new pipe
        if (frames % PIPE_SPAWN_RATE === 0) {
            // Calculate dynamic gap based on score
            // Decrease gap by 5 for every 2 points, until MIN_PIPE_GAP
            let currentGap = Math.max(MIN_PIPE_GAP, INITIAL_PIPE_GAP - (Math.floor(score / 2) * 5));

            const topHeight = Math.random() * (canvas.height - currentGap - 100) + 50;
            this.items.push({
                x: canvas.width,
                w: 50,
                top: topHeight,
                bottom: canvas.height - (topHeight + currentGap),
                passed: false
            });
        }

        // Move pipes
        for (let i = 0; i < this.items.length; i++) {
            let pipe = this.items[i];
            pipe.x -= PIPE_SPEED;

            // Collision Detection
            // X axis overlap
            if (bird.x + bird.w > pipe.x && bird.x < pipe.x + pipe.w) {
                // Y axis overlap (hitting top or bottom pipe)
                if (bird.y < pipe.top || bird.y + bird.h > canvas.height - pipe.bottom) {
                    gameOver();
                }
            }

            // Score update
            if (pipe.x + pipe.w < bird.x && !pipe.passed) {
                score++;
                scoreDisplay.innerText = score;
                pipe.passed = true;
            }

            // Remove off-screen pipes
            if (pipe.x + pipe.w < 0) {
                this.items.shift();
                i--;
            }
        }
    },

    reset: function () {
        this.items = [];
    }
};

// Game Loop
function loop(timestamp) {
    // Clear canvas
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        bird.update();
        pipes.update();
        frames++;
    } else if (gameState === 'COUNTDOWN') {
        // Handle Countdown
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;

        if (deltaTime >= 1000) {
            countdownValue--;
            lastTime = timestamp;
            if (countdownValue <= 0) {
                gameState = 'PLAYING';
            }
        }

        // Draw Countdown
        ctx.fillStyle = 'white';
        ctx.font = '80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        const text = countdownValue > 0 ? countdownValue : "GO!";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    }

    pipes.draw();
    bird.draw();

    // Ground
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    requestAnimationFrame(loop);
}

// Controls
function triggerFlap() {
    if (gameState === 'PLAYING') {
        bird.flap();
    } else if (gameState === 'START' || gameState === 'GAMEOVER') {
        startGame();
    }
}

function startGame() {
    if (gameState === 'COUNTDOWN' || gameState === 'PLAYING') return;

    gameState = 'COUNTDOWN';
    countdownValue = 3;
    lastTime = 0; // Reset timer

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    bird.reset();
    pipes.reset();
    score = 0;
    frames = 0;
    scoreDisplay.innerText = score;
}

function gameOver() {
    gameState = 'GAMEOVER';
    finalScoreSpan.innerText = score;
    gameOverScreen.classList.add('active');
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Keyboard fallback for testing
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        triggerFlap();
    }
});

// Start loop
requestAnimationFrame(loop);

// Expose trigger for hand tracking
window.triggerFlap = triggerFlap;
window.startGame = startGame;
