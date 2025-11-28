const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. 游戏配置 & 基准数值 ---
// Game State
let gameState = 'START';
let frames = 0;
let score = 0;
let highScore = localStorage.getItem('flappyHighScore') || 0; // Keep for legacy or all-time if needed, but we focus on weekly
let weeklyHighScore = 0;
let lastScore = 0;
let countdownValue = 3;
let lastTime = 0;

// --- Audio Controller ---
const audio = {
    bgmHome: new Audio('./assets/audio/bgm-home.mp3'),
    bgmGame: new Audio('./assets/audio/bgm-gaming.mp3'),
    sfxReady: new Audio('./assets/audio/sfx-readygo.mp3'),
    sfxJump: new Audio('./assets/audio/sfx-jump.ogg'),
    sfxGlide: new Audio('./assets/audio/sfx-glid.ogg'),
    sfxNewRecordGame: new Audio('./assets/audio/sfx-gaming-newhigh-score.ogg'),
    sfxGameOver: new Audio('./assets/audio/sfx-gameover.ogg'),
    sfxNewRecordResult: new Audio('./assets/audio/sfx-result-newhigh-score.ogg'),

    muted: localStorage.getItem('flappyMuted') === 'true',

    init: function () {
        this.bgmHome.loop = true;
        this.bgmGame.loop = true;
        this.sfxGlide.loop = true;
        this.updateMuteState();

        // Try to play home BGM (might be blocked until interaction)
        this.playBGM('home');
    },

    updateMuteState: function () {
        const volume = this.muted ? 0 : 1;
        Object.values(this).forEach(val => {
            if (val instanceof Audio) val.volume = volume;
        });
        muteBtn.innerText = this.muted ? '🔇' : '🔊';
        localStorage.setItem('flappyMuted', this.muted);
    },

    toggleMute: function () {
        this.muted = !this.muted;
        this.updateMuteState();

        // Resume BGM if unmuted and state requires it
        if (!this.muted) {
            if (gameState === 'START') this.playBGM('home');
            else if (gameState === 'PLAYING') this.playBGM('game');
        }
    },

    playBGM: function (type) {
        // Stop all BGMs
        this.bgmHome.pause();
        this.bgmGame.pause();
        this.bgmHome.currentTime = 0;
        this.bgmGame.currentTime = 0;

        if (type === 'home') this.bgmHome.play().catch(e => console.log('Audio autoplay blocked'));
        if (type === 'game') this.bgmGame.play().catch(e => console.log('Audio autoplay blocked'));
    },

    playSFX: function (name) {
        if (this.muted) return;
        const sfx = this[name];
        if (sfx) {
            sfx.currentTime = 0;
            sfx.play().catch(e => { });
        }
    },

    startGlide: function () {
        if (this.muted) return;
        if (this.sfxGlide.paused) this.sfxGlide.play().catch(e => { });
    },

    stopGlide: function () {
        this.sfxGlide.pause();
        this.sfxGlide.currentTime = 0;
    }
};

// --- Helper: Get Week Number ---
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// --- Init Scores from LocalStorage ---
const currentWeek = getWeekNumber(new Date());
const storedWeek = localStorage.getItem('flappyWeekNum');
const storedWeeklyScore = localStorage.getItem('flappyWeeklyHighScore');
const storedLastScore = localStorage.getItem('flappyLastScore');

if (storedWeek && parseInt(storedWeek) === currentWeek) {
    weeklyHighScore = parseInt(storedWeeklyScore) || 0;
} else {
    // New week or no data, reset weekly score
    weeklyHighScore = 0;
    localStorage.setItem('flappyWeekNum', currentWeek);
    localStorage.setItem('flappyWeeklyHighScore', 0);
}

if (storedLastScore) {
    lastScore = parseInt(storedLastScore);
}

// DOM Elements
const scoreContainer = document.getElementById('score-container');
const scoreDisplay = document.getElementById('score-display');
const finalScoreSpan = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const newRecordMsg = document.getElementById('new-record-msg');
const muteBtn = document.getElementById('mute-btn');

// New UI Elements
const startWeeklyBest = document.getElementById('start-weekly-best');
const startLastScore = document.getElementById('start-last-score');
const endWeeklyBest = document.getElementById('end-weekly-best');
const hudWeeklyBest = document.getElementById('hud-weekly-best');
const weeklyBestDisplay = document.getElementById('weekly-best-display');

