# Testing Guide for Civilization Online

This guide provides comprehensive testing steps to ensure all game features work correctly.

## Prerequisites

1. Set up Firebase Realtime Database
2. Configure `index.dev.html` with your Firebase credentials (see DEPLOYMENT.md)
3. Open the application in a web browser (preferably Safari for iOS, Chrome for Android)

## Quick Start Testing

### Basic Functionality (5 minutes)

1. **Create Game**
   - Open the application
   - Enter creator key: `BeforeRoboticsGame`
   - Enter your name
   - Toggle "Enable Natural Events" (test both on and off)
   - Click "Create Game"
   - ✅ Verify: Game code is displayed (5 characters)
   - ✅ Verify: You are shown in the players list with "Host" badge

2. **Join Game** (use second browser/tab)
   - Open the application in a new tab/window
   - Enter the game code from step 1
   - Enter a different name
   - Click "Join Game"
   - ✅ Verify: You appear in the lobby
   - ✅ Verify: Both players are visible in both tabs

3. **Start Game** (as host)
   - Click "Start Game"
   - Confirm the dialog
   - ✅ Verify: Game screen appears
   - ✅ Verify: Phase shows "UPKEEP"
   - ✅ Verify: Round shows "1"
   - ✅ Verify: Your hand shows 4 cards
   - ✅ Verify: Stats are visible (Economy, Military, etc.)

## Comprehensive Testing (30-45 minutes)

### Phase 1: UPKEEP (Automatic)

1. **Initial State**
   - ✅ Verify: Economy = sum of red cards
   - ✅ Verify: Military = sum of black cards
   - ✅ Verify: Food = 0 (no farms yet)
   - ✅ Verify: Morale = 0
   - ✅ Verify: Population = Military value
   - ✅ Verify: Unrest = 0

2. **Advance to Next Phase** (host only)
   - Click "Advance Phase"
   - ✅ Verify: Phase changes to "INTERNAL_PRESSURE"

### Phase 2: INTERNAL_PRESSURE (Automatic)

1. **Economic Collapse Check**
   - If you have 0 red cards, Unrest should increase by +10
   - ✅ Verify: Unrest increases if economy = 0

2. **Advance Phase**
   - Click "Advance Phase"
   - ✅ Verify: Phase changes to "STATE_ACTIONS"

### Phase 3: STATE_ACTIONS (Player Actions)

#### Economic Actions (one per round)

1. **Buy Card**
   - Click "Buy Card (2 Economy)"
   - ✅ Verify: If economy >= 2, card is added to hand
   - ✅ Verify: Hand count increases by 1
   - ✅ Verify: Economy/Military recalculated
   - ✅ Verify: Button becomes disabled
   - ✅ Verify: Error if economy < 2

2. **Buy Farm** (in a new round, as you can only do one economic action)
   - Advance through phases to next round
   - Click "Buy Farm (5 Economy)"
   - ✅ Verify: If economy >= 5, farms increase by 1
   - ✅ Verify: Button becomes disabled
   - ✅ Verify: Error if economy < 5

3. **Buy Luxury**
   - In a new round
   - Click "Buy Luxury (1 Economy)"
   - Enter amount (e.g., 3)
   - ✅ Verify: Dice are rolled (amount times)
   - ✅ Verify: Luxury stat increases
   - ✅ Verify: Button becomes disabled

#### Domestic Actions

4. **Reduce Unrest**
   - Click "Reduce Unrest"
   - ✅ Verify: Unrest decreases by 10
   - ✅ Verify: Button becomes disabled
   - ✅ Verify: Unrest doesn't go below 0

#### Military Actions

5. **War Actions**
   - Click "War Actions"
   - ✅ Verify: Modal opens
   - Select an opponent from dropdown
   - Click "Declare War"
   - ✅ Verify: Success message
   - ✅ Verify: Modal closes

#### Diplomatic Actions

6. **Trading**
   - Click "Trading"
   - ✅ Verify: Modal opens
   - Select a player from dropdown
   - Enter resources to offer (e.g., Economy: 5)
   - Enter resources to request (e.g., Food: 10)
   - Click "Send Trade Offer"
   - ✅ Verify: Success message
   - ✅ Verify: Other player sees trade offer
   - ✅ As other player: Accept trade
   - ✅ Verify: Resources transfer correctly

7. **Advance Phase**
   - Click "Advance Phase"
   - ✅ Verify: Phase changes to "WAR"

### Phase 4: WAR

1. **War Resolution** (requires active war)
   - If war was declared, host can conduct battles
   - ✅ Verify: War track updates
   - ✅ Verify: Casualties are applied

2. **Advance Phase**
   - Click "Advance Phase"
   - ✅ Verify: Phase changes to "REBELLION"

### Phase 5: REBELLION

1. **No Rebellion**
   - If unrest < 100, phase should be skipped
   - ✅ Verify: No rebellion active

2. **Active Rebellion** (test by increasing unrest to 100+)
   - Use multiple rounds to build up unrest
   - ✅ Verify: Rebellion track starts at 2
   - ✅ Verify: Dice are rolled (rebels vs government)
   - ✅ Verify: Track moves based on outcome
   - ✅ Verify: Rebellion ends at track 0 or 6

3. **Advance Phase**
   - Click "Advance Phase"
   - ✅ Verify: Phase changes to "NATURAL_EVENTS"

### Phase 6: NATURAL_EVENTS

1. **Natural Events Enabled**
   - If enabled at game creation
   - ✅ Verify: Random player is affected
   - ✅ Verify: Event type is applied (drought/plague/earthquake/flood)
   - ✅ Verify: Stats update accordingly

