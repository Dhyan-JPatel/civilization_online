// Firebase Modular SDK v9+ imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, get, update, remove, onValue, off, serverTimestamp, runTransaction, push } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// ========================================
// FIREBASE INITIALIZATION
// ========================================

// Check for runtime-injected config
const firebaseConfig = window.__FIREBASE_CONFIG__ || {
    apiKey: "PLACEHOLDER_API_KEY",
    authDomain: "PLACEHOLDER_AUTH_DOMAIN",
    databaseURL: "PLACEHOLDER_DATABASE_URL",
    projectId: "PLACEHOLDER_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ========================================
// CONSTANTS
// ========================================

const DEFAULT_CREATOR_KEY = "BeforeRoboticsGame";

const PHASES = [
    "SETUP",
    "UPKEEP",
    "INTERNAL_PRESSURE",
    "STATE_ACTIONS",
    "WAR",
    "REBELLION",
    "NATURAL_EVENTS",
    "CLEANUP"
];

const ACTION_CATEGORIES = {
    ECONOMIC: "Economic",
    MILITARY: "Military",
    DOMESTIC: "Domestic",
    DIPLOMATIC: "Diplomatic",
    EMERGENCY: "Emergency"
};

const CARD_SUITS = ['♠', '♣', '♥', '♦'];
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ========================================
// STATE MANAGEMENT
// ========================================

let currentGameCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let isHost = false;
let gameDataCache = null;
let heartbeatInterval = null;
let gameListener = null;

// ========================================
// UTILITY FUNCTIONS
// ========================================

function generateGameCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function sanitizeName(name) {
    return name.trim().substring(0, 20).replace(/[<>]/g, '');
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showStatus(elementId, message, type = 'info') {
    const statusEl = document.getElementById(elementId);
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

function clearStatus(elementId) {
    const statusEl = document.getElementById(elementId);
    statusEl.textContent = '';
    statusEl.className = 'status';
}

// ========================================
// DECK & CARD FUNCTIONS
// ========================================

function createDeck() {
    const deck = [];
    const suits = [
        { symbol: '♠', color: 'black' },
        { symbol: '♣', color: 'black' },
        { symbol: '♥', color: 'red' },
        { symbol: '♦', color: 'red' }
    ];
    
    suits.forEach(suit => {
        CARD_RANKS.forEach(rank => {
            let value;
            if (rank === 'A') value = 1;
            else if (['J', 'Q', 'K'].includes(rank)) value = 10;
            else value = parseInt(rank);
            
            deck.push({
                suit: suit.symbol,
                rank: rank,
                value: value,
                color: suit.color
            });
        });
    });
    
    return deck;
}

function shuffleDeck(deck, seed) {
    // Deterministic shuffle using seed
    const rng = seededRandom(seed);
    const shuffled = [...deck];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };
}

function calculateCardValue(card) {
    return card.value;
}

function calculateEconomy(hand) {
    return hand.filter(c => c.color === 'red').reduce((sum, c) => sum + c.value, 0);
}

function calculateMilitary(hand) {
    return hand.filter(c => c.color === 'black').reduce((sum, c) => sum + c.value, 0);
}

// ========================================
// GAME CALCULATIONS
// ========================================

function calculateMorale(food, luxury) {
    return Math.floor((luxury + food) / 2);
}

function calculatePopulation(luxury, food, morale, military) {
    if (food === 0) return military;
    const base = Math.floor((luxury * Math.sqrt(food)) / (morale / 10 + 1));
    return base + military;
}

function calculatePopulationPressure(population) {
    if (population >= 100) return 10;
    if (population >= 75) return 7;
    if (population >= 50) return 4;
    if (population >= 30) return 2;
    return 0;
}

function calculateFoodStress(food, population) {
    if (food < population * 4) return 10;
    if (food < population * 2) return 5;
    return 0;
}

// ========================================
// PLAYER DATA STRUCTURE
// ========================================

function createPlayerData(name) {
    const deck = createDeck();
    const seed = Date.now() + Math.random();
    const shuffledDeck = shuffleDeck(deck, seed);
    
    // Draw initial 4 cards
    const hand = shuffledDeck.splice(0, 4);
    
    return {
        name: sanitizeName(name),
        stats: {
            unrest: 0,
            economy: calculateEconomy(hand),
            military: calculateMilitary(hand),
            food: 0,
            luxury: 0,
            morale: 0,
            population: 0,
            farms: 0
        },
        hand: hand,
        deck: shuffledDeck,
        emergencyCards: [
            { id: 'ec1', type: 'hidden', revealed: false },
            { id: 'ec2', type: 'hidden', revealed: false }
        ],
        committedTroops: {
            frontline: [],
            garrison: [],
            reserve: []
        },
        actionsThisRound: {
            count: 0,
            categories: []
        },
        trades: [],
        lastSeen: serverTimestamp(),
        connected: true
    };
}

// ========================================
// GAME DATA STRUCTURE
// ========================================

function createGameData(hostId, hostName) {
    return {
        phase: "SETUP",
        locked: false,
        hostId: hostId,
        round: 0,
        turnOrder: [hostId],
        currentPlayerIndex: 0,
        warTracks: {},
        rebellions: {},
        occupations: {},
        sieges: {},
        naturalEventsEnabled: false,
        createdAt: serverTimestamp(),
        players: {
            [hostId]: createPlayerData(hostName)
        }
    };
}

// ========================================
// LOBBY FUNCTIONS
// ========================================

async function createGame() {
    const creatorKey = document.getElementById('creator-key').value;
    const hostName = document.getElementById('host-name').value;
    
    if (creatorKey !== DEFAULT_CREATOR_KEY) {
        showStatus('lobby-status', 'Invalid creator key', 'error');
        return;
    }
    
    if (!hostName || hostName.trim().length === 0) {
        showStatus('lobby-status', 'Please enter your name', 'error');
        return;
    }
    
    try {
        currentGameCode = generateGameCode();
        currentPlayerId = generatePlayerId();
        currentPlayerName = sanitizeName(hostName);
        isHost = true;
        
        const gameData = createGameData(currentPlayerId, currentPlayerName);
        await set(ref(db, `games/${currentGameCode}`), gameData);
        
        // Save to localStorage
        localStorage.setItem('civ_gameCode', currentGameCode);
        localStorage.setItem('civ_playerId', currentPlayerId);
        localStorage.setItem('civ_playerName', currentPlayerName);
        
        startHeartbeat();
        listenToGame();
        showScreen('waiting-room');
        updateWaitingRoom();
    } catch (error) {
        console.error('Error creating game:', error);
        showStatus('lobby-status', 'Failed to create game', 'error');
    }
}

async function joinGame() {
    const gameCode = document.getElementById('game-code').value.toUpperCase();
    const playerName = document.getElementById('player-name').value;
    
    if (!gameCode || gameCode.length !== 5) {
        showStatus('lobby-status', 'Please enter a valid 5-character game code', 'error');
        return;
    }
    
    if (!playerName || playerName.trim().length === 0) {
        showStatus('lobby-status', 'Please enter your name', 'error');
        return;
    }
    
    try {
        const gameRef = ref(db, `games/${gameCode}`);
        const snapshot = await get(gameRef);
        
        if (!snapshot.exists()) {
            showStatus('lobby-status', 'Game not found', 'error');
            return;
        }
        
        const gameData = snapshot.val();
        
        if (gameData.locked) {
            showStatus('lobby-status', 'Game has already started', 'error');
            return;
        }
        
        currentGameCode = gameCode;
        currentPlayerId = generatePlayerId();
        currentPlayerName = sanitizeName(playerName);
        isHost = false;
        
        // Add player to game
        const playerData = createPlayerData(currentPlayerName);
        await set(ref(db, `games/${gameCode}/players/${currentPlayerId}`), playerData);
        
        // Add to turn order
        const turnOrder = gameData.turnOrder || [];
        turnOrder.push(currentPlayerId);
        await set(ref(db, `games/${gameCode}/turnOrder`), turnOrder);
        
        // Save to localStorage
        localStorage.setItem('civ_gameCode', currentGameCode);
        localStorage.setItem('civ_playerId', currentPlayerId);
        localStorage.setItem('civ_playerName', currentPlayerName);
        
        startHeartbeat();
        listenToGame();
        showScreen('waiting-room');
        updateWaitingRoom();
    } catch (error) {
        console.error('Error joining game:', error);
        showStatus('lobby-status', 'Failed to join game', 'error');
    }
}

function updateWaitingRoom() {
    document.getElementById('display-code').textContent = currentGameCode;
    
    if (isHost) {
        document.getElementById('start-game-btn').classList.remove('hidden');
    }
}

async function startGame() {
    if (!isHost) return;
    
    const naturalEventsEnabled = document.getElementById('natural-events-toggle')?.checked || false;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}`), (game) => {
            if (!game) return game;
            
            game.locked = true;
            game.phase = "UPKEEP";
            game.round = 1;
            game.naturalEventsEnabled = naturalEventsEnabled;
            
            return game;
        });
        
        showScreen('game-screen');
    } catch (error) {
        console.error('Error starting game:', error);
        showStatus('waiting-status', 'Failed to start game', 'error');
    }
}

function leaveLobby() {
    if (gameListener) {
        off(gameListener);
    }
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    // Remove player from game if still in lobby
    if (currentGameCode && currentPlayerId && gameDataCache && !gameDataCache.locked) {
        remove(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`));
    }
    
    currentGameCode = null;
    currentPlayerId = null;
    isHost = false;
    
    localStorage.removeItem('civ_gameCode');
    localStorage.removeItem('civ_playerId');
    
    showScreen('lobby-screen');
}

