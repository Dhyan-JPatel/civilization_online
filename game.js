// game.js - Core game logic for Civilization Online
'use strict';

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get, update, onValue, runTransaction, push, remove, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Constants
const CREATOR_KEY = 'abcd';
const PHASES = ['UPKEEP', 'INTERNAL_PRESSURE', 'STATE_ACTIONS', 'WAR', 'REBELLION', 'NATURAL_EVENTS', 'CLEANUP'];

// Global state
let app;
let db;
let currentGameCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let isHost = false;
let gameStateListener = null;

// Initialize Firebase
function initFirebase() {
  const config = window.__FIREBASE_CONFIG__ || {
    apiKey: 'AIzaSyB60cn2DLhu_VzhprtZ5x_SSzfcfjKzfVk',
    authDomain: 'civilization-game-efa6b.firebaseapp.com',
    databaseURL: 'https://civilization-game-efa6b-default-rtdb.firebaseio.com',
    projectId: 'civilization-game-efa6b',
    storageBucket: 'civilization-game-efa6b.firebasestorage.app',
    messagingSenderId: '786254154239',
    appId: '1:786254154239:web:9320036b347a64f9567fca'
  };

  try {
    app = initializeApp(config);
    db = getDatabase(app);
    console.log('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    alert('Failed to initialize Firebase. Please check configuration.');
    return false;
  }
}

// Generate random 5-character game code
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate unique player ID
function generatePlayerId() {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

// Create a new deck of cards
function createDeck() {
  const suits = ['♠', '♣', '♥', '♦'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (const suit of suits) {
    for (const value of values) {
      const isRed = suit === '♥' || suit === '♦';
      const cardValue = value === 'A' ? 1 : (value === 'J' || value === 'Q' || value === 'K' ? 10 : parseInt(value));
      deck.push({
        suit,
        value,
        numValue: cardValue,
        type: isRed ? 'economy' : 'military',
        id: `${suit}${value}`
      });
    }
  }
  
  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

// Create Game
async function createGame(playerName, enableNaturalEvents = true) {
  if (!db) {
    alert('Firebase not initialized');
    return null;
  }

  const gameCode = generateGameCode();
  const playerId = generatePlayerId();
  const deck = createDeck();
  const hand = deck.slice(0, 4);
  const remainingDeck = deck.slice(4);

  const gameData = {
    code: gameCode,
    host: playerId,
    phase: 'SETUP',
    round: 0,
    locked: false,
    naturalEventsEnabled: enableNaturalEvents,
    started: false,
    createdAt: Date.now(),
    turnOrder: [playerId],  // Track player order for turn-based play
    currentTurnIndex: 0,  // Index in turnOrder for current player's turn
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        isHost: true,
        online: true,
        lastSeen: Date.now(),
        stats: {
          unrest: 0,
          economy: 0,
          military: 0,
          food: 0,
          luxury: 0,
          morale: 0,
          population: 0,
          farms: 1
        },
        hand: hand,
        deck: remainingDeck,
        discardPile: [],
        emergencyCards: 2,  // Each player starts with 2 emergency cards
        emergencyCardUsedThisRound: false,  // Track if emergency card used this round
        actions: {
          boughtCard: false,
          boughtFarm: false,
          boughtLuxury: false,
          reducedUnrest: false,
          declaredWar: false,
          traded: false,
          actionsUsed: 0  // Track total actions used this round
        },
        wars: {},
        militaryAssignments: {
          // Tracks military cards assigned to roles during war
          // Key: opponent player ID, Value: { frontline: [cardIndices], garrison: [cardIndices], reserve: [cardIndices] }
        },
        rebellion: null,
        collapsed: false
      }
    }
  };

  try {
    await set(ref(db, `games/${gameCode}`), gameData);
    
    // Set module-level state
    currentGameCode = gameCode;
    currentPlayerId = playerId;
    currentPlayerName = playerName;
    isHost = true;
    
    // Store in localStorage for reconnection
    localStorage.setItem('currentGameCode', gameCode);
    localStorage.setItem('currentPlayerId', playerId);
    localStorage.setItem('currentPlayerName', playerName);
    
    console.log(`✅ Game created: ${gameCode}`);
    return { gameCode, playerId, playerName };
  } catch (error) {
    console.error('❌ Failed to create game:', error);
    alert('Failed to create game: ' + error.message);
    return null;
  }
}

// Join Game
async function joinGame(gameCode, playerName) {
  if (!db) {
    alert('Firebase not initialized');
    return null;
  }

  const gameRef = ref(db, `games/${gameCode}`);
  
  try {
    const result = await runTransaction(gameRef, (game) => {
      if (!game) {
        throw new Error('Game not found');
      }
      
      if (game.started) {
        throw new Error('Game already started');
      }
      
      const playerCount = Object.keys(game.players || {}).length;
      if (playerCount >= 6) {
        throw new Error('Game is full (max 6 players)');
      }
      
      const playerId = generatePlayerId();
      const deck = createDeck();
      const hand = deck.slice(0, 4);
      const remainingDeck = deck.slice(4);
      
      game.players[playerId] = {
        id: playerId,
        name: playerName,
        isHost: false,
        online: true,
        lastSeen: Date.now(),
        stats: {
          unrest: 0,
          economy: 0,
          military: 0,
          food: 0,
          luxury: 0,
          morale: 0,
          population: 0,
          farms: 1
        },
        hand: hand,
        deck: remainingDeck,
        discardPile: [],
        emergencyCards: 2,  // Each player starts with 2 emergency cards
        emergencyCardUsedThisRound: false,  // Track if emergency card used this round
        actions: {
          boughtCard: false,
          boughtFarm: false,
          boughtLuxury: false,
          reducedUnrest: false,
          declaredWar: false,
          traded: false,
          actionsUsed: 0  // Track total actions used this round
        },
        wars: {},
        militaryAssignments: {
          // Tracks military cards assigned to roles during war
          // Key: opponent player ID, Value: { frontline: [cardIndices], garrison: [cardIndices], reserve: [cardIndices] }
        },
        rebellion: null,
        collapsed: false
      };
      
      // Add player to turn order
      if (!game.turnOrder) {
        game.turnOrder = [];
      }
      game.turnOrder.push(playerId);
      
      return game;
    });
    
    // Find the player ID we just created (it's the newest one)
    const players = result.snapshot.val().players;
    const newPlayerId = Object.keys(players).find(pid => {
      const p = players[pid];
      return p.name === playerName && !p.isHost;
    });
    
    // Set module-level state
    currentGameCode = gameCode;
    currentPlayerId = newPlayerId;
    currentPlayerName = playerName;
    isHost = false;
    
    // Store in localStorage for reconnection
    localStorage.setItem('currentGameCode', gameCode);
    localStorage.setItem('currentPlayerId', newPlayerId);
    localStorage.setItem('currentPlayerName', playerName);
    
    console.log(`✅ Joined game: ${gameCode}`);
    return { gameCode, playerId: newPlayerId, playerName };
  } catch (error) {
    console.error('❌ Failed to join game:', error);
    alert('Failed to join game: ' + error.message);
    return null;
  }
}

// Start Game
async function startGame() {
  if (!db || !currentGameCode || !isHost) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await update(gameRef, {
      started: true,
      phase: 'UPKEEP',
      round: 1
    });
    
    // Perform initial upkeep calculations
    await performUpkeep();
    
    console.log('✅ Game started');
  } catch (error) {
    console.error('❌ Failed to start game:', error);
    alert('Failed to start game: ' + error.message);
  }
}

// Calculate Economy (sum of red cards)
function calculateEconomy(hand) {
  return hand.filter(card => card.type === 'economy').reduce((sum, card) => sum + card.numValue, 0);
}

// Calculate Military (sum of black cards)
function calculateMilitary(hand) {
  return hand.filter(card => card.type === 'military').reduce((sum, card) => sum + card.numValue, 0);
}

// Calculate Morale
function calculateMorale(luxury, food) {
  return luxury + Math.floor(food / 2);
}

// Calculate Population
function calculatePopulation(luxury, food, morale, military) {
  const moraleDivisor = Math.max(1, (morale / 10) + 1); // Ensure divisor is at least 1
  return Math.floor((luxury * Math.sqrt(food)) / moraleDivisor) + military;
}

// Calculate Assigned Military Strength
function calculateAssignedMilitary(player, targetPlayerId) {
  // If player has military assignments for this war, calculate from assigned cards
  // Otherwise, use total military (backward compatibility for ongoing wars)
  if (!player.militaryAssignments || !player.militaryAssignments[targetPlayerId]) {
    return player.stats.military;
  }
  
  const assignments = player.militaryAssignments[targetPlayerId];
  let strength = 0;
  
  // Add frontline and reserve to battle strength (garrison doesn't participate unless needed)
  const combatCards = [...assignments.frontline, ...assignments.reserve];
  
  for (const cardIndex of combatCards) {
    if (cardIndex >= 0 && cardIndex < player.hand.length) {
      const card = player.hand[cardIndex];
      if (card.type === 'military') {
        strength += card.numValue;
      }
    }
  }
  
  return strength;
}

// Remove Casualties from Assigned Military
function removeCasualties(player, targetPlayerId, cardsToRemove) {
  // If no assignments, remove randomly as before
  if (!player.militaryAssignments || !player.militaryAssignments[targetPlayerId]) {
    for (let i = 0; i < cardsToRemove; i++) {
      const militaryCardIndex = player.hand.findIndex(c => c.type === 'military' && !c.locked);
      if (militaryCardIndex !== -1) {
        const removedCard = player.hand.splice(militaryCardIndex, 1)[0];
        if (!player.discardPile) player.discardPile = [];
        player.discardPile.push(removedCard);
      }
    }
    return;
  }
  
  const assignments = player.militaryAssignments[targetPlayerId];
  let removed = 0;
  
  // Remove from frontline first
  while (removed < cardsToRemove && assignments.frontline.length > 0) {
    // Always remove from end since we're modifying indices
    const cardIndex = assignments.frontline.pop();
    if (cardIndex >= 0 && cardIndex < player.hand.length) {
      const removedCard = player.hand.splice(cardIndex, 1)[0];
      if (!player.discardPile) player.discardPile = [];
      player.discardPile.push(removedCard);
      removed++;
      
      // Adjust remaining indices that are higher than removed index
      const adjustIndices = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] > cardIndex) arr[i]--;
        }
      };
      adjustIndices(assignments.frontline);
      adjustIndices(assignments.garrison);
      adjustIndices(assignments.reserve);
    }
  }
  
  // Then remove from reserve
  while (removed < cardsToRemove && assignments.reserve.length > 0) {
    const cardIndex = assignments.reserve.pop();
    if (cardIndex >= 0 && cardIndex < player.hand.length) {
      const removedCard = player.hand.splice(cardIndex, 1)[0];
      if (!player.discardPile) player.discardPile = [];
      player.discardPile.push(removedCard);
      removed++;
      
      const adjustIndices = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] > cardIndex) arr[i]--;
        }
      };
      adjustIndices(assignments.frontline);
      adjustIndices(assignments.garrison);
      adjustIndices(assignments.reserve);
    }
  }
  
  // Finally, if still need to remove more, take from garrison (all lost scenario)
  while (removed < cardsToRemove && assignments.garrison.length > 0) {
    const cardIndex = assignments.garrison.pop();
    if (cardIndex >= 0 && cardIndex < player.hand.length) {
      const removedCard = player.hand.splice(cardIndex, 1)[0];
      if (!player.discardPile) player.discardPile = [];
      player.discardPile.push(removedCard);
      removed++;
      
      const adjustIndices = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] > cardIndex) arr[i]--;
        }
      };
      adjustIndices(assignments.frontline);
      adjustIndices(assignments.garrison);
      adjustIndices(assignments.reserve);
    }
  }
}