2. **Natural Events Disabled**
   - If disabled at game creation
   - ✅ Verify: Phase is skipped

3. **Advance Phase**
   - Click "Advance Phase"
   - ✅ Verify: Phase changes to "CLEANUP"

### Phase 7: CLEANUP

1. **Hand Limit**
   - If hand has > 10 cards
   - ✅ Verify: Can discard cards
   - ✅ Verify: Economy/Military recalculated

2. **Advance Phase**
   - Click "Advance Phase"
   - ✅ Verify: Phase returns to "UPKEEP"
   - ✅ Verify: Round number increases by 1
   - ✅ Verify: Action flags reset (can perform actions again)

### Complete Round Cycle

1. **Farm Production**
   - After buying farms, advance to next round
   - In UPKEEP phase:
   - ✅ Verify: Food increases by (farms × 20)
   - ✅ Verify: Morale recalculates (luxury + food/2)
   - ✅ Verify: Population recalculates

2. **Population Pressure**
   - Build up population to test thresholds:
   - ✅ Verify: 30-49 pop = +2 unrest
   - ✅ Verify: 50-74 pop = +4 unrest
   - ✅ Verify: 75-99 pop = +7 unrest
   - ✅ Verify: 100+ pop = +10 unrest

## Victory Condition Testing

1. **Simulate Collapse**
   - Build unrest to 100+ and fail rebellion
   - ✅ Verify: Civilization collapses

2. **Last Civilization Standing**
   - Have all but one player collapse
   - ✅ Verify: Victory watch starts
   - ✅ Verify: Winner must survive 2 rounds
   - ✅ Verify: Victory banner appears

3. **Victory Reset**
   - If winner has rebellion or economic collapse
   - ✅ Verify: Victory watch resets to 2 rounds

## Mobile Testing

### iPhone/iPad (Safari)

1. **Layout**
   - ✅ Verify: All elements are visible
   - ✅ Verify: No horizontal scrolling
   - ✅ Verify: Touch targets are at least 48px
   - ✅ Verify: Stats grid adapts to screen size

2. **Touch Interactions**
   - ✅ Verify: Buttons respond to touch
   - ✅ Verify: Modals open/close correctly
   - ✅ Verify: Inputs work with virtual keyboard
   - ✅ Verify: Cards are touch-friendly

3. **Orientation**
   - ✅ Verify: Portrait mode works
   - ✅ Verify: Landscape mode works

### Android (Chrome)

1. **Layout**
   - ✅ Verify: Same as iPhone testing

2. **Touch Interactions**
   - ✅ Verify: Same as iPhone testing

## Reconnection Testing

1. **Page Reload**
   - During active game, reload the page
   - ✅ Verify: Returns to game screen (not lobby)
   - ✅ Verify: All stats are correct
   - ✅ Verify: Current phase is displayed

2. **Multiple Devices**
   - Join from desktop, then from mobile
   - ✅ Verify: Both connections work
   - ✅ Verify: Updates sync in real-time

## Multi-Player Testing

1. **2-6 Players**
   - Test with different player counts
   - ✅ Verify: All players see updates
   - ✅ Verify: Turn order is maintained
   - ✅ Verify: Actions are validated per player

2. **Max Players**
   - Try to join with 7th player
   - ✅ Verify: Error message (game is full)

3. **Simultaneous Actions**
   - Multiple players act at same time
   - ✅ Verify: Transactions prevent conflicts
   - ✅ Verify: Stats update correctly

## Error Handling Testing

1. **Invalid Inputs**
   - Try to buy card with 0 economy
   - ✅ Verify: Error message displays
   - Try to perform second economic action
   - ✅ Verify: Error message displays

2. **Network Issues**
   - Disconnect network, perform action
   - ✅ Verify: Error is handled gracefully
   - Reconnect network
   - ✅ Verify: State is restored

3. **Invalid Game Code**
   - Try to join with wrong code
   - ✅ Verify: Error message displays

## Performance Testing

1. **Long Game**
   - Play for 10+ rounds
   - ✅ Verify: No performance degradation
   - ✅ Verify: Database updates remain fast

2. **Large Hand**
   - Draw cards to approach 10-card limit
   - ✅ Verify: Display remains responsive
   - ✅ Verify: Cards are laid out correctly

## Security Testing

1. **Creator Key**
   - Try to create game without key
   - ✅ Verify: Error message
   - Try with wrong key
   - ✅ Verify: Error message

2. **Host Controls**
   - As non-host, try to advance phase (via console)
   - ✅ Verify: Action is rejected

3. **Action Validation**
   - Try to perform invalid actions (via console)
   - ✅ Verify: Transactions reject invalid state changes

## Browser Compatibility

Test on:
- ✅ Safari (iOS)
- ✅ Chrome (Android)
- ✅ Chrome (Desktop)
- ✅ Firefox (Desktop)
- ✅ Safari (macOS)
- ✅ Edge (Windows)

## Accessibility

1. **Keyboard Navigation**
   - ✅ Verify: Can tab through inputs
   - ✅ Verify: Can activate buttons with Enter

2. **Screen Reader** (basic)
   - ✅ Verify: Labels are readable
   - ✅ Verify: Stat values are announced

## Known Issues & Limitations

- Emergency cards not yet implemented
- Rebellion dice roll not visualized for players
- Battle resolution requires host manual action
- No in-game chat/communication system

## Reporting Issues

When reporting bugs, please include:
1. Browser and device type
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots if applicable
5. Console errors (if any)

## Summary

This comprehensive testing guide covers all game phases, features, and edge cases. Complete testing should take 30-45 minutes with 2-3 players.

For quick validation, focus on the "Quick Start Testing" section (5 minutes).
