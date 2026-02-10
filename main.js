// main.js - UI Controller for Civilization Online
'use strict';

import {
  initFirebase,
  createGame,
  joinGame,
  startGame,
  advancePhase,
  buyCard,
  buyFarm,
  buyLuxury,
  reduceUnrest,
  declareWar,
  listenToGameState,
  stopListeningToGameState,
  leaveGame,
  CREATOR_KEY
} from './game.js';

// UI State
let currentGame = null;
let currentPlayerId = null;
let currentPlayerName = null;
let isHost = false;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Civilization Online starting...');
  
  // Initialize Firebase
  const success = initFirebase();
  if (!success) {
    alert('Failed to initialize Firebase. Please check your configuration.');
    return;
  }
  
  // Check for reconnection
  const savedGameCode = localStorage.getItem('currentGameCode');
  const savedPlayerId = localStorage.getItem('currentPlayerId');
  const savedPlayerName = localStorage.getItem('currentPlayerName');
  
  if (savedGameCode && savedPlayerId && savedPlayerName) {
    console.log(`🔄 Attempting to reconnect to game ${savedGameCode}...`);
    currentPlayerId = savedPlayerId;
    currentPlayerName = savedPlayerName;
    
    // Listen to game state to verify game still exists
    listenToGameState(savedGameCode, (game) => {
      if (game && game.players && game.players[savedPlayerId]) {
        currentGame = game;
        isHost = game.players[savedPlayerId].isHost;
        
        if (game.started) {
          showGameScreen();
          updateGameUI(game);
        } else {
          showLobbyScreen();
          updateLobbyUI(game);
        }
      } else {
        // Game no longer exists or player was removed
        console.log('⚠️ Could not reconnect - game not found');
        localStorage.removeItem('currentGameCode');
        localStorage.removeItem('currentPlayerId');
        localStorage.removeItem('currentPlayerName');
        showWelcomeScreen();
      }
    });
  } else {
    showWelcomeScreen();
  }
  
  // Setup event listeners
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  // Welcome Screen
  document.getElementById('createBtn').addEventListener('click', handleCreateGame);
  document.getElementById('joinBtn').addEventListener('click', handleJoinGame);
  
  // Lobby Screen
  document.getElementById('startGameBtn').addEventListener('click', handleStartGame);
  document.getElementById('copyCodeBtn').addEventListener('click', handleCopyCode);
  document.getElementById('leaveGameBtn').addEventListener('click', handleLeaveGame);
  
  // Game Screen
  document.getElementById('actionBuyCard').addEventListener('click', () => buyCard());
  document.getElementById('actionBuyFarm').addEventListener('click', () => buyFarm());
  document.getElementById('actionBuyLuxury').addEventListener('click', () => buyLuxury());
  document.getElementById('actionReduceUnrest').addEventListener('click', () => reduceUnrest());
  document.getElementById('actionWar').addEventListener('click', showWarModal);
  document.getElementById('actionTrade').addEventListener('click', showTradeModal);
  document.getElementById('btnAdvancePhase').addEventListener('click', () => advancePhase());
  document.getElementById('leaveGameBtn2').addEventListener('click', handleLeaveGame);
  
  // Modals
  document.getElementById('closeWarModal').addEventListener('click', hideWarModal);
  document.getElementById('closeTradeModal').addEventListener('click', hideTradeModal);
  document.getElementById('closeRebellionModal').addEventListener('click', hideRebellionModal);
  document.getElementById('btnDeclareWar').addEventListener('click', handleDeclareWar);
}

// Handle Create Game
async function handleCreateGame() {
  const creatorKey = document.getElementById('creatorKey').value.trim();
  const playerName = document.getElementById('createPlayerName').value.trim();
  const naturalEvents = document.getElementById('naturalEventsToggle').checked;
  
  if (creatorKey !== CREATOR_KEY) {
    alert('❌ Invalid creator key');
    return;
  }
  
  if (!playerName || playerName.length < 2) {
    alert('❌ Please enter a valid player name (min 2 characters)');
    return;
  }
  
  const result = await createGame(playerName, naturalEvents);
  
  if (result) {
    currentPlayerId = result.playerId;
    currentPlayerName = result.playerName;
    isHost = true;
    
    // Start listening to game state
    listenToGameState(result.gameCode, (game) => {
      currentGame = game;
      
      if (game.started) {
        showGameScreen();
        updateGameUI(game);
      } else {
        showLobbyScreen();
        updateLobbyUI(game);
      }
    });
    
    showLobbyScreen();
  }
}

