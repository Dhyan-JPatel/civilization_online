// bot-ai.js - AI Bot Decision Engine for Civilization Online
'use strict';

/**
 * Heuristic-based AI for bot players
 * Implements strategic decision-making with configurable difficulty levels
 */

// Difficulty settings affect decision quality
const DIFFICULTY_SETTINGS = {
  easy: {
    name: 'Easy',
    randomness: 0.4,        // 40% random decisions
    lookahead: 1,           // Consider 1 turn ahead
    riskTolerance: 0.6,     // Higher = more willing to take risks
    aggressiveness: 0.3,    // War likelihood
    economicFocus: 0.5,     // Balance economy vs military
    unrestThreshold: 60     // React to unrest at this level
  },
  medium: {
    name: 'Medium',
    randomness: 0.2,        // 20% random decisions
    lookahead: 2,           // Consider 2 turns ahead
    riskTolerance: 0.4,     // Moderate risk
    aggressiveness: 0.5,    // Balanced aggression
    economicFocus: 0.6,     // Slightly favor economy
    unrestThreshold: 50     // React to unrest earlier
  },
  hard: {
    name: 'Hard',
    randomness: 0.05,       // 5% random decisions
    lookahead: 3,           // Consider 3 turns ahead
    riskTolerance: 0.3,     // Low risk, optimal play
    aggressiveness: 0.7,    // Very aggressive
    economicFocus: 0.7,     // Strong economic focus
    unrestThreshold: 40     // React to unrest early
  }
};

/**
 * Evaluate current game state for a bot player
 * Returns a score indicating how well the bot is doing
 */
function evaluateGameState(game, botId) {
  const bot = game.players[botId];
  if (!bot || bot.collapsed) return -Infinity;
  
  const stats = bot.stats;
  let score = 0;
  
  // Survival is paramount - heavily penalize high unrest
  if (stats.unrest >= 100) {
    score -= 1000;  // Rebellion territory
  } else if (stats.unrest >= 80) {
    score -= 500;
  } else if (stats.unrest >= 60) {
    score -= 200;
  } else {
    score += (100 - stats.unrest) * 2;  // Reward low unrest
  }
  
  // Economy is crucial for actions and growth
  score += stats.economy * 10;
  
  // Military provides defense and offense capabilities
  score += stats.military * 5;
  
  // Food and luxury drive population and morale
  score += stats.food * 3;
  score += stats.luxury * 4;
  score += stats.morale * 3;
  score += stats.population * 2;
  
  // Farms are long-term investment
  score += stats.farms * 15;
  
  // Having cards in hand is valuable
  score += bot.hand.length * 5;
  
  // Emergency cards are safety net
  score += bot.emergencyCards * 20;
  
  // Penalize economic collapse risk
  if (stats.economy <= 0) {
    score -= 800;
  } else if (stats.economy < 3) {
    score -= 300;
  }
  
  // Consider active wars (risky but potentially rewarding)
  const activeWars = Object.keys(bot.wars || {}).length;
  score -= activeWars * 50;  // Wars are costly
  
  // Consider rebellion state
  if (bot.rebellion && bot.rebellion.track > 0) {
    score -= bot.rebellion.track * 100;
  }
  
  return score;
}

/**
 * Predict state change from an action
 * Returns estimated score change
 */
function predictActionOutcome(game, botId, action, difficulty) {
  const bot = game.players[botId];
  const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
  
  // Simulate the action's effects
  let predictedChange = 0;
  
  switch (action.type) {
    case 'buyCard':
      // Buying a card costs 2 economy, adds 1 card to hand
      if (bot.stats.economy >= 2) {
        predictedChange += 5;  // Card value
        predictedChange -= 20; // Economy cost
        if (bot.hand.length >= 8) {
          predictedChange -= 10; // Approaching hand limit
        }
      } else {
        return -Infinity; // Can't afford
      }
      break;
      
    case 'buyFarm':
      // Farms cost 5 economy but provide long-term food production
      if (bot.stats.economy >= 5) {
        predictedChange += 50;  // Long-term value
        predictedChange -= 50;  // Economy cost
        if (bot.stats.farms >= 3) {
          predictedChange -= 20; // Diminishing returns
        }
      } else {
        return -Infinity; // Can't afford
      }
      break;
      
    case 'buyLuxury':
      // Luxury costs 1 economy, helps with morale and population
      if (bot.stats.economy >= 1) {
        predictedChange += 15;  // Luxury value
        predictedChange -= 10;  // Economy cost
        if (bot.stats.luxury >= 5) {
          predictedChange -= 10; // Diminishing returns
        }
      } else {
        return -Infinity; // Can't afford
      }
      break;
      
    case 'reduceUnrest':
      // Costs 1 economy, reduces unrest by 10
      if (bot.stats.economy >= 1 && bot.stats.unrest > 0) {
        const unrestReduction = Math.min(10, bot.stats.unrest);
        predictedChange += unrestReduction * 3;  // Unrest reduction value
        predictedChange -= 10;  // Economy cost
        
        // Extra value if unrest is critical
        if (bot.stats.unrest >= settings.unrestThreshold) {
          predictedChange += 30;
        }
      } else {
        return -Infinity; // Can't afford or no unrest
      }
      break;
      
    case 'declareWar':
      // War is risky - consider military strength vs target
      if (action.targetId) {
        const target = game.players[action.targetId];
        if (target && !target.collapsed) {
          const militaryRatio = bot.stats.military / Math.max(1, target.stats.military);
          
          if (militaryRatio > 1.5) {
            predictedChange += 100 * settings.aggressiveness; // Strong advantage
          } else if (militaryRatio > 1.0) {
            predictedChange += 30 * settings.aggressiveness; // Slight advantage
          } else {
            predictedChange -= 100; // Disadvantage - avoid war
          }
          
          // Wars increase unrest
          predictedChange -= 20;
        } else {
          return -Infinity; // Invalid target
        }
      } else {
        return -Infinity; // No target specified
      }
      break;
      
    case 'endTurn':
      // Ending turn is safe, allows game to progress
      predictedChange += 5;
      break;
      
    default:
      predictedChange = 0;
  }
  
  // Add randomness based on difficulty
  if (Math.random() < settings.randomness) {
    predictedChange += (Math.random() - 0.5) * 100;
  }
  
  return predictedChange;
}