// Calculate Maximum Allowed Actions (based on unrest level and rebellion stage)
function getMaxActions(player) {
  // Rulebook: "You may take up to 2 State Actions, minus penalties"
  // "30+ Unrest – Lose 1 State Action"
  // "Stage 1 Rebellion: Lose 1 State Action"
  let maxActions = 2;
  
  if (player.stats.unrest >= 30) {
    maxActions = 1; // Lost 1 action due to high unrest
  }
  
  // Rebellion Stage 1: Lose 1 State Action (per manual line 167)
  if (player.rebellion && player.rebellion.stage === 1) {
    maxActions = Math.max(0, maxActions - 1);
  }
  
  return maxActions;
}

// Validate Action Limit (helper for action functions)
function validateActionLimit(player) {
  const maxActions = getMaxActions(player);
  if (player.actions.actionsUsed >= maxActions) {
    throw new Error(`Cannot perform more actions this round (max ${maxActions} due to unrest/rebellion)`);
  }
}

// Release Locked Military Cards for a War
function releaseLockedCards(player, targetPlayerId) {
  if (!player.militaryAssignments || !player.militaryAssignments[targetPlayerId]) {
    return;
  }
  
  const assignments = player.militaryAssignments[targetPlayerId];
  const allAssignments = [...assignments.frontline, ...assignments.garrison, ...assignments.reserve];
  
  // Unlock all cards assigned to this war
  for (const cardIndex of allAssignments) {
    if (cardIndex >= 0 && cardIndex < player.hand.length) {
      const card = player.hand[cardIndex];
      if (card.lockedFor === targetPlayerId) {
        delete card.locked;
        delete card.lockedFor;
        delete card.role;
      }
    }
  }
  
  // Clear the assignments
  delete player.militaryAssignments[targetPlayerId];
}

// Consume Economy Cards (helper for buy actions)
function consumeEconomy(player, amount) {
  if (!player.discardPile) {
    player.discardPile = [];
  }
  
  let economyNeeded = amount;
  for (let i = player.hand.length - 1; i >= 0 && economyNeeded > 0; i--) {
    const card = player.hand[i];
    if (card.type === 'economy') {
      const cardValue = card.numValue;
      const removed = player.hand.splice(i, 1)[0];
      player.discardPile.push(removed);
      economyNeeded -= cardValue;
    }
  }
}

