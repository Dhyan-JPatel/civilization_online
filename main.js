// ============================================================================
// Civilization Online - Complete Implementation (Phases 2-5)
// ============================================================================

// Firebase Modular SDK Imports (v9+)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  onValue, 
  update,
  runTransaction,
  serverTimestamp,
  onDisconnect
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ============================================================================
// Constants
// ============================================================================

const CREATOR_KEY = "BeforeRoboticsGame";
const GAME_CODE_LENGTH = 5;
const MAX_PLAYERS = 6;
const HAND_LIMIT = 10;
const FARM_FOOD_PRODUCTION = 20;

// Game phases in order
const PHASES = [
  'SETUP',
  'UPKEEP',
  'INTERNAL_PRESSURE',
  'STATE_ACTIONS',
  'WAR',
  'REBELLION',
  'NATURAL_EVENTS',
  'CLEANUP'
];

// Card values
const CARD_VALUES = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10
};

// Action costs
const COSTS = {
  CARD: 2,
  FARM: 5,
  LUXURY: 1
};

// ============================================================================
// Game Logic Helper Functions
// ============================================================================

// Generate a standard 52-card deck for a player
function generateDeck() {
  const suits = ['♥', '♦', '♣', '♠'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      const isRed = (suit === '♥' || suit === '♦');
      deck.push({
        rank: rank,
        suit: suit,
        type: isRed ? 'economy' : 'military',
        value: CARD_VALUES[rank],
        id: `${rank}${suit}`
      });
    }
  }
  
  return shuffleArray(deck);
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Calculate economy value from hand
function calculateEconomy(hand) {
  if (!hand) return 0;
  return hand.filter(card => card.type === 'economy').reduce((sum, card) => sum + card.value, 0);
}

// Calculate military value from hand
function calculateMilitary(hand) {
  if (!hand) return 0;
  return hand.filter(card => card.type === 'military').reduce((sum, card) => sum + card.value, 0);
}

// Calculate morale
function calculateMorale(luxury, food) {
  return luxury + food;
}

// Calculate population
function calculatePopulation(luxury, food, morale, military) {
  if (food === 0) return military;
  const moraleModifier = Math.max((morale / 10) + 1, 1); // Ensure positive modifier
  const basePopulation = Math.floor((luxury * Math.sqrt(food)) / moraleModifier);
  return basePopulation + military;
}

// Calculate population pressure unrest
function getPopulationPressureUnrest(population) {
  if (population >= 100) return 10;
  if (population >= 75) return 7;
  if (population >= 50) return 4;
  if (population >= 30) return 2;
  return 0;
}

// Virtual dice roll (1-6)
function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

// Roll multiple dice
function rollDice(count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie());
  }
  return results;
}

// ============================================================================
// Firebase Initialization
// ============================================================================

// Firebase configuration is loaded from firebase-config-loader.js
// Expected: window.__FIREBASE_CONFIG__ to be set before this script loads
// For development, you can modify firebase-config-loader.js directly
const firebaseConfig = window.__FIREBASE_CONFIG__ || {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://PLACEHOLDER_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "PLACEHOLDER_PROJECT_ID",
  storageBucket: "PLACEHOLDER_PROJECT_ID.appspot.com",
  messagingSenderId: "PLACEHOLDER_SENDER_ID",
  appId: "PLACEHOLDER_APP_ID"
};

let app;
let database;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  alert('Failed to connect to Firebase. Please check configuration.');
}

// ============================================================================
// State Management
// ============================================================================

let currentGameCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let isHost = false;
let gameListener = null;

// ============================================================================
// DOM Elements
// ============================================================================

const welcomeScreen = document.getElementById('welcomeScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const loadingScreen = document.getElementById('loadingScreen');
const gameScreen = document.getElementById('gameScreen');

const joinGameCodeInput = document.getElementById('joinGameCode');
const joinPlayerNameInput = document.getElementById('joinPlayerName');
const joinBtn = document.getElementById('joinBtn');

const creatorKeyInput = document.getElementById('creatorKey');
const createPlayerNameInput = document.getElementById('createPlayerName');
const naturalEventsToggle = document.getElementById('naturalEventsToggle');
const createBtn = document.getElementById('createBtn');

const displayGameCode = document.getElementById('displayGameCode');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const phaseDisplay = document.getElementById('phaseDisplay');
const roundDisplay = document.getElementById('roundDisplay');
const lockedStatus = document.getElementById('lockedStatus');
const playersList = document.getElementById('playersList');
const hostControls = document.getElementById('hostControls');
const startGameBtn = document.getElementById('startGameBtn');
const leaveGameBtn = document.getElementById('leaveGameBtn');

// Game screen elements
const gamePhase = document.getElementById('gamePhase');
const gameRound = document.getElementById('gameRound');
const victoryBanner = document.getElementById('victoryBanner');
const victoryMessage = document.getElementById('victoryMessage');
const playerDashboardName = document.getElementById('playerDashboardName');
const statUnrest = document.getElementById('statUnrest');
const statEconomy = document.getElementById('statEconomy');
const statMilitary = document.getElementById('statMilitary');
const statFood = document.getElementById('statFood');
const statLuxury = document.getElementById('statLuxury');
const statMorale = document.getElementById('statMorale');
const statPopulation = document.getElementById('statPopulation');
const statFarms = document.getElementById('statFarms');
const handDisplay = document.getElementById('handDisplay');
const handCount = document.getElementById('handCount');
const actionsPanel = document.getElementById('actionsPanel');
const actionHint = document.getElementById('actionHint');
const actionBuyCard = document.getElementById('actionBuyCard');
const actionBuyFarm = document.getElementById('actionBuyFarm');
const actionBuyLuxury = document.getElementById('actionBuyLuxury');
const actionReduceUnrest = document.getElementById('actionReduceUnrest');
const actionWar = document.getElementById('actionWar');
const actionTrade = document.getElementById('actionTrade');
const gameHostControls = document.getElementById('gameHostControls');
const btnAdvancePhase = document.getElementById('btnAdvancePhase');
const otherPlayersList = document.getElementById('otherPlayersList');
const leaveGameBtn2 = document.getElementById('leaveGameBtn2');

// Modals
const warModal = document.getElementById('warModal');
const closeWarModal = document.getElementById('closeWarModal');
const warTargetSelect = document.getElementById('warTargetSelect');
const btnDeclareWar = document.getElementById('btnDeclareWar');
const activeWarsList = document.getElementById('activeWarsList');

const rebellionModal = document.getElementById('rebellionModal');
const closeRebellionModal = document.getElementById('closeRebellionModal');

const tradeModal = document.getElementById('tradeModal');
const closeTradeModal = document.getElementById('closeTradeModal');
const tradeTargetSelect = document.getElementById('tradeTargetSelect');
const btnSendTrade = document.getElementById('btnSendTrade');

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  attemptReconnect();
});