/**
 * Find best target for war declaration
 */
function findBestWarTarget(game, botId, difficulty) {
  const bot = game.players[botId];
  const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
  
  // Don't declare war if already in multiple wars
  const activeWars = Object.keys(bot.wars || {}).length;
  if (activeWars >= 2) return null;
  
  // Don't declare war if low military
  if (bot.stats.military < 10) return null;
  
  // Don't declare war if high unrest
  if (bot.stats.unrest >= settings.unrestThreshold) return null;
  
  let bestTarget = null;
  let bestScore = -Infinity;
  
  for (const [playerId, player] of Object.entries(game.players)) {
    if (playerId === botId || player.collapsed || player.isBot) continue;
    if (bot.wars && bot.wars[playerId]) continue; // Already at war
    
    // Calculate target attractiveness
    let score = 0;
    
    // Prefer weaker targets
    const militaryRatio = bot.stats.military / Math.max(1, player.stats.military);
    score += militaryRatio * 50;
    
    // Prefer targets with high unrest (easier to defeat)
    score += player.stats.unrest * 0.5;
    
    // Prefer targets with resources
    score += player.stats.economy * 2;
    score += player.stats.farms * 5;
    
    // Apply aggressiveness factor
    score *= settings.aggressiveness;
    
    // Random factor
    if (Math.random() < settings.randomness) {
      score += (Math.random() - 0.5) * 50;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestTarget = playerId;
    }
  }
  
  // Only declare war if score is positive and random check passes
  if (bestScore > 30 && Math.random() < settings.aggressiveness) {
    return bestTarget;
  }
  
  return null;
}

/**
 * Decide which action to take during STATE_ACTIONS phase
 * Returns an action object: { type, targetId?, ... }
 */
function decideBotAction(game, botId) {
  const bot = game.players[botId];
  if (!bot || bot.collapsed) return null;
  
  const difficulty = bot.botDifficulty || 'medium';
  const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
  const stats = bot.stats;
  const actions = bot.actions;
  
  // Check if we can still perform actions
  const maxActions = getMaxActionsForBot(bot);
  if (actions.actionsUsed >= maxActions) {
    return { type: 'endTurn' };
  }
  
  // Emergency: Handle critical unrest
  if (stats.unrest >= settings.unrestThreshold && stats.economy >= 1 && !actions.reducedUnrest) {
    return { type: 'reduceUnrest' };
  }
  
  // Emergency: Economic collapse recovery
  if (stats.economy <= 0) {
    // Bot will use emergency card if available
    if (bot.emergencyCards > 0 && !bot.emergencyCardUsedThisRound) {
      return { type: 'playEmergencyCard' };
    }
    return { type: 'endTurn' };
  }
  
  // Build list of possible actions with scores
  const possibleActions = [];
  
  // Consider buying a card
  if (stats.economy >= 2 && !actions.boughtCard && bot.hand.length < 10) {
    const score = predictActionOutcome(game, botId, { type: 'buyCard' }, difficulty);
    possibleActions.push({ type: 'buyCard', score });
  }
  
  // Consider buying a farm
  if (stats.economy >= 5 && !actions.boughtFarm && stats.farms < 5) {
    const score = predictActionOutcome(game, botId, { type: 'buyFarm' }, difficulty);
    possibleActions.push({ type: 'buyFarm', score });
  }
  
  // Consider buying luxury
  if (stats.economy >= 1 && !actions.boughtLuxury && stats.luxury < 5) {
    const score = predictActionOutcome(game, botId, { type: 'buyLuxury' }, difficulty);
    possibleActions.push({ type: 'buyLuxury', score });
  }
  
  // Consider reducing unrest
  if (stats.economy >= 1 && stats.unrest >= 20 && !actions.reducedUnrest) {
    const score = predictActionOutcome(game, botId, { type: 'reduceUnrest' }, difficulty);
    possibleActions.push({ type: 'reduceUnrest', score });
  }
  
  // Consider declaring war
  if (!actions.declaredWar && stats.military >= 10) {
    const targetId = findBestWarTarget(game, botId, difficulty);
    if (targetId) {
      const score = predictActionOutcome(game, botId, { type: 'declareWar', targetId }, difficulty);
      possibleActions.push({ type: 'declareWar', targetId, score });
    }
  }
  
  // Sort actions by score
  possibleActions.sort((a, b) => b.score - a.score);
  
  // Choose best action with some randomness
  if (possibleActions.length > 0) {
    // Easy mode: more random, Hard mode: always optimal
    if (Math.random() < settings.randomness && possibleActions.length > 1) {
      // Pick a random action from top 3
      const topActions = possibleActions.slice(0, Math.min(3, possibleActions.length));
      return topActions[Math.floor(Math.random() * topActions.length)];
    } else {
      return possibleActions[0];
    }
  }
  
  // No good actions available, end turn
  return { type: 'endTurn' };
}

