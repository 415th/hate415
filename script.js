// Constants
const GAME_HOUR_TO_REAL_MINUTES = 5; // 12 игровых часов = 1 реальный час = 60 мин = 3600 сек
const GAME_MULTIPLIER = 12; // 1 реальная сек = 12 игровых сек
const FISHING_TIME = 20; // Время рыбалки 20:00
const NETS_MORNING_ALARM_MINUTES = (7 * 60) + 30; // 07:30 утра для сетей
const NETS_EVENING_ALARM_MINUTES = (19 * 60) + 30; // 19:30 вечера перед ночным ловом
const NETS_NIGHT_START_MINUTES = 20 * 60; // ночной цикл начинается в 20:00
const NETS_CYCLE_INTERVAL_MINUTES = 4 * 60; // 20 реальных минут = 4 игровых часа
const NETS_CYCLE_WARNING_MINUTES = 30; // предупредить за 30 игровых минут
const NETS_NIGHT_CYCLE_OFFSETS = [0, NETS_CYCLE_INTERVAL_MINUTES, NETS_CYCLE_INTERVAL_MINUTES * 2];

// State variables
let syncTime = null; // Время синхронизации в миллисекундах
let initialGameHours = 0;
let initialGameMinutes = 0;
let netsAlarmEnabled = true;
let lastMorningAlarmDay = null;
let lastEveningAlarmDay = null;
let previousGameAbsoluteMinutes = null;
let netsCycleEnabled = false;
let netsCycleFirstWarningMinute = null;
let lastNetsCycleAlarmIndex = null;

// Timer state
let customTimerState = {
    isRunning: false,
    durationMinutes: 20,
    remainingSeconds: 20 * 60,
    finished: false,
    finishTime: null
};

let fishingAlertShown = false;
let audioContext = null;

// DOM Elements
const serverTimeInput = document.getElementById('serverTime');
const initialServerTimeInput = document.getElementById('initialServerTime');
const syncBtn = document.getElementById('syncBtn');
const initialSyncBtn = document.getElementById('initialSyncBtn');
const initialStartNightBtn = document.getElementById('initialStartNightBtn');
const resetBtn = document.getElementById('resetBtn');
const testAlarmBtn = document.getElementById('testAlarmBtn');
const gameTimeDisplay = document.getElementById('gameTime');
const realTimeDisplay = document.getElementById('realTime');
const elapsedRealDisplay = document.getElementById('elapsedReal');
const elapsedGameDisplay = document.getElementById('elapsedGame');
const syncInfoDisplay = document.getElementById('syncInfo');
const hourHand = document.getElementById('hourHand');
const minuteHand = document.getElementById('minuteHand');
const customTimerMarker = document.getElementById('customTimerMarker');
const netsMarker = document.getElementById('netsMarker');
const cycleMarkers = Array.from({ length: 6 }, (_, index) => document.getElementById(`cycleMarker${index}`));
const customTimerAlarmTime = document.getElementById('customTimerAlarmTime');
const netsCycleAlarmTime = document.getElementById('netsCycleAlarmTime');
const nextAlarmSummary = document.getElementById('nextAlarmSummary');
const clockNextAlarm = document.getElementById('clockNextAlarm');
const clockCycleStatus = document.getElementById('clockCycleStatus');
const clockSyncOverlay = document.getElementById('clockSyncOverlay');
const netsAlarmToggle = document.getElementById('netsAlarmToggle');
const netsAlarmBox = document.getElementById('netsAlarmBox');
const startNetsCycleBtn = document.getElementById('startNetsCycleBtn');
const stopNetsCycleBtn = document.getElementById('stopNetsCycleBtn');
const netsCycleStatus = document.getElementById('netsCycleStatus');