// ========================================
// GAME LISTENER
// ========================================

function listenToGame() {
    if (!currentGameCode) return;
    
    const gameRef = ref(db, `games/${currentGameCode}`);
    gameListener = gameRef;
    
    onValue(gameRef, (snapshot) => {
        if (!snapshot.exists()) {
            showStatus('waiting-status', 'Game no longer exists', 'error');
            leaveLobby();
            return;
        }
        
        gameDataCache = snapshot.val();
        
        if (gameDataCache.locked && document.getElementById('waiting-room').classList.contains('active')) {
            showScreen('game-screen');
        }
        
        if (document.getElementById('waiting-room').classList.contains('active')) {
            renderWaitingRoom(gameDataCache);
        } else if (document.getElementById('game-screen').classList.contains('active')) {
            renderGameScreen(gameDataCache);
        }
    });
}

// ========================================
// RENDERING FUNCTIONS
// ========================================

function renderWaitingRoom(game) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    Object.entries(game.players).forEach(([pid, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        const isCurrentPlayer = pid === currentPlayerId;
        const isGameHost = pid === game.hostId;
        
        playerDiv.innerHTML = `
            <div>
                <span class="player-name">${player.name}</span>
                ${isCurrentPlayer ? ' (You)' : ''}
            </div>
            <div>
                ${isGameHost ? '<span class="player-badge">HOST</span>' : ''}
                <span class="player-status">${player.connected ? '🟢' : '🔴'}</span>
            </div>
        `;
        
        playersList.appendChild(playerDiv);
    });
}

