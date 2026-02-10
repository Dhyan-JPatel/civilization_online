# Card and Dice Mechanics Testing Guide

This document provides testing procedures for the newly implemented card playing and dice roll display features.

## Prerequisites
- Firebase configuration set up correctly
- Local server running (`npm start` or `python3 -m http.server 8080`)
- At least 2 browser windows/tabs for multiplayer testing

## Test 1: Card Playing Mechanism

### Setup
1. Create a new game with creator key
2. Join with a second player
3. Start the game

### Test Steps
1. **Navigate to STATE_ACTIONS phase** (host advances to this phase)
2. **Buy a card** using "Buy Card" button (costs 2 Economy)
3. **Observe the hand display** - cards should appear with card value and suit
4. **Click on any card in hand**
5. **Confirm the action** when prompted "Play/discard [card]?"
6. **Verify**:
   - Card is removed from hand
   - Hand count decreases by 1
   - Alert shows "✅ Card played and discarded!"

### Expected Results
- ✅ Cards are clickable with visual cursor change
- ✅ Confirmation dialog appears when clicking a card
- ✅ Card is removed from hand after confirmation
- ✅ Card is added to discard pile (verify in Firebase or console)

## Test 2: Rebellion Dice Roll Display

### Setup
1. Continue from previous test or create new game
2. Increase a player's unrest to 100+ (can be done through Firebase or game mechanics)

### Test Steps
1. **Wait for REBELLION phase** or advance to it
2. **Rebellion starts automatically** when unrest ≥ 100
3. **Observe the dice result modal**
4. **Verify the modal shows**:
   - Title: "🎲 Rebellion Dice Battle"
   - Rebel dice pool count and individual rolls
   - Government dice pool count and individual rolls
   - Total for each side
   - Winner declaration (👥 Rebels Win! or 🛡️ Government Wins!)
5. **Click OK** to close the modal

### Expected Results
- ✅ Modal appears automatically during REBELLION phase
- ✅ Shows both dice pools with individual die results
- ✅ Displays totals and winner
- ✅ Modal has smooth animation (slideIn)
- ✅ Dice results are stored in rebellion.lastDiceRoll

## Test 3: War/Battle Dice Roll Display

### Setup
1. Continue from previous test or create new game
2. Have one player declare war on another
3. Advance through phases to WAR phase

### Test Steps
1. **Declare war** on another player during STATE_ACTIONS phase
2. **Advance to WAR phase**
3. **Battle automatically resolves** based on military comparison
4. **Observe the dice result modal** (if there's a casualty roll)
5. **Verify the modal shows**:
   - Title: "⚔️ Battle Results vs [Player Name]"
   - Attacker military strength
   - Defender military strength
   - Casualty die roll (1-6)
   - Number of military cards lost
   - Winner/outcome
   - War track change
6. **Click OK** to close the modal

### Expected Results
- ✅ Modal appears when battle has casualties
- ✅ Shows military comparison
- ✅ Displays casualty roll and cards lost
- ✅ Shows battle outcome and track change
- ✅ Battle results stored in war.lastBattle

## Test 4: Luxury Purchase Dice Roll

### Setup
1. Continue from previous test or create new game
2. Ensure player has at least 1 Economy
3. Ensure player has unrest < 50

### Test Steps
1. **Navigate to STATE_ACTIONS phase**
2. **Click "Buy Luxury"** button
3. **Observe the dice result modal**
4. **Verify the modal shows**:
   - Title: "Luxury Purchase"
   - Large dice emoji (🎲)
   - "You rolled: [1-6]"
   - "+[roll] Luxury added to your civilization!"
5. **Click OK** to close the modal
6. **Verify luxury stat increased** by the rolled amount

### Expected Results
- ✅ Modal appears instead of simple alert
- ✅ Shows dice roll result prominently
- ✅ Luxury stat increases by roll amount
- ✅ Visual feedback is clear and engaging

## Test 5: Modal Animations

### Test Steps
1. Trigger any dice roll event (luxury, rebellion, or war)
2. **Observe the modal animation**
3. **Verify**:
   - Modal slides in from top (slideIn animation)
   - Content fades in (fadeIn animation)
   - Animation is smooth and not jarring

### Expected Results
- ✅ Modal has smooth entrance animation
- ✅ Content animates separately
- ✅ No visual glitches or jumps

## Test 6: Multiple Dice Results

### Test Steps
1. Have multiple wars active
2. Advance to WAR phase (multiple battles occur)
3. **Verify**:
   - Modals appear for each battle (one at a time)
   - Each modal shows correct opponent name
   - Results are accurately displayed

### Expected Results
- ✅ Multiple battles show separate modals
- ✅ Modal doesn't overlap or cause issues
- ✅ All results are displayed correctly

## Test 7: Edge Cases

### Card Playing Edge Cases
1. **Try playing card when hand is empty** - should not cause error
2. **Click card rapidly multiple times** - should only process once
3. **Play all cards** - hand should reach 0

### Dice Roll Edge Cases
1. **Rebellion crushed (track ≤ 0)** - verify rebellion ends
2. **Civilization collapses (rebellion track ≥ 6)** - verify collapse
3. **War with 0 military** - verify no crash, proper handling
4. **Luxury purchase with unrest ≥ 50** - should be blocked

## Integration Testing

### Test Full Game Flow
1. Create game, join with 2+ players, start game
2. Buy cards, play cards throughout game
3. Trigger rebellion, observe dice rolls
4. Declare war, observe battle results
5. Buy luxury, observe dice rolls
6. Advance through all phases multiple times
7. Verify no errors in console
8. Verify game state remains consistent

## Console Verification

Check browser console for:
- ✅ No JavaScript errors
- ✅ Dice roll logs (optional debug info)
- ✅ Firebase transaction success messages
- ❌ No "undefined" or "null" reference errors

## Firebase Data Verification

Check Firebase Realtime Database for:
- ✅ `player.hand` updates when cards are played
- ✅ `player.discardPile` contains played cards
- ✅ `player.rebellion.lastDiceRoll` contains roll data
- ✅ `player.wars[targetId].lastBattle` contains battle data
- ✅ `player.lastLuxuryRoll` contains luxury roll

## Success Criteria

All tests pass if:
- ✅ Cards can be clicked and played without errors
- ✅ Dice results display in modals during rebellion, war, and luxury purchase
- ✅ Modals show accurate information with proper formatting
- ✅ Animations work smoothly
- ✅ No console errors
- ✅ Game state synchronizes correctly with Firebase
- ✅ UI is responsive and intuitive

## Known Limitations

- Dice roll modals appear automatically when state updates occur
- Modal clears dice roll data after 1 second to prevent re-showing
- Only one modal can be displayed at a time (sequential for multiple battles)

## Regression Testing

Verify that existing functionality still works:
- ✅ All 7 game phases advance correctly
- ✅ Victory conditions work
- ✅ Trading system functions
- ✅ Natural events trigger properly
- ✅ War tracks update correctly
- ✅ Stats calculations are accurate