// Timer DOM Elements
const customTimerDisplay = document.getElementById('customTimer');
const customTimerBox = document.getElementById('customTimerBox');
const customTimerMinutesInput = document.getElementById('customTimerMinutes');
const preset20Btn = document.getElementById('preset20');
const preset30Btn = document.getElementById('preset30');
const startCustomTimerBtn = document.getElementById('startCustomTimer');
const stopCustomTimerBtn = document.getElementById('stopCustomTimer');
const resetCustomTimerBtn = document.getElementById('resetCustomTimer');
const fishingAlert = document.getElementById('fishingAlert');
const toastStack = document.getElementById('toastStack');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    syncBtn.addEventListener('click', () => handleSync());
    initialSyncBtn.addEventListener('click', () => handleSync(initialServerTimeInput.value));
    initialStartNightBtn.addEventListener('click', startNightFromInitialSync);
    resetBtn.addEventListener('click', handleReset);
    testAlarmBtn.addEventListener('click', () => {
        unlockAlertSound();
        playAlertSound();
    });
    
    // Timer event listeners
    preset20Btn.addEventListener('click', () => setCustomTimerMinutes(20));
    preset30Btn.addEventListener('click', () => setCustomTimerMinutes(30));
    customTimerMinutesInput.addEventListener('change', handleCustomTimerInput);
    startCustomTimerBtn.addEventListener('click', startCustomTimer);
    stopCustomTimerBtn.addEventListener('click', stopCustomTimer);
    resetCustomTimerBtn.addEventListener('click', resetCustomTimer);
    netsAlarmToggle.addEventListener('change', handleNetsAlarmToggle);
    startNetsCycleBtn.addEventListener('click', startNetsCycle);
    stopNetsCycleBtn.addEventListener('click', stopNetsCycle);
    
    // Load from localStorage if exists
    loadFromStorage();
    updateSyncState();
    customTimerDisplay.textContent = customTimerDisplay.textContent || formatTimerSeconds(customTimerState.remainingSeconds);
    
    // Update display every 100ms for smooth updates
    setInterval(updateDisplay, 100);
    updateDisplay();
});

function handleSync(forcedTimeValue = null) {
    unlockAlertSound();

    // Parse the input time
    const timeValue = typeof forcedTimeValue === 'string' ? forcedTimeValue : serverTimeInput.value;
    if (!timeValue) {
        showToast('Укажите время сервера.', 'warning');
        return;
    }

    const [hours, minutes] = timeValue.split(':').map(Number);
    
    // Set sync point
    initialGameHours = hours;
    initialGameMinutes = minutes;
    syncTime = Date.now();
    resetRuntimeState();
    serverTimeInput.value = formatTime(hours, minutes);
    initialServerTimeInput.value = formatTime(hours, minutes);
    
    // Save to localStorage
    saveToStorage();
    
    // Update info
    updateSyncInfo();
    updateSyncState();
    updateDisplay();
}

function resetRuntimeState() {
    resetAlarmGuards();
    stopCustomTimer();
    netsCycleEnabled = false;
    netsCycleFirstWarningMinute = null;
    lastNetsCycleAlarmIndex = null;
    updateNetsCycleStatus(getCurrentGameTime());
}

function startNightFromInitialSync() {
    unlockAlertSound();
    syncToGameTime(20, 0);
    const currentGame = getCurrentGameTime();
    startNetsCycleAtCurrentNight(currentGame);
    updateDisplay();
}

function handleReset() {
    unlockAlertSound();
    syncTime = null;
    initialGameHours = 0;
    initialGameMinutes = 0;
    netsAlarmEnabled = true;
    lastMorningAlarmDay = null;
    lastEveningAlarmDay = null;
    previousGameAbsoluteMinutes = null;
    netsCycleEnabled = false;
    netsCycleFirstWarningMinute = null;
    lastNetsCycleAlarmIndex = null;
    netsAlarmToggle.checked = true;
    serverTimeInput.value = '12:00';
    initialServerTimeInput.value = '12:00';
    syncInfoDisplay.textContent = 'Время синхронизации: -';
    
    // Reset timer
    setCustomTimerMinutes(20);
    resetCustomTimer();
    clearClockUi();
    fishingAlert.style.display = 'none';
    fishingAlertShown = false;
    
    localStorage.removeItem('rdr2ClockData');
    updateSyncState();
    updateDisplay();
}

