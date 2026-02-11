// main.js - UI Controller for Civilization Online
'use strict';

import {
  initFirebase,
  createGame,
  joinGame,
  startGame,
  advancePhase,
  buyCard,
  playCard,
  buyFarm,
  buyLuxury,
  reduceUnrest,
  declareWar,
  playEmergencyCard,  // Play emergency cards
  sendTradeOffer,
  acceptTradeOffer,
  rejectTradeOffer,
  foreignInterference,
  listenToGameState,
  stopListeningToGameState,
  leaveGame,
  getCurrentGameCode,
  getCurrentPlayerId,
  getCurrentPlayerName,
  getIsHost,
  getMaxActions,  // Import helper to check action limits
  CREATOR_KEY
} from './game.js';

// UI State
let currentGame = null;

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
    
    // Listen to game state to verify game still exists
    listenToGameState(savedGameCode, (game) => {
      if (game && game.players && game.players[savedPlayerId]) {
        currentGame = game;
        
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
  document.getElementById('actionEmergencyCard').addEventListener('click', () => playEmergencyCard());
  document.getElementById('actionWar').addEventListener('click', showWarModal);
  document.getElementById('actionTrade').addEventListener('click', showTradeModal);
  document.getElementById('btnAdvancePhase').addEventListener('click', () => advancePhase());
  document.getElementById('leaveGameBtn2').addEventListener('click', handleLeaveGame);
  
  // Modals
  document.getElementById('closeWarModal').addEventListener('click', hideWarModal);
  document.getElementById('closeTradeModal').addEventListener('click', hideTradeModal);
  document.getElementById('closeRebellionModal').addEventListener('click', hideRebellionModal);
  document.getElementById('closeDiceResultModal').addEventListener('click', hideDiceResultModal);
  document.getElementById('btnDeclareWar').addEventListener('click', handleDeclareWar);
  document.getElementById('btnSendTrade').addEventListener('click', handleSendTrade);
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
  if (!getIsHost()) return;
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

// Handle Send Trade
function handleSendTrade() {
  const targetId = document.getElementById('tradeTargetSelect').value;
  if (!targetId) {
    alert('❌ Please select a player');
    return;
  }
  
  const offer = {
    economy: parseInt(document.getElementById('offerEconomy').value) || 0,
    food: parseInt(document.getElementById('offerFood').value) || 0,
    luxury: parseInt(document.getElementById('offerLuxury').value) || 0
  };
  
  const request = {
    economy: parseInt(document.getElementById('requestEconomy').value) || 0,
    food: parseInt(document.getElementById('requestFood').value) || 0,
    luxury: parseInt(document.getElementById('requestLuxury').value) || 0
  };
  
  if (offer.economy === 0 && offer.food === 0 && offer.luxury === 0) {
    alert('❌ You must offer something');
    return;
  }
  
  if (request.economy === 0 && request.food === 0 && request.luxury === 0) {
    alert('❌ You must request something');
    return;
  }
  
  sendTradeOffer(targetId, offer, request);
  
  // Clear inputs
  document.getElementById('offerEconomy').value = '';
  document.getElementById('offerFood').value = '';
  document.getElementById('offerLuxury').value = '';
  document.getElementById('requestEconomy').value = '';
  document.getElementById('requestFood').value = '';
  document.getElementById('requestLuxury').value = '';
  
  hideTradeModal();
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

function showDiceResultModal(title, content) {
  const modal = document.getElementById('diceResultModal');
  const contentDiv = document.getElementById('diceResultContent');
  contentDiv.innerHTML = `<h3>${title}</h3>${content}`;
  modal.classList.remove('hidden');
}

function hideDiceResultModal() {
  document.getElementById('diceResultModal').classList.add('hidden');
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
  if (getIsHost()) {
    document.getElementById('hostControls').classList.remove('hidden');
  }
}

// Update Game UI
function updateGameUI(game) {
  if (!game) return;
  
  const playerId = getCurrentPlayerId();
  if (!playerId) return;
  
  const player = game.players[playerId];
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
  document.getElementById('statEmergencyCards').textContent = player.emergencyCards || 0;
  
  // Update hand display
  const handDisplay = document.getElementById('handDisplay');
  handDisplay.innerHTML = '';
  document.getElementById('handCount').textContent = player.hand.length;
  
  const isCleanupPhase = game.phase === 'CLEANUP';
  
  player.hand.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card card-${card.type}`;
    cardDiv.textContent = `${card.value}${card.suit}`;
    
    if (isCleanupPhase) {
      cardDiv.style.cursor = 'pointer';
      cardDiv.title = 'Click to discard this card';
      cardDiv.addEventListener('click', () => {
        if (confirm(`Discard ${card.value}${card.suit}?`)) {
          playCard(index);
        }
      });
    } else {
      cardDiv.style.cursor = 'default';
      cardDiv.title = 'Cards can only be discarded during CLEANUP phase';
    }
    
    handDisplay.appendChild(cardDiv);
  });
  
  // Update action buttons based on phase and action limits
  const isStateActionsPhase = game.phase === 'STATE_ACTIONS';
  const maxActions = getMaxActions(player.stats.unrest);
  const actionsUsed = player.actions.actionsUsed || 0;
  const canTakeMoreActions = actionsUsed < maxActions;
  
  document.getElementById('actionBuyCard').disabled = !isStateActionsPhase || !canTakeMoreActions || player.actions.boughtCard;
  document.getElementById('actionBuyFarm').disabled = !isStateActionsPhase || !canTakeMoreActions || player.actions.boughtFarm;
  document.getElementById('actionBuyLuxury').disabled = !isStateActionsPhase || !canTakeMoreActions || player.actions.boughtLuxury;
  document.getElementById('actionReduceUnrest').disabled = !isStateActionsPhase || !canTakeMoreActions || player.actions.reducedUnrest;
  
  // Emergency card button: requires card available and not used this round
  const hasEmergencyCards = (player.emergencyCards || 0) > 0;
  const alreadyUsedEmergencyCard = player.emergencyCardUsedThisRound;
  document.getElementById('actionEmergencyCard').disabled = !isStateActionsPhase || !canTakeMoreActions || alreadyUsedEmergencyCard || !hasEmergencyCards;
  
  document.getElementById('actionWar').disabled = !isStateActionsPhase || !canTakeMoreActions;
  document.getElementById('actionTrade').disabled = !isStateActionsPhase || !canTakeMoreActions;
  
  // Update action hint
  let hintText = '';
  
  switch(game.phase) {
    case 'UPKEEP':
      hintText = '⏳ UPKEEP: Food production, morale and population calculated automatically';
      break;
    case 'INTERNAL_PRESSURE':
      hintText = '⚠️ INTERNAL_PRESSURE: Unrest increases are being applied';
      break;
    case 'STATE_ACTIONS':
      const actionsRemaining = maxActions - actionsUsed;
      hintText = `🎯 STATE_ACTIONS: Take your actions for this round! (${actionsRemaining}/${maxActions} actions remaining)`;
      if (player.stats.unrest >= 30) {
        hintText += ' ⚠️ High unrest limiting actions!';
      }
      break;
    case 'WAR':
      hintText = '⚔️ WAR: Battles are being resolved automatically';
      break;
    case 'REBELLION':
      hintText = '🔥 REBELLION: Rebellions are being resolved automatically';
      break;
    case 'NATURAL_EVENTS':
      hintText = '🌍 NATURAL_EVENTS: Random events may occur';
      break;
    case 'CLEANUP':
      hintText = '🧹 CLEANUP: Discard cards if over hand limit (10 cards)';
      break;
    default:
      hintText = `Current phase: ${game.phase}`;
  }
  
  // Add natural event info if present
  if (game.lastNaturalEvent && game.lastNaturalEvent.round === game.round) {
    const event = game.lastNaturalEvent;
    const eventEmojis = {
      drought: '🌵',
      plague: '🦠',
      earthquake: '🌋',
      flood: '🌊'
    };
    hintText += ` | ${eventEmojis[event.event] || '⚠️'} ${event.event.toUpperCase()} affected ${event.targetName}`;
  }
  
  document.getElementById('actionHint').textContent = hintText;
  
  // Show/hide host controls
  if (getIsHost()) {
    document.getElementById('gameHostControls').classList.remove('hidden');
  }
  
  // Update other players list
  const otherPlayersList = document.getElementById('otherPlayersList');
  otherPlayersList.innerHTML = '';
  
  Object.values(game.players).forEach(p => {
    if (p.id === playerId) return;
    
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
  } else if (game.victoryCountdown) {
    showVictoryCountdown(game.victoryCountdown);
  } else {
    hideVictoryCountdown();
  }
  
  // Check for and display dice results from rebellion or war
  // Note: These are displayed once when the modal data is first seen
  // The data will be overwritten on the next roll naturally
  if (player.rebellion && player.rebellion.lastDiceRoll) {
    const roll = player.rebellion.lastDiceRoll;
    // Only show if we haven't shown this exact roll before
    if (!window._lastRebellionRollShown || window._lastRebellionRollShown !== `${roll.rebelTotal}-${roll.govTotal}`) {
      window._lastRebellionRollShown = `${roll.rebelTotal}-${roll.govTotal}`;
      const content = `
        <div style="margin: 20px 0;">
          <p><strong>🎲 Rebellion Dice Battle</strong></p>
          <div style="display: flex; justify-content: space-around; margin: 15px 0;">
            <div style="text-align: center;">
              <div style="font-size: 24px;">👥</div>
              <div><strong>Rebels</strong></div>
              <div>${roll.rebelDice} dice: ${roll.rebelRolls.join(', ')}</div>
              <div style="font-size: 20px; margin-top: 5px;"><strong>Total: ${roll.rebelTotal}</strong></div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px;">🛡️</div>
              <div><strong>Government</strong></div>
              <div>${roll.govDice} dice: ${roll.govRolls.join(', ')}</div>
              <div style="font-size: 20px; margin-top: 5px;"><strong>Total: ${roll.govTotal}</strong></div>
            </div>
          </div>
          <div style="text-align: center; font-size: 18px; margin-top: 15px;">
            <strong>${roll.winner === 'rebels' ? '👥 Rebels Win!' : '🛡️ Government Wins!'}</strong>
          </div>
        </div>
      `;
      showDiceResultModal('Rebellion Battle Results', content);
    }
  }
  
  // Check for war battle results
  if (player.wars) {
    Object.entries(player.wars).forEach(([targetId, war]) => {
      if (war.lastBattle && war.lastBattle.trackChange !== undefined) {
        // Only show if we haven't shown this exact battle before
        const battleKey = `${targetId}-${war.lastBattle.attackerMilitary}-${war.lastBattle.defenderMilitary}-${war.lastBattle.casualtyRoll}`;
        if (!window._lastBattleShown || window._lastBattleShown !== battleKey) {
          window._lastBattleShown = battleKey;
          const battle = war.lastBattle;
          const targetPlayer = game.players[targetId];
          const content = `
            <div style="margin: 20px 0;">
              <p><strong>⚔️ Battle Results vs ${targetPlayer ? targetPlayer.name : 'Unknown'}</strong></p>
              <div style="display: flex; justify-content: space-around; margin: 15px 0;">
                <div style="text-align: center;">
                  <div style="font-size: 24px;">⚔️</div>
                  <div><strong>Attacker (You)</strong></div>
                  <div>Military: ${battle.attackerMilitary}</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 24px;">🛡️</div>
                  <div><strong>Defender</strong></div>
                  <div>Military: ${battle.defenderMilitary}</div>
                </div>
              </div>
              ${battle.casualtyRoll > 0 ? `
                <div style="text-align: center; margin: 15px 0;">
                  <p><strong>🎲 Casualty Roll: ${battle.casualtyRoll}</strong></p>
                  <p>${battle.cardsLost} military card(s) lost</p>
                </div>
              ` : ''}
              <div style="text-align: center; font-size: 18px; margin-top: 15px;">
                <strong>${battle.winner === 'attacker' ? '⚔️ Victory!' : battle.winner === 'defender' ? '🛡️ Defeated!' : '⚖️ Draw!'}</strong>
                <p>War track ${battle.trackChange > 0 ? 'increased' : battle.trackChange < 0 ? 'decreased' : 'unchanged'}</p>
              </div>
            </div>
          `;
          showDiceResultModal('Battle Results', content);
        }
      }
    });
  }
  
  // Check for luxury purchase dice roll
  if (player.lastLuxuryRoll !== undefined && player.lastLuxuryRoll !== null) {
    // Only show if we haven't shown this exact roll before
    if (!window._lastLuxuryRollShown || window._lastLuxuryRollShown !== player.lastLuxuryRoll) {
      window._lastLuxuryRollShown = player.lastLuxuryRoll;
      const content = `
        <div style="margin: 20px 0; text-align: center;">
          <div style="font-size: 48px; margin: 20px 0;">🎲</div>
          <p style="font-size: 24px;"><strong>You rolled: ${player.lastLuxuryRoll}</strong></p>
          <p style="font-size: 18px; margin-top: 15px;">+${player.lastLuxuryRoll} Luxury added to your civilization!</p>
        </div>
      `;
      showDiceResultModal('Luxury Purchase', content);
    }
  }
}

// Show Victory Countdown
function showVictoryCountdown(countdown) {
  const banner = document.getElementById('victoryBanner');
  const message = document.getElementById('victoryMessage');
  
  message.textContent = `🏁 ${countdown.winnerName} is the last standing! Must survive ${countdown.roundsRemaining} more round(s) to win!`;
  banner.classList.remove('hidden');
}

// Hide Victory Countdown
function hideVictoryCountdown() {
  const banner = document.getElementById('victoryBanner');
  banner.classList.add('hidden');
}

// Update War Modal
function updateWarModal() {
  if (!currentGame) return;
  
  const playerId = getCurrentPlayerId();
  if (!playerId) return;
  
  const player = currentGame.players[playerId];
  
  // Update target select
  const targetSelect = document.getElementById('warTargetSelect');
  targetSelect.innerHTML = '<option value="">Select opponent...</option>';
  
  Object.values(currentGame.players).forEach(p => {
    if (p.id !== playerId && !p.collapsed) {
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

// Make trade functions available globally for onclick handlers
window.acceptTrade = (tradeId) => {
  acceptTradeOffer(tradeId);
};

window.rejectTrade = (tradeId) => {
  rejectTradeOffer(tradeId);
};

// Helper function to format resources for display
function formatResources(resources) {
  const parts = [];
  if (resources.food) parts.push(`${resources.food} Food`);
  if (resources.luxury) parts.push(`${resources.luxury} Luxury`);
  if (resources.economy) parts.push(`${resources.economy} Economy`);
  return parts.join(', ') || 'Nothing';
}

// Update Trade Modal
function updateTradeModal() {
  if (!currentGame) return;
  
  const playerId = getCurrentPlayerId();
  if (!playerId) return;
  
  // Update target select
  const targetSelect = document.getElementById('tradeTargetSelect');
  targetSelect.innerHTML = '<option value="">Select player...</option>';
  
  Object.values(currentGame.players).forEach(p => {
    if (p.id !== playerId && !p.collapsed) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      targetSelect.appendChild(option);
    }
  });
  
  // Update received trades
  const tradesList = document.getElementById('receivedTradesList');
  tradesList.innerHTML = '';
  
  const pendingTrades = Object.values(currentGame.tradeOffers || {}).filter(
    trade => trade.toId === playerId && trade.status === 'pending'
  );
  
  if (pendingTrades.length === 0) {
    tradesList.innerHTML = '<p class="hint">No trade offers</p>';
  } else {
    pendingTrades.forEach(trade => {
      const tradeDiv = document.createElement('div');
      tradeDiv.className = 'trade-offer';
      tradeDiv.innerHTML = `
        <p><strong>From ${trade.fromName}:</strong></p>
        <p>Offers: ${formatResources(trade.offer)}</p>
        <p>Requests: ${formatResources(trade.request)}</p>
        <button class="btn btn-success" onclick="window.acceptTrade('${trade.id}')">Accept</button>
        <button class="btn btn-danger" onclick="window.rejectTrade('${trade.id}')">Reject</button>
      `;
      tradesList.appendChild(tradeDiv);
    });
  }
}

// Update Rebellion Modal
function updateRebellionModal() {
  if (!currentGame) return;
  
  const playerId = getCurrentPlayerId();
  if (!playerId) return;
  
  const player = currentGame.players[playerId];
  
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