function renderGameScreen(game) {
    // Update phase bar
    document.getElementById('current-phase').textContent = game.phase;
    document.getElementById('round-info').textContent = `Round ${game.round}`;
    
    // Show/hide host controls
    if (isHost) {
        document.body.classList.add('is-host');
    }
    
    // Render player dashboard
    renderPlayerStats(game);
    
    // Render hand
    renderHand(game);
    
    // Render emergency cards
    renderEmergencyCards(game);
    
    // Render other players
    renderOtherPlayers(game);
    
    // Render war view
    renderWarView(game);
    
    // Render rebellion view
    renderRebellionView(game);
    
    // Render diplomacy panel
    renderDiplomacyPanel(game);
    
    // Render event log
    renderEventLog(game);
    
    // Render actions
    renderActions(game);
}

function renderPlayerStats(game) {
    const player = game.players[currentPlayerId];
    if (!player) return;
    
    const stats = player.stats;
    const statsGrid = document.getElementById('player-stats');
    
    statsGrid.innerHTML = `
        <div class="stat-item">
            <div class="stat-label">Unrest</div>
            <div class="stat-value ${stats.unrest >= 75 ? 'danger' : stats.unrest >= 50 ? 'warning' : ''}">${stats.unrest}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Economy</div>
            <div class="stat-value">${stats.economy}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Military</div>
            <div class="stat-value">${stats.military}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Food</div>
            <div class="stat-value">${stats.food}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Luxury</div>
            <div class="stat-value">${stats.luxury}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Morale</div>
            <div class="stat-value">${stats.morale}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Population</div>
            <div class="stat-value">${stats.population}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Farms</div>
            <div class="stat-value">${stats.farms}</div>
        </div>
    `;
}