/**
 * Calculate max actions for a bot (similar to game.js logic)
 */
function getMaxActionsForBot(bot) {
  let maxActions = 2; // Base action limit
  
  // Reduce actions if high unrest
  if (bot.stats.unrest >= 30) {
    maxActions = 1;
  }
  
  // Reduce actions if in rebellion stage 1
  if (bot.rebellion && bot.rebellion.stage === 'civil_disorder') {
    maxActions = Math.max(1, maxActions - 1);
  }
  
  return maxActions;
}

/**
 * Decide whether to accept a trade offer
 */
function decideTrade(game, botId, tradeOffer) {
  const bot = game.players[botId];
  const difficulty = bot.botDifficulty || 'medium';
  const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
  
  // Calculate net value of trade
  let netValue = 0;
  
  // What we receive
  netValue += (tradeOffer.request.economy || 0) * 10;
  netValue += (tradeOffer.request.food || 0) * 3;
  netValue += (tradeOffer.request.luxury || 0) * 4;
  
  // What we give away
  netValue -= (tradeOffer.offer.economy || 0) * 10;
  netValue -= (tradeOffer.offer.food || 0) * 3;
  netValue -= (tradeOffer.offer.luxury || 0) * 4;
  
  // Check if we can afford what we're offering
  if ((tradeOffer.offer.economy || 0) > bot.stats.economy ||
      (tradeOffer.offer.food || 0) > bot.stats.food ||
      (tradeOffer.offer.luxury || 0) > bot.stats.luxury) {
    return false; // Can't afford
  }
  
  // Apply risk tolerance and randomness
  const threshold = settings.riskTolerance * -20; // Allow slightly unfavorable trades
  
  if (Math.random() < settings.randomness) {
    // Random decision
    return Math.random() < 0.5;
  }
  
  return netValue > threshold;
}

/**
 * Decide which card to play or discard from hand
 */
function decideCardPlay(game, botId) {
  const bot = game.players[botId];
  const difficulty = bot.botDifficulty || 'medium';
  const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
  
  if (bot.hand.length === 0) return null;
  
  // If at hand limit, must discard
  if (bot.hand.length > 10) {
    // Discard lowest value card
    let lowestValue = Infinity;
    let lowestIndex = 0;
    bot.hand.forEach((card, index) => {
      if (card.numValue < lowestValue) {
        lowestValue = card.numValue;
        lowestIndex = index;
      }
    });
    return { action: 'discard', cardIndex: lowestIndex };
  }
  
  // Strategic card play based on needs
  const needsEconomy = bot.stats.economy < 5;
  const needsMilitary = bot.stats.military < 15;
  
  // Find best card to play
  if (needsEconomy) {
    // Look for high-value economy cards
    for (let i = 0; i < bot.hand.length; i++) {
      const card = bot.hand[i];
      if (card.type === 'economy' && card.numValue >= 7) {
        return { action: 'play', cardIndex: i };
      }
    }
  }
  
  if (needsMilitary) {
    // Look for high-value military cards
    for (let i = 0; i < bot.hand.length; i++) {
      const card = bot.hand[i];
      if (card.type === 'military' && card.numValue >= 7) {
        return { action: 'play', cardIndex: i };
      }
    }
  }
  
  // Random play based on difficulty
  if (Math.random() < settings.randomness * 0.5) {
    const randomIndex = Math.floor(Math.random() * bot.hand.length);
    return { action: 'play', cardIndex: randomIndex };
  }
  
  return null; // Don't play any card
}

// Export functions
export {
  decideBotAction,
  decideTrade,
  decideCardPlay,
  evaluateGameState,
  DIFFICULTY_SETTINGS
};
