// game.js - Core game logic for Civilization Online
'use strict';

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get, update, onValue, runTransaction, push, remove, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Constants
const CREATOR_KEY = 'BeforeRoboticsGame';
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
        actions: {
          boughtCard: false,
          boughtFarm: false,
          boughtLuxury: false,
          reducedUnrest: false,
          declaredWar: false,
          traded: false
        },
        wars: {},
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
        actions: {
          boughtCard: false,
          boughtFarm: false,
          boughtLuxury: false,
          reducedUnrest: false,
          declaredWar: false,
          traded: false
        },
        wars: {},
        rebellion: null,
        collapsed: false
      };
      
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
          player.stats.food += player.stats.farms * 20;
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
        
        // Food stress
        if (player.stats.food < 0) {
          player.stats.unrest += 10;
        } else if (player.stats.food < player.stats.population) {
          player.stats.unrest += 5;
        }
        
        // Siege pressure
        const isSieged = Object.values(player.wars || {}).some(war => war.track >= 3);
        if (isSieged) {
          player.stats.unrest += 8;
        }
        
        // Economic collapse check
        if (player.stats.economy < 0) {
          player.stats.unrest += 10;
          player.collapsed = true;
          player.collapseReason = 'Economic collapse';
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

  const gameRef = ref(db, `games/${currentGameCode}/players`);
  
  try {
    const snapshot = await get(gameRef);
    const players = snapshot.val();
    
    const updates = {};
    for (const playerId in players) {
      updates[`${playerId}/actions`] = {
        boughtCard: false,
        boughtFarm: false,
        boughtLuxury: false,
        reducedUnrest: false,
        declaredWar: false,
        traded: false
      };
    }
    
    await update(gameRef, updates);
    console.log('✅ Actions reset');
  } catch (error) {
    console.error('❌ Failed to reset actions:', error);
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
    
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      await update(gameRef, {
        winner: winner.id,
        winnerName: winner.name,
        gameOver: true
      });
      console.log(`🏆 ${winner.name} wins!`);
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

  const playerRef = ref(db, `games/${currentGameCode}/players/${currentPlayerId}`);
  
  try {
    await runTransaction(playerRef, (player) => {
      if (!player) return player;
      
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
      
      // Economy will be recalculated automatically
      
      return player;
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

  const playerRef = ref(db, `games/${currentGameCode}/players/${currentPlayerId}`);
  
  try {
    await runTransaction(playerRef, (player) => {
      if (!player) return player;
      
      if (player.actions.boughtFarm) {
        throw new Error('Already bought a farm this round');
      }
      
      if (player.stats.economy < 5) {
        throw new Error('Not enough economy (need 5)');
      }
      
      player.stats.farms += 1;
      player.actions.boughtFarm = true;
      
      return player;
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

  const playerRef = ref(db, `games/${currentGameCode}/players/${currentPlayerId}`);
  
  try {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    
    await runTransaction(playerRef, (player) => {
      if (!player) return player;
      
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
      player.actions.boughtLuxury = true;
      
      return player;
    });
    
    console.log(`✅ Bought luxury (rolled ${diceRoll})`);
    alert(`✅ Luxury purchased! Rolled: ${diceRoll}`);
  } catch (error) {
    console.error('❌ Failed to buy luxury:', error);
    alert('❌ ' + error.message);
  }
}

// Reduce Unrest Action
async function reduceUnrest() {
  if (!db || !currentGameCode || !currentPlayerId) return;

  const playerRef = ref(db, `games/${currentGameCode}/players/${currentPlayerId}`);
  
  try {
    await runTransaction(playerRef, (player) => {
      if (!player) return player;
      
      if (player.actions.reducedUnrest) {
        throw new Error('Already reduced unrest this round');
      }
      
      player.stats.unrest = Math.max(0, player.stats.unrest - 10);
      player.actions.reducedUnrest = true;
      
      return player;
    });
    
    console.log('✅ Reduced unrest');
    alert('✅ Unrest reduced by 10!');
  } catch (error) {
    console.error('❌ Failed to reduce unrest:', error);
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
      
      const player = game.players[currentPlayerId];
      const target = game.players[targetPlayerId];
      
      if (!player || !target) {
        throw new Error('Player not found');
      }
      
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
      
      return game;
    });
    
    console.log('✅ War declared');
    alert('✅ War declared!');
  } catch (error) {
    console.error('❌ Failed to declare war:', error);
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
  buyCard,
  buyFarm,
  buyLuxury,
  reduceUnrest,
  declareWar,
  listenToGameState,
  stopListeningToGameState,
  leaveGame,
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