function renderHand(game) {
    const player = game.players[currentPlayerId];
    if (!player) return;
    
    const handViewer = document.getElementById('hand-viewer');
    const handCount = document.getElementById('hand-count');
    
    handCount.textContent = player.hand.length;
    handViewer.innerHTML = '';
    
    player.hand.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card-item ${card.color}`;
        cardDiv.innerHTML = `
            <div class="card-suit">${card.suit}</div>
            <div class="card-value">${card.rank}</div>
            <div class="card-points">${card.value}</div>
        `;
        cardDiv.onclick = () => selectCard(index);
        handViewer.appendChild(cardDiv);
    });
}

function renderEmergencyCards(game) {
    const player = game.players[currentPlayerId];
    if (!player) return;
    
    const container = document.getElementById('emergency-cards');
    container.innerHTML = '';
    
    player.emergencyCards.forEach((ec, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `emergency-card ${ec.revealed ? 'revealed' : 'face-down'}`;
        
        if (ec.revealed) {
            cardDiv.innerHTML = `<div>${ec.type}</div>`;
        }
        
        cardDiv.onclick = () => useEmergencyCard(index);
        container.appendChild(cardDiv);
    });
}

function renderOtherPlayers(game) {
    const container = document.getElementById('other-players');
    container.innerHTML = '';
    
    Object.entries(game.players).forEach(([pid, player]) => {
        if (pid === currentPlayerId) return;
        
        const playerDiv = document.createElement('div');
        playerDiv.className = 'other-player';
        
        playerDiv.innerHTML = `
            <div class="other-player-name">${player.name} ${player.connected ? '🟢' : '🔴'}</div>
            <div class="other-player-stats">
                <div>Unrest: ${player.stats.unrest}</div>
                <div>Economy: ${player.stats.economy}</div>
                <div>Military: ${player.stats.military}</div>
                <div>Food: ${player.stats.food}</div>
                <div>Population: ${player.stats.population}</div>
                <div>Cards: ${player.hand.length}</div>
            </div>
        `;
        
        container.appendChild(playerDiv);
    });
}

function renderWarView(game) {
    const container = document.getElementById('war-view');
    
    if (!game.warTracks || Object.keys(game.warTracks).length === 0) {
        container.innerHTML = '<p>No active wars</p>';
        return;
    }
    
    container.innerHTML = '';
    Object.entries(game.warTracks).forEach(([warId, war]) => {
        const warDiv = document.createElement('div');
        warDiv.className = 'war-item';
        
        const player1 = game.players[war.attacker]?.name || 'Unknown';
        const player2 = game.players[war.defender]?.name || 'Unknown';
        
        warDiv.innerHTML = `
            <div><strong>${player1}</strong> vs <strong>${player2}</strong></div>
            <div class="war-track">
                <span>0</span>
                <div class="war-track-bar">
                    <div class="war-track-progress" style="width: ${(war.track / 7) * 100}%"></div>
                </div>
                <span>7</span>
            </div>
            <div>Stage: ${getWarStage(war.track)}</div>
        `;
        
        container.appendChild(warDiv);
    });
}

function getWarStage(track) {
    if (track >= 7) return 'Civilization Collapse';
    if (track >= 5) return 'Capital Threatened';
    if (track >= 3) return 'Siege State';
    return 'Border Conflict';
}

function renderRebellionView(game) {
    const container = document.getElementById('rebellion-view');
    
    if (!game.rebellions || Object.keys(game.rebellions).length === 0) {
        container.innerHTML = '<p>No active rebellions</p>';
        return;
    }
    
    container.innerHTML = '';
    Object.entries(game.rebellions).forEach(([pid, rebellion]) => {
        const playerName = game.players[pid]?.name || 'Unknown';
        
        const rebellionDiv = document.createElement('div');
        rebellionDiv.className = 'rebellion-item';
        
        rebellionDiv.innerHTML = `
            <div><strong>${playerName}</strong> - ${getRebellionStage(rebellion.track)}</div>
            <div>Track: ${rebellion.track}</div>
        `;
        
        container.appendChild(rebellionDiv);
    });
}

function getRebellionStage(track) {
    if (track >= 6) return 'Regime Collapse';
    if (track >= 4) return 'Armed Uprising';
    return 'Civil Disorder';
}

function renderDiplomacyPanel(game) {
    const container = document.getElementById('diplomacy-panel');
    
    container.innerHTML = `
        <button class="btn btn-secondary" onclick="initiateTrade()">Initiate Trade</button>
        <button class="btn btn-secondary" onclick="foreignInterference()">Foreign Interference</button>
    `;
}

function renderEventLog(game) {
    const container = document.getElementById('event-log');
    
    if (!game.eventLog || game.eventLog.length === 0) {
        container.innerHTML = '<p style="color: var(--text-medium);">No events yet</p>';
        return;
    }
    
    container.innerHTML = '';
    
    // Show most recent events first
    const recentEvents = [...game.eventLog].reverse().slice(0, 5);
    
    recentEvents.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.style.cssText = 'padding: 8px; background: var(--bg-dark); border-radius: 4px; margin-bottom: 4px; font-size: 0.9rem;';
        
        const playerName = game.players[event.affectedPlayer]?.name || 'Unknown';
        
        eventDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <strong style="color: var(--danger-color);">${event.type}</strong>
                <span style="color: var(--text-medium);">Round ${event.round}</span>
            </div>
            <div>${playerName}: ${event.effect}</div>
        `;
        
        container.appendChild(eventDiv);
    });
}

function renderActions(game) {
    const player = game.players[currentPlayerId];
    if (!player) return;
    
    const actionsInfo = document.getElementById('actions-info');
    const actionsButtons = document.getElementById('actions-buttons');
    
    const maxActions = 2 - (player.stats.unrest >= 30 ? 1 : 0);
    const remainingActions = maxActions - player.actionsThisRound.count;
    
    actionsInfo.innerHTML = `
        <div>Actions Remaining: ${remainingActions}/${maxActions}</div>
        <div>Phase: ${game.phase}</div>
    `;
    
    const canAct = game.phase === 'STATE_ACTIONS' && remainingActions > 0;
    const isCleanup = game.phase === 'CLEANUP';
    
    actionsButtons.innerHTML = `
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="buyCard()">Buy Card (2 Econ)</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="buyFarm()">Buy Farm (5 Econ)</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="buyLuxury()">Buy Luxury (1 Econ)</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="reduceUnrest()">Reduce Unrest</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="declareWar()">Declare War</button>
        ${isCleanup && player.hand.length > 10 ? '<button class="btn btn-danger" onclick="discardSelected()">Discard Selected</button>' : ''}
    `;
}

// ========================================
// GAME ACTIONS
// ========================================