// Perform Upkeep Phase
async function performUpkeep() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      for (const playerId in game.players) {
        const player = game.players[playerId];
        if (player.collapsed) continue;
        
        // Food production (20 per farm, unless sieged)
        const isSieged = Object.values(player.wars || {}).some(war => war.track >= 3);
        if (!isSieged) {
          const foodProduction = player.stats.farms * 20;
          // Check for drought effect
          if (player.droughtNextRound) {
            player.stats.food += Math.floor(foodProduction / 2);
            player.droughtNextRound = false;
          } else {
            player.stats.food += foodProduction;
          }
        }
        
        // Calculate stats
        player.stats.economy = calculateEconomy(player.hand);
        player.stats.military = calculateMilitary(player.hand);
        player.stats.morale = calculateMorale(player.stats.luxury, player.stats.food);
        player.stats.population = calculatePopulation(
          player.stats.luxury,
          player.stats.food,
          player.stats.morale,
          player.stats.military
        );
        
        // Population pressure unrest
        const pop = player.stats.population;
        if (pop >= 100) {
          player.stats.unrest += 10;
        } else if (pop >= 75) {
          player.stats.unrest += 7;
        } else if (pop >= 50) {
          player.stats.unrest += 4;
        } else if (pop >= 30) {
          player.stats.unrest += 2;
        }
      }
      
      return game;
    });
    
    console.log('✅ Upkeep completed');
  } catch (error) {
    console.error('❌ Upkeep failed:', error);
  }
}

// Perform Internal Pressure Phase
async function performInternalPressure() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      for (const playerId in game.players) {
        const player = game.players[playerId];
        if (player.collapsed) continue;
        
        // Food stress - if-else ensures only one penalty applies
        // Per manual lines 74-75, but thresholds appear swapped (likely typo):
        // Logical interpretation: More food shortage = more unrest
        // Critical shortage (< pop × 2): +10 unrest
        // Moderate shortage (< pop × 4 but >= pop × 2): +5 unrest
        if (player.stats.food < player.stats.population * 2) {
          player.stats.unrest += 10; // Critical shortage
        } else if (player.stats.food < player.stats.population * 4) {
          player.stats.unrest += 5; // Moderate shortage
        }
        
        // Siege pressure
        const isSieged = Object.values(player.wars || {}).some(war => war.track >= 3);
        if (isSieged) {
          player.stats.unrest += 8;
        }
        
        // Economic Collapse Pressure - add +10 unrest if no economy cards
        const economyCards = player.hand.filter(card => card.type === 'economy');
        if (economyCards.length === 0) {
          player.stats.unrest += 10;
        }
        
        // Trigger rebellion if unrest >= 100
        if (player.stats.unrest >= 100 && !player.rebellion) {
          player.rebellion = {
            track: 2,
            stage: 1
          };
        }
      }
      
      return game;
    });
    
    console.log('✅ Internal pressure completed');
  } catch (error) {
    console.error('❌ Internal pressure failed:', error);
  }
}

// Reset actions for STATE_ACTIONS phase
async function resetActions() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    const snapshot = await get(gameRef);
    const game = snapshot.val();
    
    if (!game) return;
    
    const updates = {};
    for (const playerId in game.players) {
      updates[`players/${playerId}/actions`] = {
        boughtCard: false,
        boughtFarm: false,
        boughtLuxury: false,
        reducedUnrest: false,
        declaredWar: false,
        traded: false,
        actionsUsed: 0  // Reset action counter each round
      };
      updates[`players/${playerId}/emergencyCardUsedThisRound`] = false;  // Reset emergency card flag
      updates[`players/${playerId}/interferenceThisRound`] = {};
      updates[`players/${playerId}/lastLuxuryRoll`] = null; // Clear stale dice result
    }
    
    // Reset to first non-collapsed player's turn when STATE_ACTIONS phase begins
    let startIndex = 0;
    if (game.turnOrder && game.turnOrder.length > 0) {
      // Find first non-collapsed player
      for (let i = 0; i < game.turnOrder.length; i++) {
        const playerId = game.turnOrder[i];
        const player = game.players[playerId];
        if (player && !player.collapsed) {
          startIndex = i;
          break;
        }
      }
    }
    updates.currentTurnIndex = startIndex;
    
    await update(gameRef, updates);
    
    console.log('✅ Actions reset and turn set to first active player');
  } catch (error) {
    console.error('❌ Failed to reset actions:', error);
  }
}

// Check if it's the current player's turn
function isPlayerTurn(game, playerId) {
  if (!game || !game.turnOrder || !playerId) {
    return false;
  }
  
  // During STATE_ACTIONS phase, only current turn player can act
  if (game.phase === 'STATE_ACTIONS') {
    // Get the current turn player (handling collapsed players)
    const currentTurnPlayerId = getCurrentTurnPlayer(game);
    return playerId === currentTurnPlayerId;
  }
  
  // For other phases, no turn restriction (game logic handles actions)
  return true;
}

// Validate turn and throw error if not player's turn
function validatePlayerTurn(game, playerId) {
  if (!isPlayerTurn(game, playerId)) {
    const currentTurnPlayerId = getCurrentTurnPlayer(game);
    const currentTurnPlayerName = game.players[currentTurnPlayerId]?.name || 'Unknown';
    throw new Error(`Not your turn. It's ${currentTurnPlayerName}'s turn.`);
  }
}

// Get the current turn player ID
function getCurrentTurnPlayer(game) {
  if (!game || !game.turnOrder || game.turnOrder.length === 0) {
    return null;
  }
  
  // Start from currentTurnIndex and find the next non-collapsed player
  let attempts = 0;
  let index = game.currentTurnIndex || 0;
  
  while (attempts < game.turnOrder.length) {
    index = index % game.turnOrder.length;
    const playerId = game.turnOrder[index];
    const player = game.players[playerId];
    
    // Found an active (non-collapsed) player
    if (player && !player.collapsed) {
      return playerId;
    }
    
    // Move to next player
    index++;
    attempts++;
  }
  
  // All players are collapsed
  return null;
}

// Advance to next player's turn
async function advanceTurn() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game || game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only end turn during STATE_ACTIONS phase');
      }
      
      if (!game.turnOrder || game.turnOrder.length === 0) {
        throw new Error('No turn order established');
      }
      
      // Validate it's this player's turn
      validatePlayerTurn(game, currentPlayerId);
      
      // Find next non-collapsed player
      let nextIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
      let attempts = 0;
      
      while (attempts < game.turnOrder.length) {
        const playerId = game.turnOrder[nextIndex];
        const player = game.players[playerId];
        
        // Found an active (non-collapsed) player
        if (player && !player.collapsed) {
          game.currentTurnIndex = nextIndex;
          return game;
        }
        
        // Move to next player
        nextIndex = (nextIndex + 1) % game.turnOrder.length;
        attempts++;
      }
      
      // All players collapsed, no change
      throw new Error('All players have collapsed');
    });
    
    console.log('✅ Advanced to next player\'s turn');
    alert('✅ Turn ended! Next player\'s turn.');
  } catch (error) {
    console.error('❌ Failed to advance turn:', error);
    alert('❌ ' + error.message);
  }
}

