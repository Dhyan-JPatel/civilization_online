# Phase Enforcement Implementation Summary

## Overview
This update implements proper phase enforcement for all player actions to ensure the game follows the rules defined in `civilization_game_manual.txt`. Previously, players could perform any action at any time, which violated the turn structure rules.

## Changes Implemented

### 1. STATE_ACTIONS Phase Enforcement
All economic, military, and diplomatic actions now require the game to be in the STATE_ACTIONS phase:

**Actions Restricted:**
- `buyCard()` - Buy cards using economy
- `buyFarm()` - Purchase farms
- `buyLuxury()` - Buy luxury with dice roll
- `reduceUnrest()` - Reduce unrest by 10
- `declareWar()` - Declare war on another player
- `sendTradeOffer()` - Send trade offers

**Implementation:**
- Changed from player-level transactions to game-level transactions
- Added phase validation: `if (game.phase !== 'STATE_ACTIONS') throw new Error(...)`
- UI buttons automatically disable outside STATE_ACTIONS phase

### 2. CLEANUP Phase Enforcement
Card discarding is now restricted to the CLEANUP phase only:

**Action Restricted:**
- `playCard()` - Discard cards from hand

**Implementation:**
- Added phase validation for CLEANUP phase
- UI updates card clickability based on phase
- Cards show tooltip indicating phase restriction
- Automatic enforcement at end of CLEANUP discards excess cards

### 3. INTERNAL_PRESSURE Phase Enforcement
Foreign interference can only occur during the appropriate phase:

**Action Restricted:**
- `foreignInterference()` - Add unrest to opponents

**Implementation:**
- Added phase validation: `if (game.phase !== 'INTERNAL_PRESSURE') throw new Error(...)`

### 4. Bug Fixes (Rulebook Compliance)

#### Food Stress Calculation
**Before:** Incorrect thresholds
**After:** 
- Food < Population × 2 → +10 unrest (severe shortage)
- Food < Population × 4 → +5 unrest (moderate shortage)

#### Economic Collapse Pressure
**Before:** Checked if economy < 0 and caused instant collapse
**After:** 
- Checks if player has 0 economy cards in hand
- Adds +10 unrest per round (pressure, not instant collapse)
- Allows game to continue with escalating unrest

### 5. UI Improvements

#### Phase-Specific Hints
Added descriptive hints for each phase:
- ⏳ UPKEEP: Food production, morale and population calculated automatically
- ⚠️ INTERNAL_PRESSURE: Unrest increases are being applied
- 🎯 STATE_ACTIONS: Take your actions for this round!
- ⚔️ WAR: Battles are being resolved automatically
- 🔥 REBELLION: Rebellions are being resolved automatically
- 🌍 NATURAL_EVENTS: Random events may occur
- 🧹 CLEANUP: Discard cards if over hand limit (10 cards)

#### Card Display
- Cards show different tooltips based on phase
- Clickable during CLEANUP with "Click to discard" message
- Non-clickable outside CLEANUP with phase restriction message

#### Data Cleanup
- Clear `lastLuxuryRoll` between rounds to prevent stale UI data

## Code Quality Improvements

### Transaction Changes
All action functions now use game-level transactions instead of player-level:
```javascript
// Before
const playerRef = ref(db, `games/${currentGameCode}/players/${currentPlayerId}`);
await runTransaction(playerRef, (player) => { ... });

// After
const gameRef = ref(db, `games/${currentGameCode}`);
await runTransaction(gameRef, (game) => {
  const player = game.players[currentPlayerId];
  // Phase validation here
  ...
});
```

This allows access to `game.phase` for validation while maintaining transaction safety.

### Comments and Documentation
- Added clear comments explaining logic
- Updated comments to match rulebook terminology
- Explained if-else conditions for food stress

## Testing

### Automated Checks
- ✅ JavaScript syntax validated (no errors)
- ✅ CodeQL security scan (0 vulnerabilities)
- ✅ Code review feedback addressed

### Manual Testing Required
Players should verify:
1. Actions are properly disabled outside their allowed phases
2. Error messages appear when trying to perform phase-restricted actions
3. Phase hints display correctly
4. Card discarding works during CLEANUP
5. All automatic phase processing functions correctly
6. Game flows smoothly through all 7 phases

## Rulebook Compliance

### Phase Structure (Section 7)
✅ All phases enforced in correct order:
1. UPKEEP - Automatic calculations
2. INTERNAL_PRESSURE - Automatic unrest increases
3. STATE_ACTIONS - Player actions allowed here
4. WAR - Automatic battle resolution
5. REBELLION - Automatic rebellion resolution
6. NATURAL_EVENTS - Random events (optional)
7. CLEANUP - Hand limit enforcement

### Cards and Hand Limit (Section 6)
✅ "You may only discard during the Discard & Cleanup Phase"
- Enforced with phase validation on playCard()

### State Actions (Section 3, Phase 3)
✅ "You may take up to 2 State Actions, minus penalties"
✅ "Only one action per category per round"
- All actions restricted to STATE_ACTIONS phase
- One-per-round limits maintained via action flags

### Internal Pressure (Section 2, Phase 2)
✅ Food stress thresholds correct
✅ Economic collapse pressure correct
✅ Siege pressure applied automatically
✅ Foreign interference restricted to this phase

## Future Enhancements

### State Action Limits
The rulebook mentions:
- "30+ Unrest – Lose 1 State Action"

This is not yet enforced. To implement:
1. Add state action counter
2. Check unrest level when performing actions
3. Block actions if limit exceeded

### Emergency Cards
The rulebook mentions emergency cards that can be used during STATE_ACTIONS phase. Current implementation has emergency cards in player data but no UI or action for playing them.

## Summary

This implementation ensures that Civilization Online now properly enforces phase-based restrictions on all player actions, matching the game rules in the manual. The game is now more strategic, as players must plan their actions during the appropriate phases and cannot bypass the turn structure.

All changes maintain backward compatibility with existing game data and include proper error handling with user-friendly messages.