async function nextPhase() {
    if (!isHost) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}`), (game) => {
            if (!game) return game;
            
            const currentIndex = PHASES.indexOf(game.phase);
            let nextIndex = (currentIndex + 1) % PHASES.length;
            
            // Skip NATURAL_EVENTS if not enabled
            if (PHASES[nextIndex] === 'NATURAL_EVENTS' && !game.naturalEventsEnabled) {
                nextIndex = (nextIndex + 1) % PHASES.length;
            }
            
            game.phase = PHASES[nextIndex];
            
            // If we're back to UPKEEP, increment round
            if (game.phase === 'UPKEEP') {
                game.round += 1;
                
                // Process upkeep for all players
                Object.keys(game.players).forEach(pid => {
                    processUpkeep(game, pid);
                });
            }
            
            // Reset actions at start of STATE_ACTIONS phase
            if (game.phase === 'STATE_ACTIONS') {
                Object.keys(game.players).forEach(pid => {
                    game.players[pid].actionsThisRound = {
                        count: 0,
                        categories: []
                    };
                });
            }
            
            // Process natural events if that's the current phase
            if (game.phase === 'NATURAL_EVENTS' && game.naturalEventsEnabled) {
                processNaturalEvent(game);
            }
            
            return game;
        });
    } catch (error) {
        console.error('Error advancing phase:', error);
    }
}

// ========================================
// NATURAL EVENTS
// ========================================

function processNaturalEvent(game) {
    // Roll to select affected player
    const playerIds = Object.keys(game.players).filter(pid => !game.players[pid].collapsed);
    if (playerIds.length === 0) return;
    
    const affectedIndex = Math.floor(Math.random() * playerIds.length);
    const affectedPlayerId = playerIds[affectedIndex];
    const player = game.players[affectedPlayerId];
    
    // Roll for event type (1-6 maps to 4 types)
    const eventRoll = Math.floor(Math.random() * 6) + 1;
    let eventType, eventEffect;
    
    if (eventRoll <= 2) {
        // Drought - halve farm production next round
        eventType = 'Drought';
        eventEffect = 'Farm production halved next round';
        if (!player.effects) player.effects = [];
        player.effects.push({ type: 'drought', duration: 1 });
    } else if (eventRoll <= 4) {
        // Plague - reduce morale
        eventType = 'Plague';
        eventEffect = 'Morale reduced by 5';
        player.stats.morale = Math.max(0, player.stats.morale - 5);
    } else if (eventRoll === 5) {
        // Earthquake - lose farm
        eventType = 'Earthquake';
        eventEffect = 'Lost 1 farm';
        player.stats.farms = Math.max(0, player.stats.farms - 1);
    } else {
        // Flood - lose food
        eventType = 'Flood';
        eventEffect = 'Lost 10 food';
        player.stats.food = Math.max(0, player.stats.food - 10);
    }
    
    // Log the event
    if (!game.eventLog) game.eventLog = [];
    game.eventLog.push({
        round: game.round,
        type: eventType,
        affectedPlayer: affectedPlayerId,
        effect: eventEffect,
        timestamp: Date.now()
    });
    
    // Keep only last 10 events
    if (game.eventLog.length > 10) {
        game.eventLog = game.eventLog.slice(-10);
    }
}

function processUpkeep(game, playerId) {
    const player = game.players[playerId];
    if (!player) return;
    
    // Food production
    const isSieged = game.sieges && game.sieges[playerId];
    const hasDrought = player.effects && player.effects.some(e => e.type === 'drought');
    const farmMultiplier = isSieged ? 0 : (hasDrought ? 10 : 20); // Half production if drought
    player.stats.food += player.stats.farms * farmMultiplier;
    
    // Process and remove expired effects
    if (player.effects) {
        player.effects = player.effects.filter(effect => {
            effect.duration = (effect.duration || 1) - 1;
            return effect.duration > 0;
        });
    }
    
    // Morale calculation
    player.stats.morale = calculateMorale(player.stats.food, player.stats.luxury);
    
    // Population calculation
    player.stats.population = calculatePopulation(
        player.stats.luxury,
        player.stats.food,
        player.stats.morale,
        player.stats.military
    );
    
    // Population pressure
    const pressureUnrest = calculatePopulationPressure(player.stats.population);
    player.stats.unrest += pressureUnrest;
    
    // Food stress
    const foodStress = calculateFoodStress(player.stats.food, player.stats.population);
    player.stats.unrest += foodStress;
    
    // Siege pressure
    if (isSieged) {
        player.stats.unrest += 8;
    }
    
    // Economic collapse pressure
    if (player.stats.economy === 0) {
        player.stats.unrest += 10;
    }
    
    // Check for rebellion
    if (player.stats.unrest >= 100 && !game.rebellions[playerId]) {
        game.rebellions[playerId] = {
            track: 2,
            stage: 1
        };
    }
}

async function buyCard() {
    if (!currentGameCode || !currentPlayerId) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), (player) => {
            if (!player) return player;
            
            if (player.stats.economy < 2) return player;
            if (player.hand.length >= 10) return player;
            if (player.actionsThisRound.count >= 2) return player;
            if (player.actionsThisRound.categories.includes('Economic')) return player;
            
            // Draw card from deck
            if (player.deck && player.deck.length > 0) {
                const card = player.deck.shift();
                player.hand.push(card);
                
                // Recalculate economy and military
                player.stats.economy = calculateEconomy(player.hand);
                player.stats.military = calculateMilitary(player.hand);
                
                // Deduct cost (recalculated above, so deduct 2)
                player.stats.economy -= 2;
                
                player.actionsThisRound.count += 1;
                player.actionsThisRound.categories.push('Economic');
            }
            
            return player;
        });
    } catch (error) {
        console.error('Error buying card:', error);
    }
}

async function buyFarm() {
    if (!currentGameCode || !currentPlayerId) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), (player) => {
            if (!player) return player;
            
            if (player.stats.economy < 5) return player;
            if (player.actionsThisRound.count >= 2) return player;
            if (player.actionsThisRound.categories.includes('Economic')) return player;
            
            player.stats.farms += 1;
            player.stats.economy -= 5;
            
            player.actionsThisRound.count += 1;
            player.actionsThisRound.categories.push('Economic');
            
            return player;
        });
    } catch (error) {
        console.error('Error buying farm:', error);
    }
}

async function buyLuxury() {
    if (!currentGameCode || !currentPlayerId) return;
    
    const amount = prompt('How much luxury to buy? (1 economy per luxury)');
    const luxuryAmount = parseInt(amount);
    
    if (isNaN(luxuryAmount) || luxuryAmount <= 0) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), (player) => {
            if (!player) return player;
            
            if (player.stats.economy < luxuryAmount) return player;
            if (player.actionsThisRound.count >= 2) return player;
            if (player.actionsThisRound.categories.includes('Economic')) return player;
            
            // Roll dice for luxury
            let totalLuxury = 0;
            for (let i = 0; i < luxuryAmount; i++) {
                totalLuxury += Math.floor(Math.random() * 6) + 1;
            }
            
            player.stats.luxury += totalLuxury;
            player.stats.economy -= luxuryAmount;
            
            player.actionsThisRound.count += 1;
            player.actionsThisRound.categories.push('Economic');
            
            return player;
        });
    } catch (error) {
        console.error('Error buying luxury:', error);
    }
}

async function reduceUnrest() {
    if (!currentGameCode || !currentPlayerId) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), (player) => {
            if (!player) return player;
            
            if (player.actionsThisRound.count >= 2) return player;
            if (player.actionsThisRound.categories.includes('Domestic')) return player;
            
            player.stats.unrest = Math.max(0, player.stats.unrest - 10);
            
            player.actionsThisRound.count += 1;
            player.actionsThisRound.categories.push('Domestic');
            
            return player;
        });
    } catch (error) {
        console.error('Error reducing unrest:', error);
    }
}

// ========================================
// WAR MECHANICS
// ========================================

async function declareWar() {
    if (!currentGameCode || !currentPlayerId) return;
    
    // Get list of other players
    const otherPlayers = Object.entries(gameDataCache.players)
        .filter(([pid]) => pid !== currentPlayerId)
        .map(([pid, player]) => ({ id: pid, name: player.name }));
    
    if (otherPlayers.length === 0) {
        alert('No other players to declare war on');
        return;
    }
    
    // Simple selection (in production, use a modal)
    const targetName = prompt('Declare war on: ' + otherPlayers.map(p => p.name).join(', '));
    const target = otherPlayers.find(p => p.name === targetName);
    
    if (!target) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}`), (game) => {
            if (!game) return game;
            
            const player = game.players[currentPlayerId];
            if (!player) return game;
            
            if (player.actionsThisRound.count >= 2) return game;
            if (player.actionsThisRound.categories.includes('Military')) return game;
            
            const warId = `war_${Date.now()}`;
            if (!game.warTracks) game.warTracks = {};
            
            game.warTracks[warId] = {
                attacker: currentPlayerId,
                defender: target.id,
                track: 0,
                stage: 'Border Conflict',
                created: Date.now()
            };
            
            player.actionsThisRound.count += 1;
            player.actionsThisRound.categories.push('Military');
            
            return game;
        });
    } catch (error) {
        console.error('Error declaring war:', error);
    }
}

