// Constants
const GAME_HOUR_TO_REAL_MINUTES = 5; // 12 игровых часов = 1 реальный час = 60 мин = 3600 сек
const GAME_MULTIPLIER = 12; // 1 реальная сек = 12 игровых сек
const FISHING_TIME = 20; // Время рыбалки 20:00

// State variables
let syncTime = null; // Время синхронизации в миллисекундах
let initialGameHours = 0;
let initialGameMinutes = 0;

// Timer state
let timer20State = {
    isRunning: false,
    remainingSeconds: 20 * 60, // 20 minutes
    finished: false,
    finishTime: null
};

let timer30State = {
    isRunning: false,
    remainingSeconds: 30 * 60, // 30 minutes
    finished: false,
    finishTime: null
};

let fishingAlertShown = false;

// DOM Elements
const serverTimeInput = document.getElementById('serverTime');
const syncBtn = document.getElementById('syncBtn');
const resetBtn = document.getElementById('resetBtn');
const testAlarmBtn = document.getElementById('testAlarmBtn');
const gameTimeDisplay = document.getElementById('gameTime');
const realTimeDisplay = document.getElementById('realTime');
const elapsedRealDisplay = document.getElementById('elapsedReal');
const elapsedGameDisplay = document.getElementById('elapsedGame');
const syncInfoDisplay = document.getElementById('syncInfo');

// Timer DOM Elements
const timer20Display = document.getElementById('timer20');
const timer30Display = document.getElementById('timer30');
const timerBox20 = document.getElementById('timerBox20');
const timerBox30 = document.getElementById('timerBox30');
const start20Btn = document.getElementById('start20');
const stop20Btn = document.getElementById('stop20');
const reset20Btn = document.getElementById('reset20');
const start30Btn = document.getElementById('start30');
const stop30Btn = document.getElementById('stop30');
const reset30Btn = document.getElementById('reset30');
const fishingAlert = document.getElementById('fishingAlert');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    syncBtn.addEventListener('click', handleSync);
    resetBtn.addEventListener('click', handleReset);
    testAlarmBtn.addEventListener('click', () => playAlertSound());
    
    // Timer event listeners
    start20Btn.addEventListener('click', () => startTimer(20));
    stop20Btn.addEventListener('click', () => stopTimer(20));
    reset20Btn.addEventListener('click', () => resetTimer(20));
    
    start30Btn.addEventListener('click', () => startTimer(30));
    stop30Btn.addEventListener('click', () => stopTimer(30));
    reset30Btn.addEventListener('click', () => resetTimer(30));
    
    // Load from localStorage if exists
    loadFromStorage();
    
    // Update display every 100ms for smooth updates
    setInterval(updateDisplay, 100);
    updateDisplay();
});

function handleSync() {
    // Parse the input time
    const timeValue = serverTimeInput.value;
    if (!timeValue) {
        alert('Пожалуйста, установите время!');
        return;
    }

    const [hours, minutes] = timeValue.split(':').map(Number);
    
    // Set sync point
    initialGameHours = hours;
    initialGameMinutes = minutes;
    syncTime = Date.now();
    
    // Save to localStorage
    saveToStorage();
    
    // Update info
    updateSyncInfo();
}

function handleReset() {
    syncTime = null;
    initialGameHours = 0;
    initialGameMinutes = 0;
    serverTimeInput.value = '12:00';
    syncInfoDisplay.textContent = 'Время синхронизации: -';
    
    // Reset timers
    resetTimer(20);
    resetTimer(30);
    fishingAlert.style.display = 'none';
    fishingAlertShown = false;
    
    localStorage.removeItem('rdr2ClockData');
    updateDisplay();
}

function startTimer(minutes) {
    const timerState = minutes === 20 ? timer20State : timer30State;
    const box = minutes === 20 ? timerBox20 : timerBox30;
    
    if (!timerState.isRunning) {
        timerState.isRunning = true;
        timerState.finishTime = Date.now() + (timerState.remainingSeconds * 1000);
        
        box.classList.add('running');
        box.classList.remove('finished');
    }
}

function stopTimer(minutes) {
    const timerState = minutes === 20 ? timer20State : timer30State;
    const box = minutes === 20 ? timerBox20 : timerBox30;
    
    if (timerState.isRunning) {
        timerState.isRunning = false;
        
        box.classList.remove('running');
    }
}

function resetTimer(minutes) {
    const timerState = minutes === 20 ? timer20State : timer30State;
    const display = minutes === 20 ? timer20Display : timer30Display;
    const box = minutes === 20 ? timerBox20 : timerBox30;
    
    timerState.isRunning = false;
    timerState.remainingSeconds = (minutes * 60);
    timerState.finished = false;
    timerState.finishTime = null;
    
    display.textContent = `${minutes}:00`;
    box.classList.remove('running', 'finished');
}