function clearClockUi() {
    gameTimeDisplay.textContent = '-- :--';
    setNextAlarmText(netsAlarmEnabled ? 'Сети в 07:30' : 'Нет активных');
    netsCycleAlarmTime.textContent = 'Цикл сетей: --:--';
    customTimerAlarmTime.textContent = 'Таймер прозвенит: --:--';
    netsCycleStatus.textContent = 'Ночной цикл с 20:00 не запущен';
    clockCycleStatus.textContent = 'Не запущен';
    hourHand.style.transform = 'rotate(0deg)';
    minuteHand.style.transform = 'rotate(0deg)';
    customTimerMarker.classList.remove('visible');
    netsMarker.classList.remove('visible');
    cycleMarkers.forEach(marker => marker.classList.remove('visible'));
}

function handleNetsAlarmToggle() {
    unlockAlertSound();
    netsAlarmEnabled = netsAlarmToggle.checked;
    netsAlarmBox.classList.toggle('disabled', !netsAlarmEnabled);
    saveToStorage();
    updateAnalogClock();
}

function startNetsCycle() {
    unlockAlertSound();
    const confirmed = confirm('Сейчас в игре 20:00? Запустить полный ночной цикл сетей с 20:00?');
    if (!confirmed) {
        return;
    }

    syncToGameTime(20, 0);
    const currentGame = getCurrentGameTime();
    startNetsCycleAtCurrentNight(currentGame);
    updateDisplay();
}

function startNetsCycleAtCurrentNight(currentGame) {
    netsCycleEnabled = true;
    netsCycleFirstWarningMinute = getNightCycleFirstWarningMinute(currentGame);
    const mostRecentCycleAlarm = getMostRecentCycleAlarm(currentGame);
    lastNetsCycleAlarmIndex = mostRecentCycleAlarm ? mostRecentCycleAlarm.absoluteGameMinutes : null;
    updateNetsCycleStatus(currentGame);
    saveToStorage();
}

function syncToGameTime(hours, minutes) {
    initialGameHours = hours;
    initialGameMinutes = minutes;
    syncTime = Date.now();
    resetAlarmGuards();
    serverTimeInput.value = formatTime(hours, minutes);
    initialServerTimeInput.value = formatTime(hours, minutes);
    updateSyncInfo();
    updateSyncState();
    saveToStorage();
}

function stopNetsCycle() {
    unlockAlertSound();
    netsCycleEnabled = false;
    netsCycleFirstWarningMinute = null;
    lastNetsCycleAlarmIndex = null;
    updateNetsCycleStatus(getCurrentGameTime());
    saveToStorage();
    updateDisplay();
}

function handleCustomTimerInput() {
    const minutes = Number(customTimerMinutesInput.value);
    setCustomTimerMinutes(minutes);
}

function setCustomTimerMinutes(minutes) {
    const normalizedMinutes = Math.min(180, Math.max(1, Math.round(minutes) || 20));

    customTimerState.durationMinutes = normalizedMinutes;
    customTimerMinutesInput.value = normalizedMinutes;
    preset20Btn.classList.toggle('active', normalizedMinutes === 20);
    preset30Btn.classList.toggle('active', normalizedMinutes === 30);

    if (!customTimerState.isRunning) {
        resetCustomTimer();
    }

    saveToStorage();
}

function startCustomTimer() {
    unlockAlertSound();
    if (!customTimerState.isRunning) {
        customTimerState.isRunning = true;
        customTimerState.finishTime = Date.now() + (customTimerState.remainingSeconds * 1000);

        customTimerBox.classList.add('running');
        customTimerBox.classList.remove('finished');
    }
}

function stopCustomTimer() {
    unlockAlertSound();
    if (customTimerState.isRunning) {
        customTimerState.isRunning = false;
        customTimerBox.classList.remove('running');
    }
}

function resetCustomTimer() {
    unlockAlertSound();
    customTimerState.isRunning = false;
    customTimerState.remainingSeconds = customTimerState.durationMinutes * 60;
    customTimerState.finished = false;
    customTimerState.finishTime = null;

    customTimerDisplay.textContent = formatTimerSeconds(customTimerState.remainingSeconds);
    customTimerBox.classList.remove('running', 'finished');
    updateAnalogClock();
}