async function progressWar(warId) {
    if (!isHost) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/warTracks/${warId}`), (war) => {
            if (!war) return war;
            
            // Roll dice for both sides
            const attackerDice = rollDice(3);
            const defenderDice = rollDice(3);
            
            const attackerTotal = attackerDice.reduce((a, b) => a + b, 0);
            const defenderTotal = defenderDice.reduce((a, b) => a + b, 0);
            
            // Attacker wins ties
            if (attackerTotal >= defenderTotal) {
                war.track += 1;
            } else {
                war.track = Math.max(0, war.track - 1);
            }
            
            // Update stage
            if (war.track >= 7) war.stage = 'Civilization Collapse';
            else if (war.track >= 5) war.stage = 'Capital Threatened';
            else if (war.track >= 3) war.stage = 'Siege State';
            else war.stage = 'Border Conflict';
            
            war.lastBattle = {
                attackerDice,
                defenderDice,
                winner: attackerTotal >= defenderTotal ? 'attacker' : 'defender'
            };
            
            return war;
        });
    } catch (error) {
        console.error('Error progressing war:', error);
    }
}

// ========================================
// REBELLION MECHANICS
// ========================================

async function processRebellion(playerId) {
    if (!isHost) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}`), (game) => {
            if (!game) return game;
            
            const rebellion = game.rebellions[playerId];
            const player = game.players[playerId];
            
            if (!rebellion || !player) return game;
            
            // Calculate rebellion dice
            let rebellionDice = 2;
            if (player.stats.population >= 75) rebellionDice++;
            if (game.sieges && game.sieges[playerId]) rebellionDice++;
            if (player.stats.food < player.stats.population * 2) rebellionDice++;
            
            // Calculate government dice
            let governmentDice = 2;
            governmentDice += Math.floor(player.stats.military / 20);
            
            // Roll dice
            const rebellionRolls = rollDice(rebellionDice);
            const governmentRolls = rollDice(governmentDice);
            
            const rebellionTotal = rebellionRolls.reduce((a, b) => a + b, 0);
            const governmentTotal = governmentRolls.reduce((a, b) => a + b, 0);
            
            // Update track based on stage
            if (rebellion.stage === 1) {
                // Civil Disorder
                if (rebellionTotal > governmentTotal) {
                    rebellion.track += 1;
                } else {
                    rebellion.track -= 1;
                }
            } else if (rebellion.stage === 2) {
                // Armed Uprising
                if (rebellionTotal > governmentTotal) {
                    rebellion.track += 2;
                } else {
                    rebellion.track -= 1;
                }
            } else if (rebellion.stage === 3) {
                // Regime Collapse
                if (rebellionTotal > governmentTotal) {
                    rebellion.track += 2;
                } else {
                    rebellion.track -= 2;
                }
            }
            
            // Check if rebellion ended
            if (rebellion.track <= 0) {
                delete game.rebellions[playerId];
                player.stats.unrest = Math.max(0, player.stats.unrest - 30);
            } else if (rebellion.track >= 6) {
                // Civilization collapsed
                player.collapsed = true;
            } else {
                // Update stage
                if (rebellion.track >= 4) rebellion.stage = 3;
                else if (rebellion.track >= 2) rebellion.stage = 2;
                else rebellion.stage = 1;
            }
            
            rebellion.lastRoll = {
                rebellionRolls,
                governmentRolls,
                rebellionTotal,
                governmentTotal
            };
            
            return game;
        });
    } catch (error) {
        console.error('Error processing rebellion:', error);
    }
}