// --- 物理引擎设置 (关键修改点) ---
// 基准屏幕高度 (原本的设计高度)
const BASE_HEIGHT = 640;

// 基准物理数值
const BASE_GRAVITY = 0.12;
const BASE_JUMP = -4.5;
const BASE_PIPE_GAP = 220;
const BASE_MIN_GAP = 150;
const BASE_GLIDE_SPEED = 0.3;

// 实际运行时使用的物理数值 (会随屏幕高度变化)
let currentGravity = BASE_GRAVITY;
let currentJumpStrength = BASE_JUMP;
let currentInitialGap = BASE_PIPE_GAP;
let currentMinGap = BASE_MIN_GAP;
let currentGlideSpeed = BASE_GLIDE_SPEED;

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
            // [修改] 滑翔模式：设定为固定的向下速度，实现匀速缓慢下降
            this.velocity = currentGlideSpeed;
            audio.startGlide();
        } else {
            // [原有逻辑] 普通模式：使用动态重力加速下落
            this.velocity += currentGravity;
            audio.stopGlide();
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
        audio.playSFX('sfxJump');
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

                // Check for new record during game
                if (score > weeklyHighScore) {
                    scoreDisplay.classList.add('new-record-pulse');
                    weeklyBestDisplay.classList.add('new-record-highlight');
                    hudWeeklyBest.innerText = score;
                    // Play sound only once when record is first broken
                    if (score === weeklyHighScore + 1) {
                        audio.playSFX('sfxNewRecordGame');
                    }
                }

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
    // 重力、跳跃力、滑翔速度线性放大，保证在屏幕上的移动“视觉速度”一致
    currentGravity = BASE_GRAVITY * scaleRatio;
    currentJumpStrength = BASE_JUMP * scaleRatio;
    currentGlideSpeed = BASE_GLIDE_SPEED * scaleRatio;

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
audio.init();

// Update Initial UI
startWeeklyBest.innerText = weeklyHighScore;
startLastScore.innerText = lastScore;
hudWeeklyBest.innerText = weeklyHighScore;


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
            if (countdownValue > 0) {
                // Optional: beep for 3, 2, 1
            }
            if (countdownValue <= 0) {
                gameState = 'PLAYING';
                audio.playBGM('game');
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
    hudWeeklyBest.innerText = weeklyHighScore; // Reset HUD to current high score
    scoreDisplay.classList.remove('new-record-pulse'); // Reset effects
    weeklyBestDisplay.classList.remove('new-record-highlight');
    scoreContainer.classList.remove('hidden');

    audio.playBGM('none'); // Stop home music
    audio.playSFX('sfxReady');
}

function gameOver() {
    gameState = 'GAMEOVER';
    audio.stopGlide();
    audio.playBGM('none'); // Stop game music
    finalScoreSpan.innerText = score;
    gameOverScreen.classList.add('active');
    scoreContainer.classList.add('hidden');

    // Update Last Score
    lastScore = score;
    localStorage.setItem('flappyLastScore', lastScore);

    let isNewRecord = false;
    // Update Weekly High Score
    if (score > weeklyHighScore) {
        weeklyHighScore = score;
        localStorage.setItem('flappyWeeklyHighScore', weeklyHighScore);
        localStorage.setItem('flappyWeekNum', currentWeek); // Ensure week is current
        isNewRecord = true;
    }

    if (isNewRecord) {
        newRecordMsg.classList.remove('hidden');
        audio.playSFX('sfxNewRecordResult');
    } else {
        newRecordMsg.classList.add('hidden');
        audio.playSFX('sfxGameOver');
    }

    // Update UI for next start / game over screen
    endWeeklyBest.innerText = weeklyHighScore;
    startWeeklyBest.innerText = weeklyHighScore;
    startLastScore.innerText = lastScore;

    // Legacy High Score (Optional, keep if you want all-time tracking too)
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
muteBtn.addEventListener('click', () => audio.toggleMute());

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        triggerFlap();
    }
});

requestAnimationFrame(loop);

window.triggerFlap = triggerFlap;
window.startGame = startGame;