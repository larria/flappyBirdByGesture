const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. 游戏配置 & 基准数值 ---
// Game State
let gameState = 'START';
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

// --- 物理引擎设置 (关键修改点) ---
// 基准屏幕高度 (原本的设计高度)
const BASE_HEIGHT = 640;

// 基准物理数值
const BASE_GRAVITY = 0.12; 
const BASE_JUMP = -4.5;
const BASE_PIPE_GAP = 220;
const BASE_MIN_GAP = 150;

// 实际运行时使用的物理数值 (会随屏幕高度变化)
let currentGravity = BASE_GRAVITY;
let currentJumpStrength = BASE_JUMP;
let currentInitialGap = BASE_PIPE_GAP;
let currentMinGap = BASE_MIN_GAP;

const PIPE_SPEED = 2; // 水平速度暂时保持不变，避免手机上太快反应不过来
const PIPE_SPAWN_RATE = 200;

// --- Bird Entity ---
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
            this.velocity = 0;
        } else {
            // [修改] 使用动态重力
            this.velocity += currentGravity;
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
        // [修改] 使用动态跳跃力度
        this.velocity = currentJumpStrength;
    },

    reset: function () {
        this.y = canvas.height / 2 - 50;
        this.velocity = 0;
    }
};

// --- Pipes ---
const pipes = {
    items: [],

    draw: function () {
        ctx.fillStyle = '#2E8B57';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        for (let pipe of this.items) {
            ctx.fillRect(pipe.x, 0, pipe.w, pipe.top);
            ctx.strokeRect(pipe.x, 0, pipe.w, pipe.top);

            ctx.fillRect(pipe.x, canvas.height - pipe.bottom, pipe.w, pipe.bottom);
            ctx.strokeRect(pipe.x, canvas.height - pipe.bottom, pipe.w, pipe.bottom);
        }
    },

    update: function () {
        if (frames % PIPE_SPAWN_RATE === 0) {
            // [修改] Gap 也需要根据屏幕高度动态调整，否则在高屏幕上缝隙会显得太小
            // 难度计算：每得2分减少5px的缝隙 (这里也按比例缩放减少量)
            const scoreBasedReduction = (Math.floor(score / 2) * 5) * (canvas.height / BASE_HEIGHT);
            
            let currentGap = Math.max(currentMinGap, currentInitialGap - scoreBasedReduction);

            const topHeight = Math.random() * (canvas.height - currentGap - 100) + 50;
            this.items.push({
                x: canvas.width,
                w: 50,
                top: topHeight,
                bottom: canvas.height - (topHeight + currentGap),
                passed: false
            });
        }

        for (let i = 0; i < this.items.length; i++) {
            let pipe = this.items[i];
            pipe.x -= PIPE_SPEED;

            if (bird.x + bird.w > pipe.x && bird.x < pipe.x + pipe.w) {
                if (bird.y < pipe.top || bird.y + bird.h > canvas.height - pipe.bottom) {
                    gameOver();
                }
            }

            if (pipe.x + pipe.w < bird.x && !pipe.passed) {
                score++;
                scoreDisplay.innerText = score;
                pipe.passed = true;
            }

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

// --- 2. 响应式与物理计算 ---
function resizeCanvas() {
    if (window.innerWidth <= 768) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = 480;
        canvas.height = 640;
    }

    // [关键逻辑] 计算高度缩放比例
    // 如果屏幕高度是 1280 (640的2倍)，那么 scaleRatio 就是 2
    let scaleRatio = canvas.height / BASE_HEIGHT;
    
    // 限制最小比例，防止在极扁的屏幕上游戏无法进行
    scaleRatio = Math.max(0.8, scaleRatio); 

    // 根据比例更新物理参数
    // 重力和跳跃力线性放大，保证在屏幕上的移动“视觉速度”一致
    currentGravity = BASE_GRAVITY * scaleRatio;
    currentJumpStrength = BASE_JUMP * scaleRatio;
    
    // 管子间隙也需要放大，否则高屏幕上管子间距太难钻
    currentInitialGap = BASE_PIPE_GAP * scaleRatio;
    currentMinGap = BASE_MIN_GAP * scaleRatio;

    // 如果游戏还没开始，重置位置确保鸟在视野内
    if (gameState === 'START') {
        bird.reset();
    }
}

// 初始化
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


// --- 3. 游戏主循环 ---
function loop(timestamp) {
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        bird.update();
        pipes.update();
        frames++;
    } else if (gameState === 'COUNTDOWN') {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;

        if (deltaTime >= 1000) {
            countdownValue--;
            lastTime = timestamp;
            if (countdownValue <= 0) {
                gameState = 'PLAYING';
            }
        }

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
    lastTime = 0;

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

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        triggerFlap();
    }
});

requestAnimationFrame(loop);

window.triggerFlap = triggerFlap;
window.startGame = startGame;