function playAlertSound() {
    // Create a simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // 800 Hz
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Second beep
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            
            osc2.frequency.value = 900;
            osc2.type = 'sine';
            
            gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.5);
        }, 600);
    } catch (e) {
        console.log('Audio not available, using alert instead');
        alert('⏰ Время истекло!');
    }
}

function updateDisplay() {
    updateRealTime();
    updateTimers();
    
    if (syncTime === null) {
        gameTimeDisplay.textContent = '-- :--';
        elapsedRealDisplay.textContent = '0 сек';
        elapsedGameDisplay.textContent = '0 сек';
        return;
    }

    // Calculate elapsed time
    const now = Date.now();
    const elapsedMillis = now - syncTime;
    const elapsedSeconds = Math.floor(elapsedMillis / 1000);
    
    // Calculate game time elapsed
    const gameSecondsElapsed = elapsedSeconds * GAME_MULTIPLIER;
    const gameMinutesElapsed = Math.floor(gameSecondsElapsed / 60);
    const gameHoursElapsed = Math.floor(gameMinutesElapsed / 60);
    
    // Calculate new game time
    let totalGameMinutes = initialGameHours * 60 + initialGameMinutes + gameMinutesElapsed;
    
    // Handle day wrap (24 hours = 1440 minutes)
    totalGameMinutes = totalGameMinutes % 1440;
    
    const newHours = Math.floor(totalGameMinutes / 60);
    const newMinutes = totalGameMinutes % 60;
    
    // Update displays
    gameTimeDisplay.textContent = formatTime(newHours, newMinutes);
    elapsedRealDisplay.textContent = formatElapsedTime(elapsedSeconds);
    elapsedGameDisplay.textContent = formatElapsedTime(gameSecondsElapsed);
    
    // Check for fishing time (20:00)
    checkFishingTime(newHours);
}

function updateRealTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    realTimeDisplay.textContent = `${hours}:${minutes}`;
}

function updateTimers() {
    // Update 20 min timer
    if (timer20State.isRunning) {
        const now = Date.now();
        const remainingMs = timer20State.finishTime - now;
        
        if (remainingMs <= 0) {
            timer20State.isRunning = false;
            timer20State.remainingSeconds = 0;
            timer20State.finished = true;
            timer20Display.textContent = '00:00';
            
            timerBox20.classList.remove('running');
            timerBox20.classList.add('finished');
            
            playAlertSound();
        } else {
            timer20State.remainingSeconds = Math.ceil(remainingMs / 1000);
            const mins = Math.floor(timer20State.remainingSeconds / 60);
            const secs = timer20State.remainingSeconds % 60;
            timer20Display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }
    
    // Update 30 min timer
    if (timer30State.isRunning) {
        const now = Date.now();
        const remainingMs = timer30State.finishTime - now;
        
        if (remainingMs <= 0) {
            timer30State.isRunning = false;
            timer30State.remainingSeconds = 0;
            timer30State.finished = true;
            timer30Display.textContent = '00:00';
            
            timerBox30.classList.remove('running');
            timerBox30.classList.add('finished');
            
            playAlertSound();
        } else {
            timer30State.remainingSeconds = Math.ceil(remainingMs / 1000);
            const mins = Math.floor(timer30State.remainingSeconds / 60);
            const secs = timer30State.remainingSeconds % 60;
            timer30Display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }
}

function checkFishingTime(currentHour) {
    if (currentHour === FISHING_TIME) {
        if (!fishingAlertShown) {
            fishingAlert.style.display = 'block';
            fishingAlertShown = true;
            playAlertSound();
        }
    } else {
        if (fishingAlertShown) {
            fishingAlert.style.display = 'none';
            fishingAlertShown = false;
        }
    }
}

function updateSyncInfo() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    syncInfoDisplay.textContent = `Синхронизировано: ${hours}:${minutes}:${seconds}`;
}

function formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}ч ${minutes}м ${secs}с`;
    } else if (minutes > 0) {
        return `${minutes}м ${secs}с`;
    } else {
        return `${secs}с`;
    }
}

function saveToStorage() {
    const data = {
        syncTime: syncTime,
        initialGameHours: initialGameHours,
        initialGameMinutes: initialGameMinutes
    };
    localStorage.setItem('rdr2ClockData', JSON.stringify(data));
}

function loadFromStorage() {
    const data = localStorage.getItem('rdr2ClockData');
    if (data) {
        try {
            const parsed = JSON.parse(data);
            syncTime = parsed.syncTime;
            initialGameHours = parsed.initialGameHours;
            initialGameMinutes = parsed.initialGameMinutes;
            
            // Update input field
            serverTimeInput.value = formatTime(initialGameHours, initialGameMinutes);
            updateSyncInfo();
        } catch (e) {
            console.error('Error loading from storage:', e);
        }
    }
}