// Perform War Phase
async function performWar() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Process all active wars
      for (const playerId in game.players) {
        const player = game.players[playerId];
        if (player.collapsed) continue;
        
        // Process each war this player is involved in
        for (const targetId in player.wars || {}) {
          const war = player.wars[targetId];
          const target = game.players[targetId];
          
          if (!target || target.collapsed) {
            // War ended because target collapsed - release locked cards
            releaseLockedCards(player, targetId);
            delete player.wars[targetId];
            continue;
          }
          
          // Only process once (when attacker has lower ID to avoid double processing)
          if (playerId > targetId) continue;
          
          // Battle resolution: compare military
          // Use assigned military if available, otherwise total military
          const attackerMilitary = calculateAssignedMilitary(player, targetId);
          const defenderMilitary = calculateAssignedMilitary(target, playerId);
          
          let trackIncrease = 0;
          
          if (attackerMilitary > defenderMilitary) {
            // Attacker victory
            const margin = attackerMilitary - defenderMilitary;
            // Clear victory if margin is at least 50% of defender's military (or defender has 0)
            if (defenderMilitary === 0 || margin >= defenderMilitary / 2) {
              trackIncrease = 2; // Clear victory
            } else {
              trackIncrease = 1; // Minor victory
            }
            
            // Casualty roll for defender
            const casualtyDie = Math.floor(Math.random() * 6) + 1;
            // Get assigned military cards or all military cards
            let targetMilitaryCount = 0;
            if (target.militaryAssignments && target.militaryAssignments[playerId]) {
              const assignments = target.militaryAssignments[playerId];
              targetMilitaryCount = assignments.frontline.length + assignments.reserve.length + assignments.garrison.length;
            } else {
              targetMilitaryCount = target.hand.filter(c => c.type === 'military').length;
            }
            const cardsToRemove = Math.floor(targetMilitaryCount * casualtyDie / 6);
            
            // Store battle results for UI
            war.lastBattle = {
              winner: 'attacker',
              attackerMilitary,
              defenderMilitary,
              casualtyRoll: casualtyDie,
              cardsLost: cardsToRemove,
              trackChange: trackIncrease
            };
            
            // Remove casualties using new function
            removeCasualties(target, playerId, cardsToRemove);
          } else if (defenderMilitary > attackerMilitary) {
            // Defender victory - war track decreases
            trackIncrease = -1;
            
            // Casualty roll for attacker
            const casualtyDie = Math.floor(Math.random() * 6) + 1;
            // Get assigned military cards or all military cards
            let attackerMilitaryCount = 0;
            if (player.militaryAssignments && player.militaryAssignments[targetId]) {
              const assignments = player.militaryAssignments[targetId];
              attackerMilitaryCount = assignments.frontline.length + assignments.reserve.length + assignments.garrison.length;
            } else {
              attackerMilitaryCount = player.hand.filter(c => c.type === 'military').length;
            }
            const cardsToRemove = Math.floor(attackerMilitaryCount * casualtyDie / 6);
            
            // Store battle results for UI
            war.lastBattle = {
              winner: 'defender',
              attackerMilitary,
              defenderMilitary,
              casualtyRoll: casualtyDie,
              cardsLost: cardsToRemove,
              trackChange: trackIncrease
            };
            
            // Remove casualties using new function
            removeCasualties(player, targetId, cardsToRemove);
          } else {
            // Tie - attacker wins ties
            trackIncrease = 1;
            
            // Store battle results for UI
            war.lastBattle = {
              winner: 'tie',
              attackerMilitary,
              defenderMilitary,
              casualtyRoll: 0,
              cardsLost: 0,
              trackChange: trackIncrease
            };
          }
          
          // Update war tracks
          war.track = Math.max(0, Math.min(7, war.track + trackIncrease));
          const mirrorWar = target.wars[playerId];
          if (mirrorWar) {
            mirrorWar.track = war.track;
          }
          
          // Check for siege (track 3+)
          if (war.track >= 3) {
            // Siege effects handled in UPKEEP (no food production)
            // and INTERNAL_PRESSURE (+8 unrest)
          }
          
          // Check for occupation (track 7)
          if (war.track >= 7) {
            target.collapsed = true;
            target.collapseReason = `Occupied by ${player.name}`;
            
            // Occupying player gets +5 unrest per round
            player.stats.unrest += 5;
            
            // War has ended - release locked cards for both players
            releaseLockedCards(player, targetId);
            releaseLockedCards(target, playerId);
          }
        }
      }
      
      return game;
    });
    
    console.log('✅ War phase completed');
  } catch (error) {
    console.error('❌ War phase failed:', error);
  }
}

// Perform Rebellion Phase
async function performRebellion() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      for (const playerId in game.players) {
        const player = game.players[playerId];
        if (player.collapsed || !player.rebellion) continue;
        
        const rebellion = player.rebellion;
        
        // Calculate rebel dice pool
        let rebelDice = 2; // Base
        if (player.stats.population >= 75) rebelDice += 1;
        const isSieged = Object.values(player.wars || {}).some(war => war.track >= 3);
        if (isSieged) rebelDice += 1;
        if (player.stats.food < player.stats.population) rebelDice += 1;
        const hasHighWarTrack = Object.values(player.wars || {}).some(war => war.track >= 5);
        if (hasHighWarTrack) rebelDice += 1;
        
        // Calculate government dice pool
        let govDice = 2; // Base
        govDice += Math.floor(player.stats.military / 20);
        // Rulebook: "+1 if Emergency Card used"
        if (player.emergencyCardUsedThisRound) govDice += 1;
        
        // Garrison bonus: +2 dice per garrison card across all active wars
        if (player.militaryAssignments && player.wars) {
          let totalGarrisonCards = 0;
          for (const targetId in player.militaryAssignments) {
            // Only count garrison if the war is still active
            if (player.wars[targetId]) {
              const assignments = player.militaryAssignments[targetId];
              if (assignments.garrison) {
                totalGarrisonCards += assignments.garrison.length;
              }
            }
          }
          govDice += totalGarrisonCards * 2;
        }
        
        // Roll dice
        let rebelTotal = 0;
        const rebelRolls = [];
        for (let i = 0; i < rebelDice; i++) {
          const roll = Math.floor(Math.random() * 6) + 1;
          rebelRolls.push(roll);
          rebelTotal += roll;
        }
        
        let govTotal = 0;
        const govRolls = [];
        for (let i = 0; i < govDice; i++) {
          const roll = Math.floor(Math.random() * 6) + 1;
          govRolls.push(roll);
          govTotal += roll;
        }
        
        // Store dice results for UI display
        rebellion.lastDiceRoll = {
          rebelDice,
          govDice,
          rebelRolls,
          govRolls,
          rebelTotal,
          govTotal,
          winner: rebelTotal > govTotal ? 'rebels' : 'government'
        };
        
        // Determine outcome based on stage
        const stage = rebellion.stage || 1;
        
        if (rebelTotal > govTotal) {
          // Rebels win
          if (stage === 1) {
            rebellion.track += 1;
          } else if (stage === 2) {
            rebellion.track += 2;
          } else if (stage === 3) {
            rebellion.track += 2;
          }
        } else {
          // Government wins
          if (stage === 1) {
            rebellion.track -= 1;
          } else if (stage === 2) {
            rebellion.track -= 1;
          } else if (stage === 3) {
            rebellion.track -= 2;
          }
        }
        
        // Check rebellion outcomes
        if (rebellion.track <= 0) {
          // Rebellion crushed
          player.rebellion = null;
          player.stats.unrest = Math.max(0, player.stats.unrest - 20);
        } else if (rebellion.track >= 6) {
          // Civilization collapses
          player.collapsed = true;
          player.collapseReason = 'Rebellion';
          player.rebellion = null;
        } else {
          // Advance stage
          if (rebellion.track >= 4 && stage < 3) {
            rebellion.stage = 3;
          } else if (rebellion.track >= 2 && stage < 2) {
            rebellion.stage = 2;
          }
        }
      }
      
      return game;
    });
    
    console.log('✅ Rebellion phase completed');
  } catch (error) {
    console.error('❌ Rebellion phase failed:', error);
  }
}