// Handle Join Game
async function handleJoinGame() {
  const gameCode = document.getElementById('joinGameCode').value.trim().toUpperCase();
  const playerName = document.getElementById('joinPlayerName').value.trim();
  
  if (!gameCode || gameCode.length !== 5) {
    alert('❌ Please enter a valid 5-character game code');
    return;
  }
  
  if (!playerName || playerName.length < 2) {
    alert('❌ Please enter a valid player name (min 2 characters)');
    return;
  }
  
  const result = await joinGame(gameCode, playerName);
  
  if (result) {
    currentPlayerId = result.playerId;
    currentPlayerName = result.playerName;
    isHost = false;
    
    // Start listening to game state
    listenToGameState(result.gameCode, (game) => {
      currentGame = game;
      
      if (game.started) {
        showGameScreen();
        updateGameUI(game);
      } else {
        showLobbyScreen();
        updateLobbyUI(game);
      }
    });
    
    showLobbyScreen();
  }
}

// Handle Start Game
async function handleStartGame() {
  if (!isHost) return;
  await startGame();
}

// Handle Copy Code
function handleCopyCode() {
  if (!currentGame) return;
  
  navigator.clipboard.writeText(currentGame.code).then(() => {
    alert('✅ Game code copied to clipboard!');
  }).catch(() => {
    alert('Game code: ' + currentGame.code);
  });
}

// Handle Leave Game
async function handleLeaveGame() {
  if (confirm('Are you sure you want to leave the game?')) {
    await leaveGame();
    showWelcomeScreen();
  }
}

// Handle Declare War
function handleDeclareWar() {
  const targetId = document.getElementById('warTargetSelect').value;
  if (!targetId) {
    alert('❌ Please select an opponent');
    return;
  }
  
  declareWar(targetId);
  hideWarModal();
}

// Show/Hide Screens
function showWelcomeScreen() {
  hideAllScreens();
  document.getElementById('welcomeScreen').classList.remove('hidden');
}

function showLobbyScreen() {
  hideAllScreens();
  document.getElementById('lobbyScreen').classList.remove('hidden');
}

function showGameScreen() {
  hideAllScreens();
  document.getElementById('gameScreen').classList.remove('hidden');
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
}

// Show/Hide Modals
function showWarModal() {
  document.getElementById('warModal').classList.remove('hidden');
  updateWarModal();
}

function hideWarModal() {
  document.getElementById('warModal').classList.add('hidden');
}

function showTradeModal() {
  document.getElementById('tradeModal').classList.remove('hidden');
  updateTradeModal();
}

function hideTradeModal() {
  document.getElementById('tradeModal').classList.add('hidden');
}

function showRebellionModal() {
  document.getElementById('rebellionModal').classList.remove('hidden');
  updateRebellionModal();
}

function hideRebellionModal() {
  document.getElementById('rebellionModal').classList.add('hidden');
}

// Update Lobby UI
function updateLobbyUI(game) {
  if (!game) return;
  
  // Update game code display
  document.getElementById('displayGameCode').textContent = game.code;
  document.getElementById('phaseDisplay').textContent = game.phase || 'SETUP';
  document.getElementById('roundDisplay').textContent = game.round || '-';
  
  // Update players list
  const playersList = document.getElementById('playersList');
  playersList.innerHTML = '';
  
  Object.values(game.players).forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    playerDiv.innerHTML = `
      <span class="player-name">${player.name}${player.isHost ? ' 👑' : ''}</span>
      <span class="player-status">${player.online ? '🟢' : '⚪'}</span>
    `;
    playersList.appendChild(playerDiv);
  });
  
  // Show/hide host controls
  if (isHost) {
    document.getElementById('hostControls').classList.remove('hidden');
  }
}