function playAlertSound() {
    try {
        audioContext = getAudioContext();

        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => playBeeps(audioContext));
        } else {
            playBeeps(audioContext);
        }
    } catch (e) {
        console.log('Audio not available, using alert instead');
        showToast('Время истекло.', 'alarm');
    }
}

function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = audioContext || new AudioContextClass();
    return audioContext;
}

function unlockAlertSound() {
    try {
        const context = getAudioContext();

        if (context.state === 'suspended') {
            context.resume();
        }

        playSilentBeep(context);
    } catch (e) {
        console.log('Audio unlock unavailable:', e);
    }
}

function playSilentBeep(context) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = context.currentTime;
    const stopAt = startAt + 0.03;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    gainNode.gain.setValueAtTime(0.001, startAt);
    gainNode.gain.setValueAtTime(0.001, stopAt);
    oscillator.start(startAt);
    oscillator.stop(stopAt);
}

function triggerAlarm(message) {
    playAlertSound();
    setTimeout(() => showToast(message, 'alarm'), 900);
}

function showToast(message, type = 'info') {
    if (!toastStack) {
        console.log(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 260);
    }, 5200);
}

function playBeeps(context) {
    playBeep(context, 780, 0);
    playBeep(context, 940, 0.42);
    playBeep(context, 820, 0.84);
}

function playBeep(context, frequency, delaySeconds) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = context.currentTime + delaySeconds;
    const stopAt = startAt + 0.28;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.36, startAt + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, stopAt);

    oscillator.start(startAt);
    oscillator.stop(stopAt);
}

function updateDisplay() {
    updateRealTime();
    updateTimers();
    
    if (syncTime === null) {
        gameTimeDisplay.textContent = '-- :--';
        if (elapsedRealDisplay) elapsedRealDisplay.textContent = '0 сек';
        if (elapsedGameDisplay) elapsedGameDisplay.textContent = '0 сек';
        const summary = netsAlarmEnabled ? 'Сети в 07:30' : 'Нет активных';
        setNextAlarmText(summary);
        updateNetsCycleStatus(null);
        updateAnalogClock(null);
        previousGameAbsoluteMinutes = null;
        return;
    }

    const currentGame = getCurrentGameTime();
    const elapsedMillis = currentGame.elapsedMillis;
    const elapsedSeconds = Math.floor(elapsedMillis / 1000);
    const gameSecondsElapsed = elapsedSeconds * GAME_MULTIPLIER;
    
    // Update displays
    gameTimeDisplay.textContent = formatTime(currentGame.hours, currentGame.minutes);
    if (elapsedRealDisplay) elapsedRealDisplay.textContent = formatElapsedTime(elapsedSeconds);
    if (elapsedGameDisplay) elapsedGameDisplay.textContent = formatElapsedTime(gameSecondsElapsed);
    updateAnalogClock(currentGame);
    updateNextAlarmSummary(currentGame);
    updateNetsCycleStatus(currentGame);
    
    // Check for fishing time (20:00)
    checkFishingTime(currentGame.hours);
    checkNetsAlarm(currentGame);
    checkNetsCycleAlarm(currentGame);
    previousGameAbsoluteMinutes = currentGame.absoluteGameMinutes;
}

function updateRealTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    realTimeDisplay.textContent = `${hours}:${minutes}`;
}

function updateTimers() {
    if (customTimerState.isRunning) {
        const now = Date.now();
        const remainingMs = customTimerState.finishTime - now;
        
        if (remainingMs <= 0) {
            customTimerState.isRunning = false;
            customTimerState.remainingSeconds = 0;
            customTimerState.finished = true;
            customTimerDisplay.textContent = '00:00';
            
            customTimerBox.classList.remove('running');
            customTimerBox.classList.add('finished');
            
            triggerAlarm('Таймер истек.');
        } else {
            customTimerState.remainingSeconds = Math.ceil(remainingMs / 1000);
            customTimerDisplay.textContent = formatTimerSeconds(customTimerState.remainingSeconds);
        }
    }
}