// Perform Natural Events Phase
async function performNaturalEvents() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    const snapshot = await get(gameRef);
    const game = snapshot.val();
    
    if (!game || !game.naturalEventsEnabled) {
      console.log('⏭️ Natural events disabled');
      return;
    }
    
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      const alivePlayers = Object.keys(game.players).filter(id => !game.players[id].collapsed);
      
      if (alivePlayers.length === 0) return game;
      
      // Select random player
      const targetIndex = Math.floor(Math.random() * alivePlayers.length);
      const targetId = alivePlayers[targetIndex];
      const target = game.players[targetId];
      
      // Select random event
      const eventRoll = Math.floor(Math.random() * 4);
      const events = ['drought', 'plague', 'earthquake', 'flood'];
      const event = events[eventRoll];
      
      // Apply event effect
      switch (event) {
        case 'drought':
          // Halve farm production next round (mark with flag)
          target.droughtNextRound = true;
          break;
        case 'plague':
          // Reduce morale by 5 (per manual: "Plague → reduce morale by 5")
          // Since morale = luxury + floor(food/2), reducing luxury reduces morale 1:1
          target.stats.luxury = Math.max(0, target.stats.luxury - 5);
          break;
        case 'earthquake':
          // Lose 1 farm
          target.stats.farms = Math.max(0, target.stats.farms - 1);
          break;
        case 'flood':
          // Lose 10 food
          target.stats.food = Math.max(0, target.stats.food - 10);
          break;
      }
      
      game.lastNaturalEvent = {
        targetId: targetId,
        targetName: target.name,
        event: event,
        round: game.round
      };
      
      return game;
    });
    
    console.log('✅ Natural events completed');
  } catch (error) {
    console.error('❌ Natural events failed:', error);
  }
}

// Advance Phase
async function advancePhase() {
  if (!db || !currentGameCode || !isHost) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    const snapshot = await get(gameRef);
    const game = snapshot.val();
    
    if (!game) return;
    
    const currentPhaseIndex = PHASES.indexOf(game.phase);
    let nextPhaseIndex = currentPhaseIndex + 1;
    let nextRound = game.round;
    
    // If we've completed all phases, go back to UPKEEP and increment round
    if (nextPhaseIndex >= PHASES.length) {
      nextPhaseIndex = 0;
      nextRound++;
    }
    
    const nextPhase = PHASES[nextPhaseIndex];
    
    // Update phase
    await update(gameRef, {
      phase: nextPhase,
      round: nextRound
    });
    
    // Perform automatic phase processing
    switch (nextPhase) {
      case 'UPKEEP':
        await performUpkeep();
        break;
      case 'INTERNAL_PRESSURE':
        await performInternalPressure();
        break;
      case 'STATE_ACTIONS':
        await resetActions();
        break;
      case 'WAR':
        await performWar();
        break;
      case 'REBELLION':
        await performRebellion();
        break;
      case 'NATURAL_EVENTS':
        await performNaturalEvents();
        break;
      case 'CLEANUP':
        await performCleanup();
        break;
    }
    
    // Check victory conditions
    await checkVictory();
    
    console.log(`✅ Advanced to ${nextPhase}`);
  } catch (error) {
    console.error('❌ Failed to advance phase:', error);
    alert('Failed to advance phase: ' + error.message);
  }
}

// Perform Cleanup Phase
async function performCleanup() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      for (const playerId in game.players) {
        const player = game.players[playerId];
        if (player.collapsed) continue;
        
        // Enforce hand limit (10 cards)
        while (player.hand.length > 10) {
          const discarded = player.hand.pop();
          player.discardPile.push(discarded);
        }
      }
      
      return game;
    });
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Check Victory Conditions
async function checkVictory() {
  if (!db || !currentGameCode) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    const snapshot = await get(gameRef);
    const game = snapshot.val();
    
    if (!game) return;
    
    const alivePlayers = Object.values(game.players).filter(p => !p.collapsed);
    
    // Check for multiple players alive during victory countdown
    if (alivePlayers.length > 1 && game.victoryCountdown) {
      // Multiple players alive again, reset countdown
      await update(gameRef, {
        victoryCountdown: null
      });
      console.log('⚠️ Victory countdown cancelled - multiple civilizations remain');
      return;
    }
    
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      
      // Check if we're already in victory countdown
      if (game.victoryCountdown) {
        game.victoryCountdown.roundsRemaining--;
        
        // Check if winner still qualifies (no active rebellion, positive economy)
        const stillQualifies = !winner.rebellion && winner.stats.economy >= 0;
        
        if (!stillQualifies) {
          // Winner disqualified, reset countdown
          await update(gameRef, {
            victoryCountdown: null
          });
          console.log('⚠️ Victory countdown reset - winner disqualified');
        } else if (game.victoryCountdown.roundsRemaining <= 0) {
          // Winner survived 2 rounds!
          await update(gameRef, {
            winner: winner.id,
            winnerName: winner.name,
            gameOver: true,
            victoryCountdown: null
          });
          console.log(`🏆 ${winner.name} wins!`);
        } else {
          // Update countdown
          await update(gameRef, {
            victoryCountdown: game.victoryCountdown
          });
          console.log(`⏳ Victory countdown: ${game.victoryCountdown.roundsRemaining} rounds remaining`);
        }
      } else {
        // Start victory countdown
        await update(gameRef, {
          victoryCountdown: {
            winnerId: winner.id,
            winnerName: winner.name,
            roundsRemaining: 2
          }
        });
        console.log(`🏁 ${winner.name} is the last standing! Must survive 2 more rounds to win.`);
      }
    } else if (alivePlayers.length === 0) {
      await update(gameRef, {
        gameOver: true,
        draw: true
      });
      console.log('Game ended in a draw - all civilizations collapsed');
    }
  } catch (error) {
    console.error('❌ Failed to check victory:', error);
  }
}

