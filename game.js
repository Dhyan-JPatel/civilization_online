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
        // Most severe shortage (< pop × 2) gets highest penalty
        if (player.stats.food < player.stats.population * 2) {
          player.stats.unrest += 10; // Severe food shortage
        } else if (player.stats.food < player.stats.population * 4) {
          player.stats.unrest += 5; // Moderate food shortage
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
      updates[`${playerId}/interferenceThisRound`] = {};
      updates[`${playerId}/lastLuxuryRoll`] = null; // Clear stale dice result
    }
    
    await update(gameRef, updates);
    console.log('✅ Actions reset');
  } catch (error) {
    console.error('❌ Failed to reset actions:', error);
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
            // War ended because target collapsed
            delete player.wars[targetId];
            continue;
          }
          
          // Only process once (when attacker has lower ID to avoid double processing)
          if (playerId > targetId) continue;
          
          // Battle resolution: compare military
          const attackerMilitary = player.stats.military;
          const defenderMilitary = target.stats.military;
          
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
            // Map die roll to number of cards to remove (out of 6)
            const cardsToRemove = Math.floor(target.hand.filter(c => c.type === 'military').length * casualtyDie / 6);
            
            // Store battle results for UI
            war.lastBattle = {
              winner: 'attacker',
              attackerMilitary,
              defenderMilitary,
              casualtyRoll: casualtyDie,
              cardsLost: cardsToRemove,
              trackChange: trackIncrease
            };
            
            for (let i = 0; i < cardsToRemove; i++) {
              const militaryCardIndex = target.hand.findIndex(c => c.type === 'military');
              if (militaryCardIndex !== -1) {
                const removedCard = target.hand.splice(militaryCardIndex, 1)[0];
                target.discardPile.push(removedCard);
              }
            }
          } else if (defenderMilitary > attackerMilitary) {
            // Defender victory - war track decreases
            trackIncrease = -1;
            
            // Casualty roll for attacker
            const casualtyDie = Math.floor(Math.random() * 6) + 1;
            // Map die roll to number of cards to remove (out of 6)
            const cardsToRemove = Math.floor(player.hand.filter(c => c.type === 'military').length * casualtyDie / 6);
            
            // Store battle results for UI
            war.lastBattle = {
              winner: 'defender',
              attackerMilitary,
              defenderMilitary,
              casualtyRoll: casualtyDie,
              cardsLost: cardsToRemove,
              trackChange: trackIncrease
            };
            
            for (let i = 0; i < cardsToRemove; i++) {
              const militaryCardIndex = player.hand.findIndex(c => c.type === 'military');
              if (militaryCardIndex !== -1) {
                const removedCard = player.hand.splice(militaryCardIndex, 1)[0];
                player.discardPile.push(removedCard);
              }
            }
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
          // Reduce morale by 5
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
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
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
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      if (player.actions.boughtFarm) {
        throw new Error('Already bought a farm this round');
      }
      
      if (player.stats.economy < 5) {
        throw new Error('Not enough economy (need 5)');
      }
      
      player.stats.farms += 1;
      player.actions.boughtFarm = true;
      
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
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
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
      
      const player = game.players[currentPlayerId];
      if (!player) return game;
      
      if (player.actions.reducedUnrest) {
        throw new Error('Already reduced unrest this round');
      }
      
      player.stats.unrest = Math.max(0, player.stats.unrest - 10);
      player.actions.reducedUnrest = true;
      
      return game;
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
      
      // Phase validation
      if (game.phase !== 'STATE_ACTIONS') {
        throw new Error('Can only declare war during STATE_ACTIONS phase');
      }
      
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
      
      const player = game.players[currentPlayerId];
      const target = game.players[targetPlayerId];
      
      if (!player || !target) {
        throw new Error('Player not found');
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
  buyCard,
  playCard,
  buyFarm,
  buyLuxury,
  reduceUnrest,
  declareWar,
  sendTradeOffer,
  acceptTradeOffer,
  rejectTradeOffer,
  foreignInterference,
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