// ========================================
// DICE ROLLER
// ========================================

function rollDice(count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(Math.floor(Math.random() * 6) + 1);
    }
    return results;
}

function showDiceModal(count, callback) {
    const modal = document.getElementById('dice-modal');
    const overlay = document.getElementById('modal-overlay');
    const resultDiv = document.getElementById('dice-result');
    const rollBtn = document.getElementById('roll-dice-btn');
    const closeBtn = document.getElementById('close-dice-btn');
    
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    resultDiv.innerHTML = '<p>Click Roll to roll dice</p>';
    
    rollBtn.onclick = () => {
        const results = rollDice(count);
        const total = results.reduce((a, b) => a + b, 0);
        
        resultDiv.innerHTML = `
            <div>
                ${results.map(r => `<span class="dice">${r}</span>`).join('')}
            </div>
            <div style="margin-top: 10px;">Total: ${total}</div>
        `;
        
        if (callback) callback(results);
    };
    
    closeBtn.onclick = () => {
        modal.classList.add('hidden');
        overlay.classList.add('hidden');
    };
}

// ========================================
// CARD DISCARD (CLEANUP PHASE)
// ========================================

async function discardCard(cardIndex) {
    if (!currentGameCode || !currentPlayerId) return;
    if (gameDataCache.phase !== 'CLEANUP') return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), (player) => {
            if (!player) return player;
            
            if (cardIndex < 0 || cardIndex >= player.hand.length) return player;
            
            player.hand.splice(cardIndex, 1);
            
            // Recalculate economy and military
            player.stats.economy = calculateEconomy(player.hand);
            player.stats.military = calculateMilitary(player.hand);
            
            return player;
        });
    } catch (error) {
        console.error('Error discarding card:', error);
    }
}

// ========================================
// FOREIGN INTERFERENCE
// ========================================

