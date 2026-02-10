// ============================================================================
// Civilization Online - Phase 1: Lobby & Setup
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

// ============================================================================
// Firebase Initialization
// ============================================================================

// TODO: Replace with runtime configuration from deployment environment
// Expected: window.RUNTIME_FIREBASE_CONFIG to be set before this script loads
// For development, you can temporarily set it in the browser console or via inline script
const firebaseConfig = window.RUNTIME_FIREBASE_CONFIG || {
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

const joinGameCodeInput = document.getElementById('joinGameCode');
const joinPlayerNameInput = document.getElementById('joinPlayerName');
const joinBtn = document.getElementById('joinBtn');

const creatorKeyInput = document.getElementById('creatorKey');
const createPlayerNameInput = document.getElementById('createPlayerName');
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
          showScreen('lobby');
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
    // Generate unique game code
    const gameCode = generateGameCode();
    const playerId = generatePlayerId();
    
    // Create game structure
    const gameData = {
      phase: 'SETUP',
      locked: false,
      hostId: playerId,
      turnOrder: [playerId],
      round: 0,
      meta: {
        createdAt: serverTimestamp()
      },
      players: {
        [playerId]: createPlayerData(playerName)
      }
    };
    
    // Write to database using transaction for safety
    const gameRef = ref(database, `games/${gameCode}`);
    await set(gameRef, gameData);
    
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
    updateLobbyUI(gameData);
  });
}

// ============================================================================
// UI Updates
// ============================================================================

function updateLobbyUI(gameData) {
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
      gameData.phase = 'UPKEEP'; // First gameplay phase
      gameData.round = 1;
      
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
    hand: [],
    emergencyCards: [],
    farms: 0,
    lastSeen: serverTimestamp()
  };
}

function showScreen(screenName) {
  welcomeScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  loadingScreen.classList.add('hidden');
  
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
// Exports (for potential future use)
// ============================================================================

window.civilizationGame = {
  currentGameCode: () => currentGameCode,
  currentPlayerId: () => currentPlayerId,
  isHost: () => isHost
};