// Buy Card Action
async function buyCard() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only buy cards during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      // Rebellion Stage 2: No buying (per manual line 171)
      if (player.rebellion && player.rebellion.stage >= 2) {
        throw new Error('Cannot buy during rebellion stage 2 or 3 (Armed Uprising/Regime Collapse)');
      }
      
      if (player.actions.boughtCard) {
        throw new Error('Already bought a card this round');
      }
      
      if (player.stats.economy < 2) {
        throw new Error('Not enough economy (need 2)');
      }
      
      if (player.hand.length >= 10) {
        throw new Error('Hand is full (max 10 cards)');
      }
      
      if (player.deck.length === 0) {
        if (player.discardPile.length === 0) {
          throw new Error('No cards left to draw');
        }
        // Reshuffle discard pile
        player.deck = [...player.discardPile];
        player.discardPile = [];
        // Shuffle
        for (let i = player.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
        }
      }
      
      const drawnCard = player.deck.shift();
      player.hand.push(drawnCard);
      player.actions.boughtCard = true;
      player.actions.actionsUsed += 1; // Increment action counter
      
      // Consume economy cards worth 2 economy
      consumeEconomy(player, 2);
      
      // Economy will be recalculated automatically from remaining cards
      
      return game;
    });
    
    console.log('✅ Bought card');
    alert('✅ Card purchased!');
  } catch (error) {
    console.error('❌ Failed to buy card:', error);
    alert('❌ ' + error.message);
  }
}

// Buy Farm Action
async function buyFarm() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only buy farms during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      // Rebellion Stage 2: No buying (per manual line 171)
      if (player.rebellion && player.rebellion.stage >= 2) {
        throw new Error('Cannot buy during rebellion stage 2 or 3 (Armed Uprising/Regime Collapse)');
      }
      
      if (player.actions.boughtFarm) {
        throw new Error('Already bought a farm this round');
      }
      
      if (player.stats.economy < 5) {
        throw new Error('Not enough economy (need 5)');
      }
      
      player.stats.farms += 1;
      player.actions.boughtFarm = true;
      player.actions.actionsUsed += 1; // Increment action counter
      
      // Consume economy cards worth 5 economy
      consumeEconomy(player, 5);
      
      return game;
    });
    
    console.log('✅ Bought farm');
    alert('✅ Farm purchased!');
  } catch (error) {
    console.error('❌ Failed to buy farm:', error);
    alert('❌ ' + error.message);
  }
}

// Buy Luxury Action
async function buyLuxury() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only buy luxury during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      // Rebellion Stage 2: No buying (per manual line 171)
      if (player.rebellion && player.rebellion.stage >= 2) {
        throw new Error('Cannot buy during rebellion stage 2 or 3 (Armed Uprising/Regime Collapse)');
      }
      
      if (player.actions.boughtLuxury) {
        throw new Error('Already bought luxury this round');
      }
      
      if (player.stats.economy < 1) {
        throw new Error('Not enough economy (need 1)');
      }
      
      if (player.stats.unrest >= 50) {
        throw new Error('Cannot buy luxury with unrest >= 50');
      }
      
      player.stats.luxury += diceRoll;
      player.lastLuxuryRoll = diceRoll;
      player.actions.boughtLuxury = true;
      player.actions.actionsUsed += 1; // Increment action counter
      
      // Consume economy cards worth 1 economy
      consumeEconomy(player, 1);
      
      return game;
    });
    
    console.log(`✅ Bought luxury (rolled ${diceRoll})`);
  } catch (error) {
    console.error('❌ Failed to buy luxury:', error);
    alert('❌ ' + error.message);
  }
}

// Play Card Action
async function playCard(cardIndex) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation - cards can only be discarded during CLEANUP phase
      if (game.phase !== 'CLEANUP') {
        throw new Error('Can only discard cards during CLEANUP phase');
      }
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      if (cardIndex < 0 || cardIndex >= player.hand.length) {
        throw new Error(`Card index ${cardIndex} is out of range (hand size: ${player.hand.length})`);
      }
      
      const card = player.hand[cardIndex];
      
      // Check if card is locked (assigned to a war)
      if (card.locked) {
        const opponent = game.players[card.lockedFor];
        const opponentName = opponent ? opponent.name : 'unknown opponent';
        throw new Error(`Cannot discard this card - it is locked as ${card.role} in war with ${opponentName}`);
      }
      
      // Initialize discard pile if it doesn't exist
      if (!player.discardPile) {
        player.discardPile = [];
      }
      
      // Remove card from hand and add to discard pile
      player.hand.splice(cardIndex, 1);
      player.discardPile.push(card);
      
      return game;
    });
    
    console.log(`✅ Played card`);
    alert('✅ Card played and discarded!');
  } catch (error) {
    console.error('❌ Failed to play card:', error);
    alert('❌ ' + error.message);
  }
}

// Reduce Unrest Action
async function reduceUnrest() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only reduce unrest during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      if (player.actions.reducedUnrest) {
        throw new Error('Already reduced unrest this round');
      }
      
      player.stats.unrest = Math.max(0, player.stats.unrest - 10);
      player.actions.reducedUnrest = true;
      player.actions.actionsUsed += 1; // Increment action counter
      
      return game;
    });
    
    console.log('✅ Reduced unrest');
    alert('✅ Unrest reduced by 10!');
  } catch (error) {
    console.error('❌ Failed to reduce unrest:', error);
    alert('❌ ' + error.message);
  }
}

// Handle Economic Collapse Recovery (per manual lines 106-111)
async function handleEconomicCollapse(drawCard = true) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only handle economic collapse during STATE_ACTIONS phase');
      }
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Check if player has 0 economy cards
      const economyCards = player.hand.filter(card => card.type === 'economy');
      if (economyCards.length > 0) {
        throw new Error('You have economy cards. This action is only for economic collapse (0 economy cards).');
      }
      
      if (drawCard) {
        // Option 1: Draw emergency card
        // If red card drawn: nothing happens
        // If black card drawn: +30 unrest
        if (player.deck.length === 0) {
          // Reshuffle discard pile into deck
          player.deck = player.discardPile;
          player.discardPile = [];
          // Shuffle deck
          for (let i = player.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
          }
        }
        
        if (player.deck.length > 0) {
          const drawnCard = player.deck.shift();
          
          if (drawnCard.type === 'military') {
            // Black card: +30 unrest
            player.stats.unrest += 30;
            alert(`❌ Drew black card ${drawnCard.suit}${drawnCard.value}! +30 unrest!`);
          } else if (drawnCard.type === 'economy') {
            // Red card: nothing happens
            alert(`✅ Drew red card ${drawnCard.suit}${drawnCard.value}! No penalty.`);
          } else {
            // Unexpected card type (should never happen)
            throw new Error(`Unexpected card type: ${drawnCard.type}`);
          }
          
          // Put card back in deck (emergency draw, not added to hand)
          player.deck.unshift(drawnCard);
        } else {
          throw new Error('No cards available in deck to draw');
        }
      } else {
        // Option 2: Accept +20 unrest
        player.stats.unrest += 20;
        alert('⚠️ Accepted +20 unrest to stabilize economy');
      }
      
      return game;
    });
    
    console.log('✅ Handled economic collapse');
  } catch (error) {
    console.error('❌ Failed to handle economic collapse:', error);
    alert('❌ ' + error.message);
  }
}