async function foreignInterference() {
    if (!currentGameCode || !currentPlayerId) return;
    
    const player = gameDataCache.players[currentPlayerId];
    if (!player) return;
    
    // Get vulnerable players (75+ unrest)
    const vulnerablePlayers = Object.entries(gameDataCache.players)
        .filter(([pid, p]) => pid !== currentPlayerId && p.stats.unrest >= 75)
        .map(([pid, p]) => ({ id: pid, name: p.name }));
    
    if (vulnerablePlayers.length === 0) {
        alert('No vulnerable civilizations (need 75+ unrest)');
        return;
    }
    
    const targetName = prompt('Target: ' + vulnerablePlayers.map(p => p.name).join(', '));
    const target = vulnerablePlayers.find(p => p.name === targetName);
    
    if (!target) return;
    
    const amount = parseInt(prompt('How much economy to spend? (1 economy = +1 unrest, max 10)'));
    if (isNaN(amount) || amount <= 0 || amount > 10) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}`), (game) => {
            if (!game) return game;
            
            const sourcePlayer = game.players[currentPlayerId];
            const targetPlayer = game.players[target.id];
            
            if (!sourcePlayer || !targetPlayer) return game;
            if (sourcePlayer.stats.economy < amount) return game;
            if (sourcePlayer.actionsThisRound.categories.includes('Diplomatic')) return game;
            
            sourcePlayer.stats.economy -= amount;
            targetPlayer.stats.unrest += amount;
            
            sourcePlayer.actionsThisRound.count += 1;
            sourcePlayer.actionsThisRound.categories.push('Diplomatic');
            
            return game;
        });
    } catch (error) {
        console.error('Error with foreign interference:', error);
    }
}

// ========================================
// TRADING
// ========================================

async function initiateTrade() {
    if (!currentGameCode || !currentPlayerId) return;
    
    const player = gameDataCache.players[currentPlayerId];
    if (!player) return;
    
    if (player.stats.unrest >= 50) {
        alert('Cannot trade with 50+ unrest');
        return;
    }
    
    if (player.actionsThisRound.categories.includes('Diplomatic')) {
        alert('Already used diplomatic action this round');
        return;
    }
    
    alert('Trade system: Select another player and propose a trade\n\nAvailable: Economy, Food, Luxury\nNote: Breaking a deal adds +10 Unrest');
}

// ========================================
// EMERGENCY CARDS
// ========================================

async function useEmergencyCard(index) {
    if (!currentGameCode || !currentPlayerId) return;
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), (player) => {
            if (!player) return player;
            
            if (index < 0 || index >= player.emergencyCards.length) return player;
            
            const card = player.emergencyCards[index];
            if (card.revealed) return player;
            
            // Reveal the card
            card.revealed = true;
            card.type = Math.random() > 0.5 ? 'red' : 'black';
            
            // Apply effects based on context
            if (player.stats.economy === 0) {
                // Economic collapse scenario
                if (card.type === 'black') {
                    player.stats.unrest += 30;
                }
            }
            
            player.actionsThisRound.count += 1;
            player.actionsThisRound.categories.push('Emergency');
            
            return player;
        });
    } catch (error) {
        console.error('Error using emergency card:', error);
    }
}

// ========================================
// CARD SELECTION
// ========================================

let selectedCards = [];

function selectCard(index) {
    if (gameDataCache.phase === 'CLEANUP') {
        // In cleanup phase, select cards to discard
        const cardDiv = document.querySelectorAll('.card-item')[index];
        if (!cardDiv) return;
        
        if (selectedCards.includes(index)) {
            selectedCards = selectedCards.filter(i => i !== index);
            cardDiv.style.opacity = '1';
        } else {
            selectedCards.push(index);
            cardDiv.style.opacity = '0.5';
        }
    }
}

async function discardSelected() {
    for (const index of selectedCards.sort((a, b) => b - a)) {
        await discardCard(index);
    }
    selectedCards = [];
}

// ========================================
// HEARTBEAT & CONNECTION
// ========================================

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(() => {
        if (currentGameCode && currentPlayerId) {
            update(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), {
                lastSeen: serverTimestamp(),
                connected: true
            });
        }
    }, 5000);
}

// ========================================
// RECONNECTION
// ========================================

async function tryReconnect() {
    const savedCode = localStorage.getItem('civ_gameCode');
    const savedPlayerId = localStorage.getItem('civ_playerId');
    const savedPlayerName = localStorage.getItem('civ_playerName');
    
    if (!savedCode || !savedPlayerId) return false;
    
    try {
        const gameRef = ref(db, `games/${savedCode}`);
        const snapshot = await get(gameRef);
        
        if (!snapshot.exists()) {
            localStorage.removeItem('civ_gameCode');
            localStorage.removeItem('civ_playerId');
            localStorage.removeItem('civ_playerName');
            return false;
        }
        
        const gameData = snapshot.val();
        
        if (gameData.players[savedPlayerId]) {
            currentGameCode = savedCode;
            currentPlayerId = savedPlayerId;
            currentPlayerName = savedPlayerName;
            isHost = gameData.hostId === savedPlayerId;
            
            // Update connection status
            await update(ref(db, `games/${savedCode}/players/${savedPlayerId}`), {
                lastSeen: serverTimestamp(),
                connected: true
            });
            
            startHeartbeat();
            listenToGame();
            
            if (gameData.locked) {
                showScreen('game-screen');
            } else {
                showScreen('waiting-room');
                updateWaitingRoom();
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Reconnection failed:', error);
        return false;
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

document.getElementById('create-game-btn').addEventListener('click', createGame);
document.getElementById('join-game-btn').addEventListener('click', joinGame);
document.getElementById('start-game-btn').addEventListener('click', startGame);
document.getElementById('leave-lobby-btn').addEventListener('click', leaveLobby);
document.getElementById('next-phase-btn').addEventListener('click', nextPhase);

// Make functions available globally
window.buyCard = buyCard;
window.buyFarm = buyFarm;
window.buyLuxury = buyLuxury;
window.reduceUnrest = reduceUnrest;
window.selectCard = selectCard;
window.useEmergencyCard = useEmergencyCard;
window.initiateTrade = initiateTrade;
window.foreignInterference = foreignInterference;
window.declareWar = declareWar;
window.discardSelected = discardSelected;
window.showDiceModal = showDiceModal;
window.progressWar = progressWar;
window.processRebellion = processRebellion;

// ========================================
// INITIALIZATION
// ========================================

// Try to reconnect on load
tryReconnect().then(reconnected => {
    if (!reconnected) {
        showScreen('lobby-screen');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentGameCode && currentPlayerId) {
        update(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`), {
            connected: false
        });
    }
});