function checkFishingTime(currentHour) {
    if (currentHour === FISHING_TIME) {
        if (!fishingAlertShown) {
            fishingAlert.style.display = 'block';
            fishingAlertShown = true;
            triggerAlarm('20:00 в игре. Началась ночь для сетей.');
        }
    } else {
        if (fishingAlertShown) {
            fishingAlert.style.display = 'none';
            fishingAlertShown = false;
        }
    }
}

function checkNetsAlarm(currentGame) {
    if (!netsAlarmEnabled) {
        return;
    }

    if (didCrossFixedAlarm(currentGame, NETS_MORNING_ALARM_MINUTES) && lastMorningAlarmDay !== currentGame.day) {
        lastMorningAlarmDay = currentGame.day;
        triggerAlarm('07:30 утра в игре. Пора переставить сети до 08:00!');
        saveToStorage();
    }

    if (didCrossFixedAlarm(currentGame, NETS_EVENING_ALARM_MINUTES) && lastEveningAlarmDay !== currentGame.day) {
        lastEveningAlarmDay = currentGame.day;
        triggerAlarm('19:30 в игре. Скоро ночь: подготовьтесь поставить сети к 20:00!');
        saveToStorage();
    }
}

function didCrossFixedAlarm(currentGame, alarmMinutesOfDay) {
    const currentAlarmMinute = (currentGame.day * 1440) + alarmMinutesOfDay;

    if (previousGameAbsoluteMinutes === null) {
        return currentGame.absoluteGameMinutes === currentAlarmMinute;
    }

    return previousGameAbsoluteMinutes < currentAlarmMinute && currentGame.absoluteGameMinutes >= currentAlarmMinute;
}

function resetAlarmGuards() {
    lastMorningAlarmDay = null;
    lastEveningAlarmDay = null;
    previousGameAbsoluteMinutes = null;
}

function checkNetsCycleAlarm(currentGame) {
    if (!netsCycleEnabled || netsCycleFirstWarningMinute === null) {
        return;
    }

    const alarm = getMostRecentCycleAlarm(currentGame);
    if (alarm === null || alarm.absoluteGameMinutes === lastNetsCycleAlarmIndex) {
        return;
    }

    lastNetsCycleAlarmIndex = alarm.absoluteGameMinutes;
    const targetTime = getGameTimeFromAbsoluteMinutes(alarm.absoluteGameMinutes + NETS_CYCLE_WARNING_MINUTES);
    triggerAlarm(`Пора готовиться переставить сети. Следующая постановка к ${formatTime(targetTime.hours, targetTime.minutes)}.`);
    saveToStorage();
}

function getCurrentGameTime(atTime = Date.now()) {
    if (syncTime === null) {
        return null;
    }

    const elapsedMillis = Math.max(0, atTime - syncTime);
    const elapsedSeconds = Math.floor(elapsedMillis / 1000);
    const gameSecondsElapsed = elapsedSeconds * GAME_MULTIPLIER;
    const gameMinutesElapsed = Math.floor(gameSecondsElapsed / 60);
    const absoluteGameMinutes = (initialGameHours * 60) + initialGameMinutes + gameMinutesElapsed;
    const minutesOfDay = absoluteGameMinutes % 1440;

    return {
        elapsedMillis,
        absoluteGameMinutes,
        minutesOfDay,
        day: Math.floor(absoluteGameMinutes / 1440),
        hours: Math.floor(minutesOfDay / 60),
        minutes: minutesOfDay % 60
    };
}