// Declare War
async function declareWar(targetPlayerId) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only declare war during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      const target = game.players[targetPlayerId];
      
      if (!player || !target) {
        throw new Error('Player not found');
      }
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      if (player.actions.declaredWar) {
        throw new Error('Already declared war this round');
      }
      
      if (player.wars[targetPlayerId]) {
        throw new Error('Already at war with this player');
      }
      
      player.wars[targetPlayerId] = {
        track: 0,
        targetId: targetPlayerId,
        targetName: target.name
      };
      
      target.wars[currentPlayerId] = {
        track: 0,
        targetId: currentPlayerId,
        targetName: player.name
      };
      
      player.actions.declaredWar = true;
      player.actions.actionsUsed += 1; // Increment action counter
      
      return game;
    });
    
    console.log('✅ War declared');
    alert('✅ War declared!');
  } catch (error) {
    console.error('❌ Failed to declare war:', error);
    alert('❌ ' + error.message);
  }
}

// Assign Military Cards to War Roles
async function assignMilitary(targetPlayerId, assignments) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Can assign military during STATE_ACTIONS or WAR phase
      if (game.phase !== 'STATE_ACTIONS' && game.phase !== 'WAR') {
        throw new Error('Can only assign military during STATE_ACTIONS or WAR phase');
      }
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Verify war exists
      if (!player.wars[targetPlayerId]) {
        throw new Error('Not at war with this player');
      }
      
      // Initialize military assignments for this war if not exists
      if (!player.militaryAssignments) {
        player.militaryAssignments = {};
      }
      if (!player.militaryAssignments[targetPlayerId]) {
        player.militaryAssignments[targetPlayerId] = {
          frontline: [],
          garrison: [],
          reserve: []
        };
      }
      
      // Validate assignments - ensure card indices are valid and are military cards
      const frontline = assignments.frontline || [];
      const garrison = assignments.garrison || [];
      const reserve = assignments.reserve || [];
      
      const allAssignments = [...frontline, ...garrison, ...reserve];
      
      // Check for duplicates
      const uniqueAssignments = new Set(allAssignments);
      if (uniqueAssignments.size !== allAssignments.length) {
        throw new Error('Cannot assign the same card to multiple roles');
      }
      
      // Validate all indices are valid military cards
      for (const cardIndex of allAssignments) {
        if (cardIndex < 0 || cardIndex >= player.hand.length) {
          throw new Error(`Invalid card index: ${cardIndex}`);
        }
        const card = player.hand[cardIndex];
        if (card.type !== 'military') {
          throw new Error(`Card at index ${cardIndex} is not a military card`);
        }
        // Check if card is already locked for another war
        if (card.locked && card.lockedFor !== targetPlayerId) {
          throw new Error(`Card at index ${cardIndex} is locked for another war`);
        }
      }
      
      // First, unlock all cards that were previously assigned to this war
      if (player.militaryAssignments[targetPlayerId]) {
        const oldAssignments = [
          ...player.militaryAssignments[targetPlayerId].frontline,
          ...player.militaryAssignments[targetPlayerId].garrison,
          ...player.militaryAssignments[targetPlayerId].reserve
        ];
        for (const cardIndex of oldAssignments) {
          if (cardIndex >= 0 && cardIndex < player.hand.length) {
            const card = player.hand[cardIndex];
            if (card.lockedFor === targetPlayerId) {
              delete card.locked;
              delete card.lockedFor;
              delete card.role;
            }
          }
        }
      }
      
      // Apply new assignments and lock cards
      player.militaryAssignments[targetPlayerId] = {
        frontline: [...frontline],
        garrison: [...garrison],
        reserve: [...reserve]
      };
      
      // Lock assigned cards
      for (const cardIndex of frontline) {
        player.hand[cardIndex].locked = true;
        player.hand[cardIndex].lockedFor = targetPlayerId;
        player.hand[cardIndex].role = 'frontline';
      }
      for (const cardIndex of garrison) {
        player.hand[cardIndex].locked = true;
        player.hand[cardIndex].lockedFor = targetPlayerId;
        player.hand[cardIndex].role = 'garrison';
      }
      for (const cardIndex of reserve) {
        player.hand[cardIndex].locked = true;
        player.hand[cardIndex].lockedFor = targetPlayerId;
        player.hand[cardIndex].role = 'reserve';
      }
      
      return game;
    });
    
    console.log('✅ Military assigned');
    return true;
  } catch (error) {
    console.error('❌ Failed to assign military:', error);
    alert('❌ ' + error.message);
    return false;
  }
}

// Play Emergency Card
async function playEmergencyCard() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation - emergency cards can be played during STATE_ACTIONS phase
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only play emergency cards during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      if (player.emergencyCards <= 0) {
        throw new Error('No emergency cards remaining');
      }
      
      if (player.emergencyCardUsedThisRound) {
        throw new Error('Already used an emergency card this round');
      }
      
      // Use emergency card - reduces unrest by 20
      player.emergencyCards -= 1;
      player.emergencyCardUsedThisRound = true;
      player.stats.unrest = Math.max(0, player.stats.unrest - 20);
      player.actions.actionsUsed += 1; // Increment action counter
      
      return game;
    });
    
    console.log('✅ Emergency card played');
    alert('✅ Emergency card used! -20 unrest\n(Will also grant +1 dice to government if rebellion occurs)');
  } catch (error) {
    console.error('❌ Failed to play emergency card:', error);
    alert('❌ ' + error.message);
  }
}

// Send Trade Offer
async function sendTradeOffer(targetPlayerId, offer, request) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only send trade offers during STATE_ACTIONS phase');
      }
      
      // Turn validation
      validatePlayerTurn(game, currentPlayerId);
      
      const player = game.players[currentPlayerId];
      const target = game.players[targetPlayerId];
      
      if (!player || !target) {
        throw new Error('Player not found');
      }
      
      // Check action limit based on unrest
      validateActionLimit(player);
      
      // Rebellion Stage 2: No trading (per manual line 171)
      if (player.rebellion && player.rebellion.stage >= 2) {
        throw new Error('Cannot trade during rebellion stage 2 or 3 (Armed Uprising/Regime Collapse)');
      }
      
      if (player.actions.traded) {
        throw new Error('Already made a trade offer this round');
      }
      
      if (player.stats.unrest >= 50) {
        throw new Error('Cannot trade with unrest >= 50');
      }
      
      // Validate player has resources to offer
      // Note: Economy comes from cards which cannot be traded
      if (offer.food > 0 && player.stats.food < offer.food) {
        throw new Error('Not enough food to offer');
      }
      if (offer.luxury > 0 && player.stats.luxury < offer.luxury) {
        throw new Error('Not enough luxury to offer');
      }
      
      // Create trade offer
      if (!game.tradeOffers) {
        game.tradeOffers = {};
      }
      
      const tradeId = push(ref(db, `games/${currentGameCode}/tradeOffers`)).key;
      game.tradeOffers[tradeId] = {
        id: tradeId,
        fromId: currentPlayerId,
        fromName: player.name,
        toId: targetPlayerId,
        toName: target.name,
        offer: offer,
        request: request,
        status: 'pending',
        createdAt: Date.now()
      };
      
      player.actions.traded = true;
      player.actions.actionsUsed += 1; // Increment action counter
      
      return game;
    });
    
    console.log('✅ Trade offer sent');
    alert('✅ Trade offer sent!');
  } catch (error) {
    console.error('❌ Failed to send trade offer:', error);
    alert('❌ ' + error.message);
  }
}