// Update Game UI
function updateGameUI(game) {
  if (!game || !currentPlayerId) return;
  
  const player = game.players[currentPlayerId];
  if (!player) return;
  
  // Update phase and round
  document.getElementById('gamePhase').textContent = game.phase;
  document.getElementById('gameRound').textContent = game.round;
  
  // Update player name
  document.getElementById('playerDashboardName').textContent = player.name;
  
  // Update stats
  document.getElementById('statUnrest').textContent = player.stats.unrest;
  document.getElementById('statEconomy').textContent = player.stats.economy;
  document.getElementById('statMilitary').textContent = player.stats.military;
  document.getElementById('statFood').textContent = player.stats.food;
  document.getElementById('statLuxury').textContent = player.stats.luxury;
  document.getElementById('statMorale').textContent = player.stats.morale;
  document.getElementById('statPopulation').textContent = player.stats.population;
  document.getElementById('statFarms').textContent = player.stats.farms;
  
  // Update hand display
  const handDisplay = document.getElementById('handDisplay');
  handDisplay.innerHTML = '';
  document.getElementById('handCount').textContent = player.hand.length;
  
  player.hand.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card card-${card.type}`;
    cardDiv.textContent = `${card.value}${card.suit}`;
    handDisplay.appendChild(cardDiv);
  });
  
  // Update action buttons based on phase
  const isStateActionsPhase = game.phase === 'STATE_ACTIONS';
  document.getElementById('actionBuyCard').disabled = !isStateActionsPhase || player.actions.boughtCard;
  document.getElementById('actionBuyFarm').disabled = !isStateActionsPhase || player.actions.boughtFarm;
  document.getElementById('actionBuyLuxury').disabled = !isStateActionsPhase || player.actions.boughtLuxury;
  document.getElementById('actionReduceUnrest').disabled = !isStateActionsPhase || player.actions.reducedUnrest;
  document.getElementById('actionWar').disabled = !isStateActionsPhase;
  document.getElementById('actionTrade').disabled = !isStateActionsPhase;
  
  // Update action hint
  const hintText = isStateActionsPhase ? 
    'Take your actions for this round' : 
    `Current phase: ${game.phase}`;
  document.getElementById('actionHint').textContent = hintText;
  
  // Show/hide host controls
  if (isHost) {
    document.getElementById('gameHostControls').classList.remove('hidden');
  }
  
  // Update other players list
  const otherPlayersList = document.getElementById('otherPlayersList');
  otherPlayersList.innerHTML = '';
  
  Object.values(game.players).forEach(p => {
    if (p.id === currentPlayerId) return;
    
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    playerDiv.innerHTML = `
      <div class="player-name">${p.name}${p.collapsed ? ' ⚠️ COLLAPSED' : ''}</div>
      <div class="player-stats-mini">
        <span>📊 ${p.stats.economy}E ${p.stats.military}M</span>
        <span>🔥 ${p.stats.unrest}U</span>
      </div>
    `;
    otherPlayersList.appendChild(playerDiv);
  });
  
  // Check for victory
  if (game.gameOver) {
    showVictoryBanner(game);
  }
}

// Update War Modal
function updateWarModal() {
  if (!currentGame || !currentPlayerId) return;
  
  const player = currentGame.players[currentPlayerId];
  
  // Update target select
  const targetSelect = document.getElementById('warTargetSelect');
  targetSelect.innerHTML = '<option value="">Select opponent...</option>';
  
  Object.values(currentGame.players).forEach(p => {
    if (p.id !== currentPlayerId && !p.collapsed) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      targetSelect.appendChild(option);
    }
  });
  
  // Update active wars list
  const warsList = document.getElementById('activeWarsList');
  warsList.innerHTML = '';
  
  if (player.wars && Object.keys(player.wars).length > 0) {
    Object.values(player.wars).forEach(war => {
      const warDiv = document.createElement('div');
      warDiv.className = 'war-item';
      warDiv.innerHTML = `
        <strong>vs ${war.targetName}</strong>
        <div>War Track: ${war.track}/7</div>
      `;
      warsList.appendChild(warDiv);
    });
  } else {
    warsList.innerHTML = '<p class="hint">No active wars</p>';
  }
}

// Update Trade Modal
function updateTradeModal() {
  if (!currentGame || !currentPlayerId) return;
  
  // Update target select
  const targetSelect = document.getElementById('tradeTargetSelect');
  targetSelect.innerHTML = '<option value="">Select player...</option>';
  
  Object.values(currentGame.players).forEach(p => {
    if (p.id !== currentPlayerId && !p.collapsed) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      targetSelect.appendChild(option);
    }
  });
  
  // Update received trades (simplified - full implementation would need more DB structure)
  const tradesList = document.getElementById('receivedTradesList');
  tradesList.innerHTML = '<p class="hint">No trade offers</p>';
}

// Update Rebellion Modal
function updateRebellionModal() {
  if (!currentGame || !currentPlayerId) return;
  
  const player = currentGame.players[currentPlayerId];
  
  if (player.rebellion) {
    document.getElementById('rebellionStatus').textContent = 'Active Rebellion!';
    document.getElementById('rebellionDetails').classList.remove('hidden');
    document.getElementById('rebellionTrackValue').textContent = player.rebellion.track;
    document.getElementById('rebellionStage').textContent = player.rebellion.stage;
  } else {
    document.getElementById('rebellionStatus').textContent = 'No active rebellion';
    document.getElementById('rebellionDetails').classList.add('hidden');
  }
}

// Show Victory Banner
function showVictoryBanner(game) {
  const banner = document.getElementById('victoryBanner');
  const message = document.getElementById('victoryMessage');
  
  if (game.winner) {
    message.textContent = `${game.winnerName} has won the game!`;
  } else if (game.draw) {
    message.textContent = 'All civilizations have collapsed!';
  }
  
  banner.classList.remove('hidden');
}

console.log('✅ Civilization Online UI initialized');
