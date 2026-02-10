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
    
    try {
        await runTransaction(ref(db, `games/${currentGameCode}`), (game) => {
            if (!game) return game;
            
            game.locked = true;
            game.phase = "UPKEEP";
            game.round = 1;
            
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
    
    actionsButtons.innerHTML = `
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="buyCard()">Buy Card (2 Econ)</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="buyFarm()">Buy Farm (5 Econ)</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="buyLuxury()">Buy Luxury (1 Econ)</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="reduceUnrest()">Reduce Unrest</button>
        <button class="btn btn-secondary" ${!canAct ? 'disabled' : ''} onclick="declareWar()">Declare War</button>
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
            
            return game;
        });
    } catch (error) {
        console.error('Error advancing phase:', error);
    }
}

function processUpkeep(game, playerId) {
    const player = game.players[playerId];
    if (!player) return;
    
    // Food production
    const isSieged = game.sieges && game.sieges[playerId];
    player.stats.food += player.stats.farms * (isSieged ? 0 : 20);
    
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
window.selectCard = function(index) { console.log('Card selected:', index); };
window.useEmergencyCard = function(index) { console.log('Emergency card used:', index); };
window.initiateTrade = function() { console.log('Trade initiated'); };
window.foreignInterference = function() { console.log('Foreign interference'); };
window.declareWar = function() { console.log('War declared'); };

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