// Accept Trade Offer
async function acceptTradeOffer(tradeId) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game || !game.tradeOffers || !game.tradeOffers[tradeId]) {
        throw new Error('Trade offer not found');
      }
      
      const trade = game.tradeOffers[tradeId];
      
      if (trade.status !== 'pending') {
        throw new Error('Trade already processed');
      }
      
      if (trade.toId !== currentPlayerId) {
        throw new Error('This trade is not for you');
      }
      
      const sender = game.players[trade.fromId];
      const receiver = game.players[trade.toId];
      
      if (!sender || !receiver) {
        throw new Error('Player not found');
      }
      
      // Validate both players still have the resources
      // Note: Economy comes from cards which cannot be traded
      if (sender.stats.food < trade.offer.food ||
          sender.stats.luxury < trade.offer.luxury) {
        throw new Error('Sender no longer has offered resources');
      }
      
      if (receiver.stats.food < trade.request.food ||
          receiver.stats.luxury < trade.request.luxury) {
        throw new Error('You no longer have requested resources');
      }
      
      // Execute trade - transfer food and luxury only
      sender.stats.food -= trade.offer.food;
      sender.stats.luxury -= trade.offer.luxury;
      receiver.stats.food += trade.offer.food;
      receiver.stats.luxury += trade.offer.luxury;
      
      receiver.stats.food -= trade.request.food;
      receiver.stats.luxury -= trade.request.luxury;
      sender.stats.food += trade.request.food;
      sender.stats.luxury += trade.request.luxury;
      
      trade.status = 'accepted';
      
      return game;
    });
    
    console.log('✅ Trade accepted');
    alert('✅ Trade accepted!');
  } catch (error) {
    console.error('❌ Failed to accept trade:', error);
    alert('❌ ' + error.message);
  }
}

// Reject Trade Offer
async function rejectTradeOffer(tradeId) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game || !game.tradeOffers || !game.tradeOffers[tradeId]) {
        throw new Error('Trade offer not found');
      }
      
      const trade = game.tradeOffers[tradeId];
      
      if (trade.toId !== currentPlayerId) {
        throw new Error('This trade is not for you');
      }
      
      trade.status = 'rejected';
      
      return game;
    });
    
    console.log('✅ Trade rejected');
    alert('✅ Trade rejected');
  } catch (error) {
    console.error('❌ Failed to reject trade:', error);
    alert('❌ ' + error.message);
  }
}

// Break Trade Deal
async function breakTrade(tradeId) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game || !game.tradeOffers || !game.tradeOffers[tradeId]) {
        throw new Error('Trade offer not found');
      }
      
      const trade = game.tradeOffers[tradeId];
      
      // Can only break accepted trades
      if (trade.status !== 'accepted') {
        throw new Error('Can only break accepted trades');
      }
      
      // Only participants can break the trade
      if (trade.fromId !== currentPlayerId && trade.toId !== currentPlayerId) {
        throw new Error('You are not a participant in this trade');
      }
      
      const breaker = game.players[currentPlayerId];
      if (!breaker) {
        throw new Error('Player not found');
      }
      
      // Apply +10 unrest penalty to breaker
      breaker.stats.unrest += 10;
      
      // Mark trade as broken
      trade.status = 'broken';
      trade.brokenBy = currentPlayerId;
      trade.brokenAt = Date.now();
      
      return game;
    });
    
    console.log('✅ Trade broken (+10 unrest penalty applied)');
    alert('⚠️ Trade broken! You received +10 unrest as penalty.');
  } catch (error) {
    console.error('❌ Failed to break trade:', error);
    alert('❌ ' + error.message);
  }
}

// Foreign Interference
async function foreignInterference(targetPlayerId) {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const gameRef = ref(db, `games/${currentGameCode}`);
  
  try {
    await runTransaction(gameRef, (game) => {
      if (!game) return game;
      
      // Phase validation
      if (game.phase !== 'INTERNAL_PRESSURE') {
        throw new Error('Foreign interference can only be performed during INTERNAL_PRESSURE phase');
      }
      
      const player = game.players[currentPlayerId];
      const target = game.players[targetPlayerId];
      
      if (!player || !target) {
        throw new Error('Player not found');
      }
      
      if (target.stats.unrest < 75) {
        throw new Error('Target must have unrest >= 75');
      }
      
      if (player.stats.economy < 1) {
        throw new Error('Not enough economy (need 1)');
      }
      
      // Track interference this round
      if (!player.interferenceThisRound) {
        player.interferenceThisRound = {};
      }
      
      const currentInterference = player.interferenceThisRound[targetPlayerId] || 0;
      if (currentInterference >= 10) {
        throw new Error('Already interfered max amount (10) with this player');
      }
      
      target.stats.unrest += 1;
      player.interferenceThisRound[targetPlayerId] = currentInterference + 1;
      
      return game;
    });
    
    console.log('✅ Foreign interference applied');
    alert('✅ Foreign interference applied!');
  } catch (error) {
    console.error('❌ Failed to apply foreign interference:', error);
    alert('❌ ' + error.message);
  }
}

// Listen to game state
function listenToGameState(gameCode, callback) {
  if (!db) return;

  // Set current game code
  currentGameCode = gameCode;

  const gameRef = ref(db, `games/${gameCode}`);
  gameStateListener = onValue(gameRef, (snapshot) => {
    const game = snapshot.val();
    callback(game);
  });
}

// Stop listening to game state
function stopListeningToGameState() {
  if (gameStateListener) {
    gameStateListener();
    gameStateListener = null;
  }
}

// Leave Game
async function leaveGame() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  try {
    await remove(ref(db, `games/${currentGameCode}/players/${currentPlayerId}`));
    
    localStorage.removeItem('currentGameCode');
    localStorage.removeItem('currentPlayerId');
    localStorage.removeItem('currentPlayerName');
    
    stopListeningToGameState();
    
    currentGameCode = null;
    currentPlayerId = null;
    currentPlayerName = null;
    isHost = false;
    
    console.log('✅ Left game');
  } catch (error) {
    console.error('❌ Failed to leave game:', error);
  }
}

// Export functions and getters
export {
  initFirebase,
  createGame,
  joinGame,
  startGame,
  advancePhase,
  advanceTurn,  // Advance to next player's turn
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
  breakTrade,  // Break accepted trade with penalty
  foreignInterference,
  assignMilitary,  // Assign military cards to war roles
  handleEconomicCollapse,  // Economic collapse recovery choice
  listenToGameState,
  stopListeningToGameState,
  leaveGame,
  getMaxActions,  // Export helper for UI to check action limits
  isPlayerTurn,  // Check if it's a player's turn
  getCurrentTurnPlayer,  // Get current turn player ID
  CREATOR_KEY
};

// Export getter functions for dynamic state
export function getCurrentGameCode() {
  return currentGameCode;
}

export function getCurrentPlayerId() {
  return currentPlayerId;
}

export function getCurrentPlayerName() {
  return currentPlayerName;
}

export function getIsHost() {
  return isHost;
}
