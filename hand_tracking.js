const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('status-text');

// Gesture State
let isPinched = false;
const PINCH_THRESHOLD = 0.05; // Distance threshold for pinch
const RELEASE_THRESHOLD = 0.08; // Distance to reset pinch
let lastPinchTime = 0;
const COOLDOWN = 200; // ms between jumps if holding pinch (optional, or just require release)

function onResults(results) {
    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusText.innerText = "Hand Detected";
        statusText.style.color = "#4CAF50";

        for (const landmarks of results.multiHandLandmarks) {
            // Draw landmarks
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });

            // Check for Pinch Gesture (Thumb Tip #4, Index Tip #8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            // Calculate distance (Euclidean)
            // Note: z is depth, we mostly care about x,y for screen pinch, but 3d distance is fine too
            const distance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) +
                Math.pow(thumbTip.y - indexTip.y, 2)
            );

            // Gesture Logic

            // 1. Check for Hover Mode: "Pointing Up"
            // Logic: Index finger extended, others curled.
            // Index Tip (8) y < Index PIP (6) y
            // Middle Tip (12) y > Middle PIP (10) y
            // Ring Tip (16) y > Ring PIP (14) y
            // Pinky Tip (20) y > Pinky PIP (18) y

            const indexExtended = landmarks[8].y < landmarks[6].y;
            const middleCurled = landmarks[12].y > landmarks[10].y;
            const ringCurled = landmarks[16].y > landmarks[14].y;
            const pinkyCurled = landmarks[20].y > landmarks[18].y;

            if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
                if (!window.isHovering) {
                    window.isHovering = true;
                    statusText.innerText = "Glide Mode (Pointing Up)";
                    statusText.style.color = "#00FFFF";
                }

                // Visual Feedback for Hover
                canvasCtx.beginPath();
                canvasCtx.arc(landmarks[8].x * canvasElement.width, landmarks[8].y * canvasElement.height, 20, 0, 2 * Math.PI);
                canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.8)";
                canvasCtx.lineWidth = 3;
                canvasCtx.stroke();

            } else {
                window.isHovering = false;
            }

            // 2. Check for Pinch (Jump)
            if (distance < PINCH_THRESHOLD) {
                window.isHovering = false; // Pinch overrides hover
                if (!isPinched) {
                    // New Pinch Detected
                    isPinched = true;
                    console.log("Pinch detected!");

                    // Visual Feedback
                    canvasCtx.beginPath();
                    canvasCtx.arc(thumbTip.x * canvasElement.width, thumbTip.y * canvasElement.height, 15, 0, 2 * Math.PI);
                    canvasCtx.fillStyle = "rgba(255, 255, 0, 0.5)";
                    canvasCtx.fill();

                    // Trigger Game Action
                    if (window.triggerFlap) {
                        window.triggerFlap();
                    }
                }
            } else if (distance > RELEASE_THRESHOLD) {
                // Reset pinch state
                isPinched = false;
            }
        }
    } else {
        statusText.innerText = "Looking for hands...";
        statusText.style.color = "#ccc";
    }
    canvasCtx.restore();
}

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Initialize Camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 320,
    height: 240
});

camera.start()
    .then(() => {
        statusText.innerText = "Camera Active";
    })
    .catch(err => {
        console.error(err);
        statusText.innerText = "Camera Error: " + err.message;
    });