function updateAnalogClock(currentGame = getCurrentGameTime()) {
    const hasGameTime = currentGame !== null;
    const minutesOfDay = hasGameTime ? currentGame.minutesOfDay : 0;
    const hourAngle = ((minutesOfDay % 720) / 720) * 360;
    const minuteAngle = (hasGameTime ? currentGame.minutes : 0) * 6;

    hourHand.style.transform = `rotate(${hourAngle}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;

    updateTimerMarker(customTimerState, customTimerMarker, customTimerAlarmTime, 'Таймер прозвенит');
    updateFixedMarker(netsMarker, NETS_MORNING_ALARM_MINUTES, netsAlarmEnabled && hasGameTime);
    updateCycleMarkers(currentGame);
}

function updateTimerMarker(timerState, marker, label, labelText) {
    if (syncTime === null || !timerState.isRunning || timerState.finishTime === null) {
        marker.classList.remove('visible');
        label.textContent = `${labelText}: --:--`;
        return;
    }

    const finishGame = getCurrentGameTime(timerState.finishTime);
    updateFixedMarker(marker, finishGame.minutesOfDay, true);
    label.textContent = `${labelText}: ${formatTime(finishGame.hours, finishGame.minutes)}`;
}

function updateFixedMarker(marker, minutesOfDay, isVisible) {
    const angle = ((minutesOfDay % 720) / 720) * 360;
    marker.style.setProperty('--angle', `${angle}deg`);
    marker.classList.toggle('visible', isVisible);
}

function updateCycleMarkers(currentGame) {
    cycleMarkers.forEach(marker => marker.classList.remove('visible'));

    if (!netsCycleEnabled || netsCycleFirstWarningMinute === null || currentGame === null) {
        netsCycleAlarmTime.textContent = 'Цикл сетей: --:--';
        return;
    }

    const nextCycleAlarm = getNextCycleAlarm(currentGame);
    if (nextCycleAlarm === null) {
        netsCycleAlarmTime.textContent = 'Цикл сетей: --:--';
        return;
    }

    netsCycleAlarmTime.textContent = `Цикл сетей: ${formatTime(nextCycleAlarm.hours, nextCycleAlarm.minutes)}`;

    cycleMarkers.forEach((marker, offset) => {
        if (offset >= NETS_NIGHT_CYCLE_OFFSETS.length) {
            return;
        }

        const alarmMinute = getCycleAlarmByOffset(currentGame, offset).absoluteGameMinutes;
        updateFixedMarker(marker, alarmMinute % 1440, true);
    });
}

function getNextCycleAlarm(currentGame) {
    if (!netsCycleEnabled || netsCycleFirstWarningMinute === null) {
        return null;
    }

    const candidates = [];
    const currentNightIndex = Math.floor((currentGame.absoluteGameMinutes - netsCycleFirstWarningMinute) / 1440);
    const firstNightIndex = Math.max(0, currentNightIndex - 1);

    for (let nightOffset = firstNightIndex; nightOffset <= firstNightIndex + 3; nightOffset++) {
        NETS_NIGHT_CYCLE_OFFSETS.forEach(offset => {
            const absoluteGameMinutes = netsCycleFirstWarningMinute + (nightOffset * 1440) + offset;
            if (absoluteGameMinutes >= currentGame.absoluteGameMinutes) {
                candidates.push(getGameTimeFromAbsoluteMinutes(absoluteGameMinutes));
            }
        });
    }

    candidates.sort((a, b) => a.absoluteGameMinutes - b.absoluteGameMinutes);
    return candidates[0] || null;
}

function getCycleAlarmByOffset(currentGame, offsetIndex) {
    const nextCycleAlarm = getNextCycleAlarm(currentGame);
    const baseNightStart = netsCycleFirstWarningMinute + (Math.floor((nextCycleAlarm.absoluteGameMinutes - netsCycleFirstWarningMinute) / 1440) * 1440);
    let absoluteGameMinutes = baseNightStart + NETS_NIGHT_CYCLE_OFFSETS[offsetIndex];

    if (absoluteGameMinutes < currentGame.absoluteGameMinutes) {
        absoluteGameMinutes += 1440;
    }

    return getGameTimeFromAbsoluteMinutes(absoluteGameMinutes);
}

function getMostRecentCycleAlarm(currentGame) {
    const candidates = [];
    const currentNightIndex = Math.floor((currentGame.absoluteGameMinutes - netsCycleFirstWarningMinute) / 1440);
    const firstNightIndex = Math.max(0, currentNightIndex - 1);

    for (let nightOffset = firstNightIndex; nightOffset <= firstNightIndex + 1; nightOffset++) {
        NETS_NIGHT_CYCLE_OFFSETS.forEach(offset => {
            const absoluteGameMinutes = netsCycleFirstWarningMinute + (nightOffset * 1440) + offset;
            if (absoluteGameMinutes <= currentGame.absoluteGameMinutes) {
                candidates.push(getGameTimeFromAbsoluteMinutes(absoluteGameMinutes));
            }
        });
    }

    candidates.sort((a, b) => b.absoluteGameMinutes - a.absoluteGameMinutes);
    return candidates[0] || null;
}

function getNightCycleFirstWarningMinute(currentGame) {
    let nightStartMinute;

    if (currentGame.minutesOfDay < NETS_MORNING_ALARM_MINUTES) {
        nightStartMinute = (currentGame.day * 1440) + NETS_NIGHT_START_MINUTES - 1440;
    } else if (currentGame.minutesOfDay >= NETS_NIGHT_START_MINUTES) {
        nightStartMinute = (currentGame.day * 1440) + NETS_NIGHT_START_MINUTES;
    } else {
        nightStartMinute = (currentGame.day * 1440) + NETS_NIGHT_START_MINUTES;
    }

    return nightStartMinute + NETS_CYCLE_INTERVAL_MINUTES - NETS_CYCLE_WARNING_MINUTES;
}

function getGameTimeFromAbsoluteMinutes(absoluteGameMinutes) {
    const minutesOfDay = ((absoluteGameMinutes % 1440) + 1440) % 1440;

    return {
        absoluteGameMinutes,
        minutesOfDay,
        day: Math.floor(absoluteGameMinutes / 1440),
        hours: Math.floor(minutesOfDay / 60),
        minutes: minutesOfDay % 60
    };
}

function updateNextAlarmSummary(currentGame) {
    const alarms = [];

    if (customTimerState.isRunning && customTimerState.finishTime !== null) {
        const finishGame = getCurrentGameTime(customTimerState.finishTime);
        alarms.push({
            label: 'Таймер',
            absoluteGameMinutes: finishGame.absoluteGameMinutes,
            time: formatTime(finishGame.hours, finishGame.minutes)
        });
    }

    if (netsAlarmEnabled) {
        alarms.push(getUpcomingFixedAlarm(currentGame, 'Сети утро', NETS_MORNING_ALARM_MINUTES));
        alarms.push(getUpcomingFixedAlarm(currentGame, 'Сети вечер', NETS_EVENING_ALARM_MINUTES));
    }

    const nextCycleAlarm = getNextCycleAlarm(currentGame);
    if (nextCycleAlarm !== null) {
        alarms.push({
            label: 'Цикл сетей',
            absoluteGameMinutes: nextCycleAlarm.absoluteGameMinutes,
            time: formatTime(nextCycleAlarm.hours, nextCycleAlarm.minutes)
        });
    }

    if (alarms.length === 0) {
        setNextAlarmText('Нет активных');
        return;
    }

    alarms.sort((a, b) => a.absoluteGameMinutes - b.absoluteGameMinutes);
    const summary = `${alarms[0].label}: ${alarms[0].time} (${formatRealTimeForGameMinute(alarms[0].absoluteGameMinutes)})`;
    setNextAlarmText(summary);
}

function formatRealTimeForGameMinute(absoluteGameMinutes) {
    if (syncTime === null) {
        return '--:--';
    }

    const initialAbsoluteMinutes = (initialGameHours * 60) + initialGameMinutes;
    const gameMinutesUntilAlarm = Math.max(0, absoluteGameMinutes - initialAbsoluteMinutes);
    const realMillisecondsUntilAlarm = (gameMinutesUntilAlarm * 60 * 1000) / GAME_MULTIPLIER;
    const alarmDate = new Date(syncTime + realMillisecondsUntilAlarm);
    const hours = String(alarmDate.getHours()).padStart(2, '0');
    const minutes = String(alarmDate.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
}

function setNextAlarmText(text) {
    if (nextAlarmSummary) {
        nextAlarmSummary.textContent = text;
    }

    clockNextAlarm.textContent = text;
}

function getUpcomingFixedAlarm(currentGame, label, minutesOfDay) {
    let absoluteGameMinutes = (currentGame.day * 1440) + minutesOfDay;
    if (absoluteGameMinutes <= currentGame.absoluteGameMinutes) {
        absoluteGameMinutes += 1440;
    }

    const alarmTime = getGameTimeFromAbsoluteMinutes(absoluteGameMinutes);
    return {
        label,
        absoluteGameMinutes,
        time: formatTime(alarmTime.hours, alarmTime.minutes)
    };
}

function updateNetsCycleStatus(currentGame) {
    if (!netsCycleEnabled || netsCycleFirstWarningMinute === null || currentGame === null) {
        netsCycleStatus.textContent = 'Ночной цикл с 20:00 не запущен';
        clockCycleStatus.textContent = 'Не запущен';
        return;
    }

    const nextCycleAlarm = getNextCycleAlarm(currentGame);
    const targetTime = getGameTimeFromAbsoluteMinutes(nextCycleAlarm.absoluteGameMinutes + NETS_CYCLE_WARNING_MINUTES);
    const status = `Сигнал ${formatTime(nextCycleAlarm.hours, nextCycleAlarm.minutes)}, к ${formatTime(targetTime.hours, targetTime.minutes)}`;
    netsCycleStatus.textContent = `Следующий ${status.toLowerCase()}`;
    clockCycleStatus.textContent = status;
}

function updateSyncState() {
    const isSynced = syncTime !== null;
    clockSyncOverlay.classList.toggle('hidden', isSynced);
    document.body.classList.toggle('unsynced', !isSynced);
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

function formatTimerSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
        initialGameMinutes: initialGameMinutes,
        netsAlarmEnabled: netsAlarmEnabled,
        lastMorningAlarmDay: lastMorningAlarmDay,
        lastEveningAlarmDay: lastEveningAlarmDay,
        previousGameAbsoluteMinutes: previousGameAbsoluteMinutes,
        netsCycleEnabled: netsCycleEnabled,
        netsCycleFirstWarningMinute: netsCycleFirstWarningMinute,
        lastNetsCycleAlarmIndex: lastNetsCycleAlarmIndex,
        customTimerMinutes: customTimerState.durationMinutes
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
            netsAlarmEnabled = parsed.netsAlarmEnabled !== false;
            lastMorningAlarmDay = parsed.lastMorningAlarmDay ?? parsed.lastNetsAlarmDay ?? null;
            lastEveningAlarmDay = parsed.lastEveningAlarmDay ?? null;
            previousGameAbsoluteMinutes = parsed.previousGameAbsoluteMinutes ?? null;
            netsCycleEnabled = parsed.netsCycleEnabled === true;
            netsCycleFirstWarningMinute = parsed.netsCycleFirstWarningMinute ?? null;
            lastNetsCycleAlarmIndex = parsed.lastNetsCycleAlarmIndex ?? null;
            customTimerState.durationMinutes = parsed.customTimerMinutes || 20;
            customTimerState.remainingSeconds = customTimerState.durationMinutes * 60;
            customTimerMinutesInput.value = customTimerState.durationMinutes;
            preset20Btn.classList.toggle('active', customTimerState.durationMinutes === 20);
            preset30Btn.classList.toggle('active', customTimerState.durationMinutes === 30);
            customTimerDisplay.textContent = formatTimerSeconds(customTimerState.remainingSeconds);
            netsAlarmToggle.checked = netsAlarmEnabled;
            netsAlarmBox.classList.toggle('disabled', !netsAlarmEnabled);
            
            // Update input field
            if (syncTime !== null) {
                serverTimeInput.value = formatTime(initialGameHours, initialGameMinutes);
                initialServerTimeInput.value = formatTime(initialGameHours, initialGameMinutes);
                updateSyncInfo();
            }
            updateSyncState();
        } catch (e) {
            console.error('Error loading from storage:', e);
        }
    }
}