function initializeEventListeners() {
  joinBtn.addEventListener('click', handleJoinGame);
  createBtn.addEventListener('click', handleCreateGame);
  copyCodeBtn.addEventListener('click', handleCopyCode);
  startGameBtn.addEventListener('click', handleStartGame);
  leaveGameBtn.addEventListener('click', handleLeaveGame);
  leaveGameBtn2.addEventListener('click', handleLeaveGame);
  
  // Action buttons
  actionBuyCard.addEventListener('click', async () => {
    try {
      const result = await buyCard();
      if (!result.success) {
        alert(`❌ ${result.error}`);
      } else {
        alert('✅ Card purchased!');
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  });
  
  actionBuyFarm.addEventListener('click', async () => {
    try {
      const result = await buyFarm();
      if (!result.success) {
        alert(`❌ ${result.error}`);
      } else {
        alert('✅ Farm purchased!');
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  });
  
  actionBuyLuxury.addEventListener('click', async () => {
    const amountStr = prompt('How much luxury to buy? (1 economy per die roll)');
    if (amountStr && !isNaN(amountStr)) {
      const amount = parseInt(amountStr);
      if (amount > 0) {
        try {
          const result = await buyLuxury(amount);
          if (!result.success) {
            alert(`❌ ${result.error}`);
          } else {
            alert('✅ Luxury purchased!');
          }
        } catch (error) {
          alert(`❌ Error: ${error.message}`);
        }
      }
    }
  });
  
  actionReduceUnrest.addEventListener('click', async () => {
    try {
      const result = await reduceUnrest();
      if (!result.success) {
        alert(`❌ ${result.error}`);
      } else {
        alert('✅ Unrest reduced by 10!');
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  });
  
  // War and trade modals
  actionWar.addEventListener('click', () => {
    warModal.classList.remove('hidden');
  });
  
  actionTrade.addEventListener('click', () => {
    tradeModal.classList.remove('hidden');
  });
  
  closeWarModal.addEventListener('click', () => {
    warModal.classList.add('hidden');
  });
  
  closeTradeModal.addEventListener('click', () => {
    tradeModal.classList.add('hidden');
  });
  
  closeRebellionModal.addEventListener('click', () => {
    rebellionModal.classList.add('hidden');
  });
  
  btnDeclareWar.addEventListener('click', async () => {
    const targetId = warTargetSelect.value;
    if (!targetId) {
      alert('Please select a target');
      return;
    }
    const result = await declareWar(targetId);
    if (!result.success) {
      alert(result.error);
    } else {
      alert('War declared!');
      warModal.classList.add('hidden');
    }
  });
  
  btnSendTrade.addEventListener('click', async () => {
    const targetId = tradeTargetSelect.value;
    if (!targetId) {
      alert('Please select a player');
      return;
    }
    
    const offering = {
      economy: parseInt(document.getElementById('offerEconomy').value) || 0,
      food: parseInt(document.getElementById('offerFood').value) || 0,
      luxury: parseInt(document.getElementById('offerLuxury').value) || 0
    };
    
    const requesting = {
      economy: parseInt(document.getElementById('requestEconomy').value) || 0,
      food: parseInt(document.getElementById('requestFood').value) || 0,
      luxury: parseInt(document.getElementById('requestLuxury').value) || 0
    };
    
    const result = await sendTradeOffer(targetId, { offering, requesting });
    if (!result.success) {
      alert(result.error);
    } else {
      alert('Trade offer sent!');
      tradeModal.classList.add('hidden');
    }
  });
  
  // Host advance phase
  btnAdvancePhase.addEventListener('click', advancePhase);
  
  // Allow Enter key in inputs
  joinGameCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleJoinGame();
  });
  joinPlayerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleJoinGame();
  });
  createPlayerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCreateGame();
  });
  
  // Auto-uppercase game code
  joinGameCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

// ============================================================================
// Reconnection Logic
// ============================================================================

function attemptReconnect() {
  const savedGameCode = localStorage.getItem('gameCode');
  const savedPlayerId = localStorage.getItem('playerId');
  const savedPlayerName = localStorage.getItem('playerName');
  
  if (savedGameCode && savedPlayerId && savedPlayerName) {
    console.log('Attempting to reconnect to game:', savedGameCode);
    showScreen('loading');
    
    // Verify game still exists
    const gameRef = ref(database, `games/${savedGameCode}`);
    get(gameRef).then(snapshot => {
      if (snapshot.exists()) {
        const gameData = snapshot.val();
        const playerData = gameData.players?.[savedPlayerId];
        
        if (playerData) {
          // Player still exists in game, reconnect
          currentGameCode = savedGameCode;
          currentPlayerId = savedPlayerId;
          currentPlayerName = savedPlayerName;
          isHost = gameData.hostId === savedPlayerId;
          
          // Update lastSeen
          updatePlayerPresence();
          
          // Start listening to game
          listenToGame();
          
          // Show appropriate screen based on game state
          if (gameData.locked && gameData.phase !== 'SETUP') {
            showScreen('game');
          } else {
            showScreen('lobby');
          }
        } else {
          // Player no longer in game, clear saved data
          clearSavedGame();
          showScreen('welcome');
        }
      } else {
        // Game no longer exists
        clearSavedGame();
        showScreen('welcome');
      }
    }).catch(error => {
      console.error('Reconnection failed:', error);
      clearSavedGame();
      showScreen('welcome');
    });
  } else {
    showScreen('welcome');
  }
}

// ============================================================================
// Game Creation
// ============================================================================

async function handleCreateGame() {
  const enteredKey = creatorKeyInput.value.trim();
  const playerName = createPlayerNameInput.value.trim();
  
  if (enteredKey !== CREATOR_KEY) {
    alert('Invalid creator key. Not authorized to create games.');
    return;
  }
  
  if (!playerName || playerName.length < 2) {
    alert('Please enter a valid display name (at least 2 characters).');
    return;
  }
  
  showScreen('loading');
  
  try {
    const playerId = generatePlayerId();
    let gameCode = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    // Try to create game with unique code (with collision detection)
    while (!gameCode && attempts < maxAttempts) {
      const candidateCode = generateGameCode();
      const gameRef = ref(database, `games/${candidateCode}`);
      
      // Use transaction to check if code exists
      const result = await runTransaction(gameRef, (currentData) => {
        if (currentData !== null) {
          // Code already exists, abort this transaction
          return; // This will fail the transaction
        }
        
        // Code is available, create the game
        return {
          phase: 'SETUP',
          locked: false,
          hostId: playerId,
          turnOrder: [playerId],
          currentTurnIndex: 0,
          round: 0,
          naturalEventsEnabled: naturalEventsToggle.checked,
          maxPlayers: MAX_PLAYERS,
          meta: {
            createdAt: serverTimestamp()
          },
          players: {
            [playerId]: createPlayerData(playerName)
          }
        };
      });
      
      if (result.committed) {
        gameCode = candidateCode;
      } else {
        attempts++;
      }
    }
    
    if (!gameCode) {
      throw new Error('Failed to generate unique game code after multiple attempts');
    }
    
    // Save to state and localStorage
    currentGameCode = gameCode;
    currentPlayerId = playerId;
    currentPlayerName = playerName;
    isHost = true;
    saveGameToLocalStorage();
    
    // Setup presence
    updatePlayerPresence();
    
    // Start listening
    listenToGame();
    showScreen('lobby');
    
    console.log('Game created successfully:', gameCode);
  } catch (error) {
    console.error('Failed to create game:', error);
    alert('Failed to create game. Please try again.');
    showScreen('welcome');
  }
}

// ============================================================================
// Game Joining
// ============================================================================

async function handleJoinGame() {
  const gameCode = joinGameCodeInput.value.trim().toUpperCase();
  const playerName = joinPlayerNameInput.value.trim();
  
  if (!gameCode || gameCode.length !== GAME_CODE_LENGTH) {
    alert(`Please enter a valid ${GAME_CODE_LENGTH}-character game code.`);
    return;
  }
  
  if (!playerName || playerName.length < 2) {
    alert('Please enter a valid display name (at least 2 characters).');
    return;
  }
  
  showScreen('loading');
  
  try {
    const gameRef = ref(database, `games/${gameCode}`);
    
    // Use transaction to safely add player
    await runTransaction(gameRef, (gameData) => {
      if (!gameData) {
        // Game doesn't exist
        return;
      }
      
      if (gameData.locked) {
        // Game already started
        return;
      }
      
      // Check max players
      const playerCount = Object.keys(gameData.players || {}).length;
      if (playerCount >= (gameData.maxPlayers || MAX_PLAYERS)) {
        throw new Error('Game is full');
      }
      
      // Add player
      const playerId = generatePlayerId();
      if (!gameData.players) {
        gameData.players = {};
      }
      
      gameData.players[playerId] = createPlayerData(playerName);
      
      // Add to turn order
      if (!gameData.turnOrder) {
        gameData.turnOrder = [];
      }
      gameData.turnOrder.push(playerId);
      
      // Store playerId in parent scope for later use
      currentPlayerId = playerId;
      
      return gameData;
    });
    
    // If we get here, transaction succeeded
    if (!currentPlayerId) {
      throw new Error('Game not found or already started');
    }
    
    // Save to state and localStorage
    currentGameCode = gameCode;
    currentPlayerName = playerName;
    isHost = false;
    saveGameToLocalStorage();
    
    // Setup presence
    updatePlayerPresence();
    
    // Start listening
    listenToGame();
    showScreen('lobby');
    
    console.log('Joined game successfully:', gameCode);
  } catch (error) {
    console.error('Failed to join game:', error);
    alert('Failed to join game. The game may not exist or has already started.');
    currentPlayerId = null;
    showScreen('welcome');
  }
}

// ============================================================================
// Game State Listening
// ============================================================================

function listenToGame() {
  if (!currentGameCode) return;
  
  // Remove previous listener if exists
  if (gameListener) {
    gameListener();
  }
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  gameListener = onValue(gameRef, (snapshot) => {
    if (!snapshot.exists()) {
      // Game was deleted
      alert('Game has ended or was removed.');
      handleLeaveGame();
      return;
    }
    
    const gameData = snapshot.val();
    
    // Show appropriate screen
    if (gameData.locked && gameData.phase !== 'SETUP') {
      showScreen('game');
      updateGameUI(gameData);
    } else {
      showScreen('lobby');
      updateLobbyUI(gameData);
    }
  });
}

// ============================================================================
// UI Updates
// ============================================================================

function updateLobbyUI(gameData) {
  // If game has started, show game screen instead
  if (gameData.locked && gameData.phase !== 'SETUP') {
    showScreen('game');
    updateGameUI(gameData);
    return;
  }
  
  // Update game code display
  displayGameCode.textContent = currentGameCode;
  
  // Update phase and round
  phaseDisplay.textContent = gameData.phase || 'SETUP';
  roundDisplay.textContent = gameData.round || '-';
  
  // Update locked status
  if (gameData.locked) {
    lockedStatus.innerHTML = '<span style="color: #ff6b6b;">🔒 Game Started</span>';
  } else {
    lockedStatus.innerHTML = '<span style="color: #51cf66;">🔓 Open</span>';
  }
  
  // Update players list
  updatePlayersList(gameData.players, gameData.hostId);
  
  // Show/hide host controls
  if (isHost && !gameData.locked) {
    hostControls.classList.remove('hidden');
  } else {
    hostControls.classList.add('hidden');
  }
}

function updateGameUI(gameData) {
  // Update phase and round
  gamePhase.textContent = gameData.phase || 'SETUP';
  gameRound.textContent = gameData.round || '1';
  
  // Check for victory
  if (gameData.gameOver) {
    victoryBanner.classList.remove('hidden');
    if (gameData.winner) {
      const winnerName = gameData.players[gameData.winner]?.name || 'Unknown';
      victoryMessage.textContent = `${winnerName} has won the game!`;
    } else {
      victoryMessage.textContent = 'All civilizations have collapsed. No winner.';
    }
  } else {
    victoryBanner.classList.add('hidden');
  }
  
  // Get current player data
  const player = gameData.players[currentPlayerId];
  if (!player) return;
  
  // Update dashboard
  playerDashboardName.textContent = player.name || 'Your Civilization';
  statUnrest.textContent = player.stats.unrest || 0;
  statEconomy.textContent = player.stats.economy || 0;
  statMilitary.textContent = player.stats.military || 0;
  statFood.textContent = player.stats.food || 0;
  statLuxury.textContent = player.stats.luxury || 0;
  statMorale.textContent = player.stats.morale || 0;
  statPopulation.textContent = player.stats.population || 0;
  statFarms.textContent = player.farms || 0;
  
  // Update hand
  updateHandDisplay(player.hand);
  
  // Update action buttons based on phase
  updateActionButtons(gameData.phase, player);
  
  // Show host controls if host
  if (isHost) {
    gameHostControls.classList.remove('hidden');
  } else {
    gameHostControls.classList.add('hidden');
  }
  
  // Update other players
  updateOtherPlayersList(gameData.players);
}

function updateHandDisplay(hand) {
  if (!hand || hand.length === 0) {
    handDisplay.innerHTML = '<p class="hint">No cards in hand</p>';
    handCount.textContent = '0';
    return;
  }
  
  handCount.textContent = hand.length;
  handDisplay.innerHTML = '';
  
  hand.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card ${card.type}`;
    cardDiv.innerHTML = `
      <div class="card-rank">${card.rank}</div>
      <div class="card-suit">${card.suit}</div>
      <div class="card-value">${card.value}</div>
    `;
    handDisplay.appendChild(cardDiv);
  });
}

function updateActionButtons(phase, player) {
  const isStateActions = phase === 'STATE_ACTIONS';
  
  // Enable/disable action buttons
  actionBuyCard.disabled = !isStateActions || player.actionsThisRound.economic;
  actionBuyFarm.disabled = !isStateActions || player.actionsThisRound.economic;
  actionBuyLuxury.disabled = !isStateActions || player.actionsThisRound.economic || player.stats.unrest >= 50;
  actionReduceUnrest.disabled = !isStateActions || player.actionsThisRound.domestic;
  
  // Update hint
  if (isStateActions) {
    actionHint.textContent = 'Take your actions for this round';
  } else {
    actionHint.textContent = `Actions available in STATE_ACTIONS phase (currently ${phase})`;
  }
}

function updateOtherPlayersList(players) {
  if (!players) {
    otherPlayersList.innerHTML = '<p class="hint">No other players</p>';
    return;
  }
  
  otherPlayersList.innerHTML = '';
  
  // Also update modal selects
  warTargetSelect.innerHTML = '<option value="">Select opponent...</option>';
  tradeTargetSelect.innerHTML = '<option value="">Select player...</option>';
  
  Object.entries(players).forEach(([playerId, playerData]) => {
    if (playerId === currentPlayerId) return; // Skip current player
    
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = playerData.name || 'Unknown Player';
    
    const statsSpan = document.createElement('span');
    statsSpan.className = 'player-stats';
    statsSpan.textContent = `Unrest: ${playerData.stats.unrest} | Pop: ${playerData.stats.population}`;
    statsSpan.style.fontSize = '0.8rem';
    statsSpan.style.color = '#aaa';
    
    playerDiv.appendChild(nameSpan);
    playerDiv.appendChild(statsSpan);
    otherPlayersList.appendChild(playerDiv);
    
    // Add to modal selects
    const warOption = document.createElement('option');
    warOption.value = playerId;
    warOption.textContent = playerData.name;
    warTargetSelect.appendChild(warOption);
    
    const tradeOption = document.createElement('option');
    tradeOption.value = playerId;
    tradeOption.textContent = playerData.name;
    tradeTargetSelect.appendChild(tradeOption);
  });
  
  if (otherPlayersList.children.length === 0) {
    otherPlayersList.innerHTML = '<p class="hint">No other players</p>';
  }
}

function updatePlayersList(players, hostId) {
  if (!players) {
    playersList.innerHTML = '<p class="hint">No players yet...</p>';
    return;
  }
  
  playersList.innerHTML = '';
  
  Object.entries(players).forEach(([playerId, playerData]) => {
    const isCurrentPlayer = playerId === currentPlayerId;
    const isPlayerHost = playerId === hostId;
    
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    if (isPlayerHost) playerDiv.classList.add('host');
    if (isCurrentPlayer) playerDiv.classList.add('you');
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = playerData.name || 'Unknown Player';
    
    const badgeContainer = document.createElement('div');
    
    if (isPlayerHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'player-badge';
      hostBadge.textContent = '👑 Host';
      badgeContainer.appendChild(hostBadge);
    }
    
    if (isCurrentPlayer) {
      const youBadge = document.createElement('span');
      youBadge.className = 'player-badge';
      youBadge.style.background = 'rgba(56, 239, 125, 0.2)';
      youBadge.style.color = '#38ef7d';
      youBadge.textContent = 'You';
      badgeContainer.appendChild(youBadge);
    }
    
    playerDiv.appendChild(nameSpan);
    playerDiv.appendChild(badgeContainer);
    playersList.appendChild(playerDiv);
  });
}

// ============================================================================
// Host Controls
// ============================================================================

async function handleStartGame() {
  if (!isHost || !currentGameCode) return;
  
  const confirmed = confirm('Start the game? Players will no longer be able to join.');
  if (!confirmed) return;
  
  try {
    const gameRef = ref(database, `games/${currentGameCode}`);
    
    await runTransaction(gameRef, (gameData) => {
      if (!gameData) return;
      
      // Lock the game and advance to first phase
      gameData.locked = true;
      gameData.phase = 'UPKEEP';
      gameData.round = 1;
      
      // Initialize stats for all players based on their starting hands
      Object.keys(gameData.players).forEach(playerId => {
        const player = gameData.players[playerId];
        player.stats.economy = calculateEconomy(player.hand);
        player.stats.military = calculateMilitary(player.hand);
      });
      
      return gameData;
    });
    
    console.log('Game started');
  } catch (error) {
    console.error('Failed to start game:', error);
    alert('Failed to start game. Please try again.');
  }
}

// ============================================================================
// Actions
// ============================================================================

function handleCopyCode() {
  navigator.clipboard.writeText(currentGameCode).then(() => {
    const originalText = copyCodeBtn.textContent;
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyCodeBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert(`Game Code: ${currentGameCode}`);
  });
}

function handleLeaveGame() {
  if (gameListener) {
    gameListener();
    gameListener = null;
  }
  
  clearSavedGame();
  
  currentGameCode = null;
  currentPlayerId = null;
  currentPlayerName = null;
  isHost = false;
  
  // Clear inputs
  joinGameCodeInput.value = '';
  joinPlayerNameInput.value = '';
  creatorKeyInput.value = '';
  createPlayerNameInput.value = '';
  
  showScreen('welcome');
}

// ============================================================================
// Player Presence
// ============================================================================

function updatePlayerPresence() {
  if (!currentGameCode || !currentPlayerId) return;
  
  const playerRef = ref(database, `games/${currentGameCode}/players/${currentPlayerId}`);
  const presenceRef = ref(database, `games/${currentGameCode}/players/${currentPlayerId}/lastSeen`);
  
  // Update lastSeen timestamp
  update(playerRef, {
    lastSeen: serverTimestamp()
  });
  
  // Setup onDisconnect to mark player as disconnected
  const disconnectRef = onDisconnect(presenceRef);
  disconnectRef.set(serverTimestamp());
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateGameCode() {
  // Exclude visually similar characters: 0/O, 1/I/L are removed to avoid confusion
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generatePlayerId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function createPlayerData(name) {
  const deck = generateDeck();
  const initialHand = deck.slice(0, 4);
  const remainingDeck = deck.slice(4);
  
  // Draw 2 emergency cards (face down, unknown)
  const emergencyCards = remainingDeck.slice(0, 2);
  const finalDeck = remainingDeck.slice(2);
  
  return {
    name: name,
    stats: {
      unrest: 0,
      economy: 0,
      military: 0,
      food: 0,
      luxury: 0,
      morale: 0,
      population: 0
    },
    hand: initialHand,
    deck: finalDeck,
    discard: [],
    emergencyCards: emergencyCards.map(card => ({ ...card, faceDown: true })),
    farms: 0,
    warTracks: {},  // { opponentId: trackValue }
    siegedBy: null,
    occupiedBy: null,
    occupying: [],  // List of player IDs this player is occupying
    rebellionTrack: null,  // null = no rebellion, number = rebellion stage
    actionsThisRound: {
      economic: false,
      military: false,
      domestic: false,
      diplomatic: false,
      emergency: false
    },
    tradeOffersReceived: [],
    tradeOffersSent: [],
    lastSeen: serverTimestamp()
  };
}

function showScreen(screenName) {
  welcomeScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  loadingScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  
  switch(screenName) {
    case 'welcome':
      welcomeScreen.classList.remove('hidden');
      break;
    case 'lobby':
      lobbyScreen.classList.remove('hidden');
      break;
    case 'loading':
      loadingScreen.classList.remove('hidden');
      break;
    case 'game':
      gameScreen.classList.remove('hidden');
      break;
  }
}

function saveGameToLocalStorage() {
  localStorage.setItem('gameCode', currentGameCode);
  localStorage.setItem('playerId', currentPlayerId);
  localStorage.setItem('playerName', currentPlayerName);
}

function clearSavedGame() {
  localStorage.removeItem('gameCode');
  localStorage.removeItem('playerId');
  localStorage.removeItem('playerName');
}

// ============================================================================
// Game Phase Processing
// ============================================================================

// Check for victory conditions
function checkVictoryConditions(gameData) {
  // Count non-collapsed civilizations
  const activePlayers = Object.keys(gameData.players).filter(
    playerId => !gameData.players[playerId].collapsed
  );
  
  if (activePlayers.length === 1) {
    const winner = gameData.players[activePlayers[0]];
    
    // Winner must survive 2 rounds without rebellion or economic collapse
    if (!gameData.victoryWatch) {
      gameData.victoryWatch = {
        playerId: activePlayers[0],
        roundsRemaining: 2
      };
    } else if (gameData.victoryWatch.playerId === activePlayers[0]) {
      // Check if winner had rebellion or economic collapse
      if (winner.rebellionTrack !== null || winner.stats.economy === 0) {
        // Reset victory watch
        gameData.victoryWatch.roundsRemaining = 2;
      } else {
        gameData.victoryWatch.roundsRemaining -= 1;
        
        if (gameData.victoryWatch.roundsRemaining <= 0) {
          gameData.winner = activePlayers[0];
          gameData.gameOver = true;
        }
      }
    }
  } else if (activePlayers.length === 0) {
    // Everyone collapsed
    gameData.gameOver = true;
    gameData.winner = null;
  }
  
  return gameData;
}

// Process UPKEEP phase (automatic calculations)
async function processUpkeepPhase() {
  if (!isHost || !currentGameCode) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  await runTransaction(gameRef, (gameData) => {
    if (!gameData || gameData.phase !== 'UPKEEP') return;
    
    Object.keys(gameData.players).forEach(playerId => {
      const player = gameData.players[playerId];
      
      // 1. Food Production
      let farmProduction = player.farms * FARM_FOOD_PRODUCTION;
      
      // Check for drought effect
      if (player.droughtNextRound) {
        farmProduction = Math.floor(farmProduction / 2);
        player.droughtNextRound = false; // Consume the flag
      }
      
      // Check for siege
      if (player.siegedBy) {
        farmProduction = 0;
      }
      
      player.stats.food += farmProduction;
      
      // 2. Morale Calculation
      player.stats.morale = calculateMorale(player.stats.luxury, player.stats.food);
      
      // 3. Population Calculation
      player.stats.population = calculatePopulation(
        player.stats.luxury,
        player.stats.food,
        player.stats.morale,
        player.stats.military
      );
      
      // 4. Population Pressure Unrest
      const pressureUnrest = getPopulationPressureUnrest(player.stats.population);
      player.stats.unrest += pressureUnrest;
    });
    
    return gameData;
  });
}

// Process INTERNAL_PRESSURE phase (automatic penalties)
async function processInternalPressurePhase() {
  if (!isHost || !currentGameCode) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  await runTransaction(gameRef, (gameData) => {
    if (!gameData || gameData.phase !== 'INTERNAL_PRESSURE') return;
    
    Object.keys(gameData.players).forEach(playerId => {
      const player = gameData.players[playerId];
      
      // Food Stress
      const pop = player.stats.population;
      const food = player.stats.food;
      if (food < pop * 2) {
        player.stats.unrest += 10;
      } else if (food < pop * 4) {
        player.stats.unrest += 5;
      }
      
      // Siege Pressure
      if (player.siegedBy) {
        player.stats.unrest += 8;
      }
      
      // Economic Collapse Pressure
      if (player.stats.economy === 0) {
        player.stats.unrest += 10;
      }
      
      // Trigger rebellion if unrest >= 100
      if (player.stats.unrest >= 100 && player.rebellionTrack === null) {
        player.rebellionTrack = 2;  // Start at stage 2
      }
    });
    
    return gameData;
  });
}

// Advance to next phase (host only)
async function advancePhase() {
  if (!isHost || !currentGameCode) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  let gameOver = false;
  
  await runTransaction(gameRef, (gameData) => {
    if (!gameData) return;
    
    // Verify host in transaction (prevent console manipulation)
    if (gameData.hostId !== currentPlayerId) {
      throw new Error('Only the host can advance phases');
    }
    
    // Check for game over
    if (gameData.gameOver) {
      gameOver = true;
      return;
    }
    
    const currentPhaseIndex = PHASES.indexOf(gameData.phase);
    
    // Auto-process certain phases before advancing
    if (gameData.phase === 'UPKEEP') {
      // Already processed
    } else if (gameData.phase === 'INTERNAL_PRESSURE') {
      // Already processed
    } else if (gameData.phase === 'CLEANUP') {
      // Reset action flags for next round
      Object.keys(gameData.players).forEach(playerId => {
        gameData.players[playerId].actionsThisRound = {
          economic: false,
          military: false,
          domestic: false,
          diplomatic: false,
          emergency: false
        };
      });
    }
    
    // Move to next phase
    if (currentPhaseIndex < PHASES.length - 1) {
      gameData.phase = PHASES[currentPhaseIndex + 1];
    } else {
      // End of round, go back to UPKEEP and increment round
      gameData.phase = 'UPKEEP';
      gameData.round += 1;
      
      // Check victory conditions
      gameData = checkVictoryConditions(gameData);
    }
    
    // Auto-advance turn index for turn-based phases
    if (gameData.phase === 'STATE_ACTIONS' || gameData.phase === 'WAR') {
      gameData.currentTurnIndex = 0;
    }
    
    return gameData;
  });
  
  // Alert outside transaction
  if (gameOver) {
    alert('Game is over!');
    return;
  }
  
  // Auto-process new phase if needed
  const snapshot = await get(gameRef);
  if (snapshot.exists()) {
    const gameData = snapshot.val();
    if (gameData.phase === 'UPKEEP') {
      await processUpkeepPhase();
    } else if (gameData.phase === 'INTERNAL_PRESSURE') {
      await processInternalPressurePhase();
    }
  }
}

// ============================================================================
// Player Actions
// ============================================================================

// Declare war (STATE_ACTIONS phase, military action)
async function declareWar(targetPlayerId) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'STATE_ACTIONS') {
        throw new Error('Not in STATE_ACTIONS phase');
      }
      
      const player = gameData.players[currentPlayerId];
      const target = gameData.players[targetPlayerId];
      
      if (!target) {
        throw new Error('Target player not found');
      }
      
      // Validations
      if (player.actionsThisRound.military) {
        throw new Error('Already performed military action this round');
      }
      
      // Initialize war track if not exists
      if (!player.warTracks) {
        player.warTracks = {};
      }
      
      if (!player.warTracks[targetPlayerId]) {
        player.warTracks[targetPlayerId] = 0;
      }
      
      player.actionsThisRound.military = true;
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Commit troops to war (WAR phase)
async function commitTroops(targetPlayerId, frontline, garrison, reserve) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'WAR') {
        throw new Error('Not in WAR phase');
      }
      
      const player = gameData.players[currentPlayerId];
      
      // Validate total doesn't exceed military
      const total = frontline + garrison + reserve;
      if (total > player.stats.military) {
        throw new Error('Not enough military forces');
      }
      
      // Store commitment
      if (!player.warCommitments) {
        player.warCommitments = {};
      }
      
      player.warCommitments[targetPlayerId] = {
        frontline,
        garrison,
        reserve
      };
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Conduct battle (WAR phase, host only)
async function conductBattle(attackerId, defenderId) {
  if (!isHost || !currentGameCode) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'WAR') {
        throw new Error('Not in WAR phase');
      }
      
      const attacker = gameData.players[attackerId];
      const defender = gameData.players[defenderId];
      
      if (!attacker.warCommitments || !attacker.warCommitments[defenderId]) {
        throw new Error('No war commitment found');
      }
      
      const attackerForce = attacker.warCommitments[defenderId].frontline;
      const defenderForce = defender.warCommitments?.[attackerId]?.frontline || defender.stats.military;
      
      // Battle outcome (attacker wins ties)
      const attackerWins = attackerForce >= defenderForce;
      const isClear = Math.abs(attackerForce - defenderForce) > 10;
      
      // Roll casualty die
      const casualtyRoll = rollDie();
      let casualtyFraction = casualtyRoll / 6;
      
      // Apply casualties
      const attackerLosses = Math.floor(attackerForce * casualtyFraction);
      const defenderLosses = Math.floor(defenderForce * casualtyFraction);
      
      // Update war track
      if (!attacker.warTracks) attacker.warTracks = {};
      if (!attacker.warTracks[defenderId]) attacker.warTracks[defenderId] = 0;
      
      if (attackerWins) {
        attacker.warTracks[defenderId] += isClear ? 2 : 1;
      }
      
      // Check for siege (track >= 3)
      if (attacker.warTracks[defenderId] >= 3) {
        defender.siegedBy = attackerId;
      }
      
      // Check for collapse (track >= 7)
      if (attacker.warTracks[defenderId] >= 7) {
        defender.occupiedBy = attackerId;
        if (!attacker.occupying) attacker.occupying = [];
        if (!attacker.occupying.includes(defenderId)) {
          attacker.occupying.push(defenderId);
        }
      }
      
      // Record battle results
      if (!gameData.battleLog) gameData.battleLog = [];
      gameData.battleLog.push({
        round: gameData.round,
        attacker: attackerId,
        defender: defenderId,
        attackerForce,
        defenderForce,
        attackerWins,
        isClear,
        casualtyRoll,
        attackerLosses,
        defenderLosses,
        warTrack: attacker.warTracks[defenderId]
      });
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process rebellion stage (REBELLION phase)
async function processRebellion(playerId) {
  if (!isHost || !currentGameCode) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'REBELLION') {
        throw new Error('Not in REBELLION phase');
      }
      
      const player = gameData.players[playerId];
      
      if (player.rebellionTrack === null) {
        return gameData; // No rebellion
      }
      
      // Calculate rebellion dice pool
      let rebellionDice = 2;
      if (player.stats.population >= 75) rebellionDice += 1;
      if (player.siegedBy) rebellionDice += 1;
      if (player.stats.food < player.stats.population * 2) rebellionDice += 1;
      
      // Check war track >= 5 for any opponent
      let highWarTrack = false;
      if (player.warTracks) {
        Object.values(player.warTracks).forEach(track => {
          if (track >= 5) highWarTrack = true;
        });
      }
      if (highWarTrack) rebellionDice += 1;
      
      // Calculate government dice pool
      let govDice = 2;
      govDice += Math.floor(player.stats.military / 20);
      
      // Roll dice
      const rebellionRolls = rollDice(rebellionDice);
      const govRolls = rollDice(govDice);
      
      const rebellionTotal = rebellionRolls.reduce((sum, val) => sum + val, 0);
      const govTotal = govRolls.reduce((sum, val) => sum + val, 0);
      
      // Determine outcome based on stage
      const stage = Math.floor(player.rebellionTrack);
      let trackChange = 0;
      
      if (stage <= 2) {
        // Stage 1: Civil Disorder
        if (rebellionTotal > govTotal) {
          trackChange = 1;
        } else {
          trackChange = -1;
        }
      } else if (stage <= 4) {
        // Stage 2: Armed Uprising
        if (rebellionTotal > govTotal) {
          trackChange = 2;
        } else {
          trackChange = -1;
        }
      } else {
        // Stage 3: Regime Collapse
        if (rebellionTotal > govTotal) {
          trackChange = 2;
        } else {
          trackChange = -2;
        }
      }
      
      player.rebellionTrack += trackChange;
      
      // Check for resolution
      if (player.rebellionTrack <= 0) {
        player.rebellionTrack = null;
        player.stats.unrest = Math.max(0, player.stats.unrest - 20);
      } else if (player.rebellionTrack >= 6) {
        // Civilization collapses
        player.collapsed = true;
      }
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Apply natural event (NATURAL_EVENTS phase, host only)
async function applyNaturalEvent() {
  if (!isHost || !currentGameCode) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'NATURAL_EVENTS') {
        throw new Error('Not in NATURAL_EVENTS phase');
      }
      
      if (!gameData.naturalEventsEnabled) {
        return gameData; // Skip if disabled
      }
      
      const playerIds = Object.keys(gameData.players);
      if (playerIds.length === 0) return gameData;
      
      // Roll to pick affected player (unbiased)
      const affectedPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const player = gameData.players[affectedPlayerId];
      
      // Roll for event category
      const eventRoll = rollDie();
      let eventType = '';
      
      switch(eventRoll) {
        case 1:
        case 2:
          // Drought - halve farm production next round
          player.droughtNextRound = true;
          eventType = 'Drought';
          break;
        case 3:
          // Plague - reduce morale by 5
          player.stats.morale = Math.max(0, player.stats.morale - 5);
          eventType = 'Plague';
          break;
        case 4:
          // Earthquake - lose 1 farm
          player.farms = Math.max(0, player.farms - 1);
          eventType = 'Earthquake';
          break;
        case 5:
        case 6:
          // Flood - lose 10 food
          player.stats.food = Math.max(0, player.stats.food - 10);
          eventType = 'Flood';
          break;
      }
      
      // Record event
      if (!gameData.eventLog) gameData.eventLog = [];
      gameData.eventLog.push({
        round: gameData.round,
        player: affectedPlayerId,
        eventType
      });
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Player Actions
// ============================================================================

// Buy a card (STATE_ACTIONS phase)
async function buyCard() {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'STATE_ACTIONS') {
        throw new Error('Not in STATE_ACTIONS phase');
      }
      
      const player = gameData.players[currentPlayerId];
      
      // Validations
      if (player.actionsThisRound.economic) {
        throw new Error('Already performed economic action this round');
      }
      
      if (player.stats.economy < COSTS.CARD) {
        throw new Error('Not enough economy');
      }
      
      if (player.hand.length >= HAND_LIMIT) {
        throw new Error('Hand is full');
      }
      
      if (player.deck.length === 0) {
        throw new Error('Deck is empty');
      }
      
      // Draw card and update stats
      const drawnCard = player.deck.shift();
      player.hand.push(drawnCard);
      player.actionsThisRound.economic = true;
      
      // Recalculate economy/military
      player.stats.economy = calculateEconomy(player.hand);
      player.stats.military = calculateMilitary(player.hand);
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Buy a farm (STATE_ACTIONS phase)
async function buyFarm() {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'STATE_ACTIONS') {
        throw new Error('Not in STATE_ACTIONS phase');
      }
      
      const player = gameData.players[currentPlayerId];
      
      // Validations
      if (player.actionsThisRound.economic) {
        throw new Error('Already performed economic action this round');
      }
      
      if (player.stats.economy < COSTS.FARM) {
        throw new Error('Not enough economy');
      }
      
      // Buy farm
      player.farms += 1;
      player.actionsThisRound.economic = true;
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Buy luxury (STATE_ACTIONS phase)
async function buyLuxury(amount) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'STATE_ACTIONS') {
        throw new Error('Not in STATE_ACTIONS phase');
      }
      
      const player = gameData.players[currentPlayerId];
      
      // Validations
      if (player.actionsThisRound.economic) {
        throw new Error('Already performed economic action this round');
      }
      
      if (player.stats.unrest >= 50) {
        throw new Error('Cannot buy luxury with 50+ unrest');
      }
      
      const cost = amount * COSTS.LUXURY;
      if (player.stats.economy < cost) {
        throw new Error('Not enough economy');
      }
      
      // Roll dice for luxury
      const diceResults = rollDice(amount);
      const luxuryGained = diceResults.reduce((sum, val) => sum + val, 0);
      
      player.stats.luxury += luxuryGained;
      player.actionsThisRound.economic = true;
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Reduce unrest (domestic action)
async function reduceUnrest() {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'STATE_ACTIONS') {
        throw new Error('Not in STATE_ACTIONS phase');
      }
      
      const player = gameData.players[currentPlayerId];
      
      // Validations
      if (player.actionsThisRound.domestic) {
        throw new Error('Already performed domestic action this round');
      }
      
      // Reduce unrest by 10
      player.stats.unrest = Math.max(0, player.stats.unrest - 10);
      player.actionsThisRound.domestic = true;
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Discard cards (CLEANUP phase)
async function discardCards(cardIds) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'CLEANUP') {
        throw new Error('Not in CLEANUP phase');
      }
      
      const player = gameData.players[currentPlayerId];
      
      // Remove cards from hand and add to discard
      player.hand = player.hand.filter(card => {
        if (cardIds.includes(card.id)) {
          player.discard.push(card);
          return false;
        }
        return true;
      });
      
      // Recalculate economy/military
      player.stats.economy = calculateEconomy(player.hand);
      player.stats.military = calculateMilitary(player.hand);
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Send trade offer (STATE_ACTIONS phase, diplomatic action)
async function sendTradeOffer(targetPlayerId, offer) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'STATE_ACTIONS') {
        throw new Error('Not in STATE_ACTIONS phase');
      }
      
      const player = gameData.players[currentPlayerId];
      const target = gameData.players[targetPlayerId];
      
      if (!target) {
        throw new Error('Target player not found');
      }
      
      // Validations
      if (player.actionsThisRound.diplomatic) {
        throw new Error('Already performed diplomatic action this round');
      }
      
      // Create trade offer
      const tradeOffer = {
        id: `trade_${Date.now()}`,
        from: currentPlayerId,
        to: targetPlayerId,
        offering: offer.offering,
        requesting: offer.requesting,
        status: 'pending',
        round: gameData.round
      };
      
      // Add to sender's sent offers
      if (!player.tradeOffersSent) player.tradeOffersSent = [];
      player.tradeOffersSent.push(tradeOffer);
      
      // Add to receiver's received offers
      if (!target.tradeOffersReceived) target.tradeOffersReceived = [];
      target.tradeOffersReceived.push(tradeOffer);
      
      player.actionsThisRound.diplomatic = true;
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Accept trade offer
async function acceptTradeOffer(tradeId) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData) return;
      
      const player = gameData.players[currentPlayerId];
      
      // Find the trade offer
      const offer = player.tradeOffersReceived?.find(t => t.id === tradeId);
      if (!offer || offer.status !== 'pending') {
        throw new Error('Trade offer not found or already resolved');
      }
      
      const sender = gameData.players[offer.from];
      
      // Validate sender has sufficient resources
      if (sender.stats.economy < (offer.offering.economy || 0) ||
          sender.stats.food < (offer.offering.food || 0) ||
          sender.stats.luxury < (offer.offering.luxury || 0)) {
        throw new Error('Sender no longer has sufficient resources');
      }
      
      // Validate receiver has sufficient resources
      if (player.stats.economy < (offer.requesting.economy || 0) ||
          player.stats.food < (offer.requesting.food || 0) ||
          player.stats.luxury < (offer.requesting.luxury || 0)) {
        throw new Error('You do not have sufficient resources');
      }
      
      // Execute trade
      // Transfer resources from sender to receiver
      Object.entries(offer.offering).forEach(([resource, amount]) => {
        if (resource === 'economy' || resource === 'food' || resource === 'luxury') {
          sender.stats[resource] = Math.max(0, sender.stats[resource] - amount);
          player.stats[resource] += amount;
        }
      });
      
      // Transfer resources from receiver to sender
      Object.entries(offer.requesting).forEach(([resource, amount]) => {
        if (resource === 'economy' || resource === 'food' || resource === 'luxury') {
          player.stats[resource] = Math.max(0, player.stats[resource] - amount);
          sender.stats[resource] += amount;
        }
      });
      
      // Mark as accepted
      offer.status = 'accepted';
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Foreign interference (INTERNAL_PRESSURE phase)
async function foreignInterference(targetPlayerId, amount) {
  if (!currentGameCode || !currentPlayerId) return;
  
  const gameRef = ref(database, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (gameData) => {
      if (!gameData || gameData.phase !== 'INTERNAL_PRESSURE') {
        throw new Error('Not in INTERNAL_PRESSURE phase');
      }
      
      const player = gameData.players[currentPlayerId];
      const target = gameData.players[targetPlayerId];
      
      if (!target) {
        throw new Error('Target player not found');
      }
      
      // Validations
      if (target.stats.unrest < 75) {
        throw new Error('Target must have 75+ unrest');
      }
      
      if (player.stats.economy < amount) {
        throw new Error('Not enough economy');
      }
      
      if (amount > 10) {
        throw new Error('Maximum 10 unrest per round');
      }
      
      // Apply interference
      target.stats.unrest += amount;
      
      return gameData;
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Exports (for potential future use)
// ============================================================================

window.civilizationGame = {
  currentGameCode: () => currentGameCode,
  currentPlayerId: () => currentPlayerId,
  isHost: () => isHost,
  // Phase management
  advancePhase,
  // Player actions
  buyCard,
  buyFarm,
  buyLuxury,
  reduceUnrest,
  discardCards,
  // War actions
  declareWar,
  commitTroops,
  conductBattle,
  // Rebellion
  processRebellion,
  // Natural events
  applyNaturalEvent,
  // Trading & diplomacy
  sendTradeOffer,
  acceptTradeOffer,
  foreignInterference
};
