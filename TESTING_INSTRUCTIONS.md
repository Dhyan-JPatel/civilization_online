# Testing Instructions for Civilization Online

## Prerequisites

Before testing, ensure you have:
1. A modern web browser (Chrome, Firefox, Safari, or Edge)
2. Python 3.6+ installed (for local web server)
3. Internet connection (for Firebase SDK from CDN)
4. Firebase configuration set up (see DEPLOYMENT.md)

## Quick Start

### 1. Start Local Web Server

```bash
cd civilization_online
python3 -m http.server 8080
```

Or if you have Node.js installed:
```bash
npx http-server -p 8080
```

### 2. Open in Browser

Navigate to: `http://localhost:8080/index.html`

### 3. Run Automated Tests (Optional)

Navigate to: `http://localhost:8080/test.html`

This will verify:
- All files are present
- JavaScript structure is correct
- Firebase configuration is loaded

## Manual Testing Checklist

### Test 1: Welcome Screen
- [ ] Page loads without errors
- [ ] "Civilization Online" title is displayed
- [ ] Both "Join" and "Create" sections are visible
- [ ] Input fields are interactive
- [ ] Buttons are clickable

### Test 2: Create Game
1. [ ] Enter creator key: `BeforeRoboticsGame`
2. [ ] Enter your display name (e.g., "Player 1")
3. [ ] Click "Create Game"
4. [ ] Lobby screen should appear
5. [ ] Game code should be displayed (5 characters)
6. [ ] Your name should appear in the players list with a crown (👑)
7. [ ] "Start Game" button should be visible (you're the host)

### Test 3: Join Game (Second Browser/Tab)
1. [ ] Open a new browser tab or window
2. [ ] Navigate to `http://localhost:8080/index.html`
3. [ ] Enter the game code from Test 2
4. [ ] Enter a different display name (e.g., "Player 2")
5. [ ] Click "Join Game"
6. [ ] You should appear in the lobby
7. [ ] Both players should be visible in both windows

### Test 4: Copy Game Code
1. [ ] In the lobby screen, click "Copy" button next to game code
2. [ ] Paste the code in a text editor to verify it copied correctly
3. [ ] Verify the code matches what's displayed

### Test 5: Start Game
1. [ ] As the host, click "Start Game" button
2. [ ] Game screen should appear for all players
3. [ ] Phase should be "UPKEEP"
4. [ ] Round should be "1"
5. [ ] Player stats should be visible
6. [ ] Hand should display 4 cards
7. [ ] Farm count should be 1

### Test 6: Upkeep Phase
1. [ ] Verify initial stats:
   - Unrest: 0
   - Economy: (sum of red cards)
   - Military: (sum of black cards)
   - Food: 20 (from 1 farm)
   - Luxury: 0
   - Morale: 10 (Food/2)
   - Population: calculated value
   - Farms: 1

### Test 7: Phase Advancement
1. [ ] As host, click "Advance Phase"
2. [ ] Phase should change to "INTERNAL_PRESSURE"
3. [ ] Click "Advance Phase" again
4. [ ] Phase should change to "STATE_ACTIONS"
5. [ ] Action buttons should now be enabled

### Test 8: Buy Card Action
1. [ ] In STATE_ACTIONS phase, click "Buy Card (2 Economy)"
2. [ ] If you have >= 2 economy:
   - [ ] Card should be added to hand
   - [ ] Economy should update
   - [ ] Button should become disabled
   - [ ] Success message should appear
3. [ ] If you have < 2 economy:
   - [ ] Error message should appear

### Test 9: Buy Farm Action
1. [ ] In STATE_ACTIONS phase, click "Buy Farm (5 Economy)"
2. [ ] If you have >= 5 economy:
   - [ ] Farm count should increase by 1
   - [ ] Economy should update
   - [ ] Button should become disabled
   - [ ] Success message should appear
3. [ ] If you have < 5 economy:
   - [ ] Error message should appear

### Test 10: Buy Luxury Action
1. [ ] In STATE_ACTIONS phase, click "Buy Luxury (1 Economy)"
2. [ ] If you have >= 1 economy and unrest < 50:
   - [ ] Luxury should increase by die roll (1-6)
   - [ ] Dice roll result should be shown in alert
   - [ ] Button should become disabled
   - [ ] Success message should appear
3. [ ] If unrest >= 50:
   - [ ] Error message: "Cannot buy luxury with unrest >= 50"

### Test 11: Reduce Unrest Action
1. [ ] In STATE_ACTIONS phase, click "Reduce Unrest"
2. [ ] Unrest should decrease by 10 (minimum 0)
3. [ ] Button should become disabled
4. [ ] Success message should appear

### Test 12: War Actions
1. [ ] In STATE_ACTIONS phase, click "War Actions"
2. [ ] Modal should open
3. [ ] Other players should appear in opponent dropdown
4. [ ] Select an opponent and click "Declare War"
5. [ ] War should appear in "Current Wars" list
6. [ ] Close modal
7. [ ] War button should remain enabled (but declare war action is done)

### Test 13: Trading (UI Only)
1. [ ] In STATE_ACTIONS phase, click "Trading"
2. [ ] Modal should open
3. [ ] Other players should appear in target dropdown
4. [ ] Input fields for resources should be visible
5. [ ] Close modal

### Test 14: Full Round Cycle
1. [ ] Start at UPKEEP phase
2. [ ] Advance through all 7 phases:
   - UPKEEP
   - INTERNAL_PRESSURE
   - STATE_ACTIONS
   - WAR
   - REBELLION
   - NATURAL_EVENTS
   - CLEANUP
3. [ ] After CLEANUP, advancing should return to UPKEEP
4. [ ] Round counter should increment to 2

### Test 15: Hand Limit Enforcement
1. [ ] Buy cards until you have more than 10 cards
2. [ ] Advance to CLEANUP phase
3. [ ] Hand should be reduced to 10 cards
4. [ ] Extra cards should be discarded

### Test 16: Population Pressure
1. [ ] Play multiple rounds and accumulate population
2. [ ] When population reaches thresholds:
   - 30-49: Unrest +2 per round
   - 50-74: Unrest +4 per round
   - 75-99: Unrest +7 per round
   - 100+: Unrest +10 per round

### Test 17: Rebellion Trigger
1. [ ] Let unrest reach 100 or higher
2. [ ] In INTERNAL_PRESSURE phase, rebellion should trigger
3. [ ] Check rebellion status (UI shows active rebellion)

### Test 18: Economic Collapse
1. [ ] Spend all economy cards (discard them or don't draw new ones)
2. [ ] Let economy go below 0 if possible
3. [ ] Player should collapse
4. [ ] Status should show "COLLAPSED"

### Test 19: Reconnection
1. [ ] While in a game, refresh the page
2. [ ] Game should automatically reconnect
3. [ ] You should return to the correct screen (lobby or game)
4. [ ] All game state should be preserved

### Test 20: Leave Game
1. [ ] Click "Leave Game" button
2. [ ] Confirm the action
3. [ ] Should return to welcome screen
4. [ ] Player should be removed from game in other windows

### Test 21: Multiple Players
1. [ ] Create a game with 3-6 players
2. [ ] Verify all players appear in lobby
3. [ ] Start game
4. [ ] Verify all players see game screen
5. [ ] Take actions as different players
6. [ ] Verify state updates for all players in real-time

### Test 22: Mobile Responsiveness
1. [ ] Open game on mobile device or use browser dev tools
2. [ ] Verify layout adapts to small screens
3. [ ] Verify buttons are large enough to tap (48px minimum)
4. [ ] Test all interactions work on touch screen

### Test 23: Victory Condition
1. [ ] Have all other players collapse (economic or rebellion)
2. [ ] Last player standing should trigger victory
3. [ ] Victory banner should appear
4. [ ] Winner name should be displayed

## Troubleshooting

### Firebase Not Loading
- **Error**: "Failed to load Firebase SDK"
- **Solution**: Check internet connection and ensure Firebase CDN is accessible
- **Verify**: Open browser console and check for loading errors

### Game Code Not Working
- **Error**: "Game not found"
- **Solution**: Verify the game code is correct (5 characters, case-sensitive)
- **Verify**: Game may have expired or been deleted

### Actions Not Working
- **Error**: "Already performed action"
- **Solution**: Each action can only be done once per round in STATE_ACTIONS phase
- **Verify**: Advance to next round to reset actions

### Page Stuck on Loading
- **Error**: Blank screen or stuck
- **Solution**: Check browser console for errors
- **Verify**: Ensure Firebase configuration is correct (see DEPLOYMENT.md)

### Cannot See Other Players
- **Error**: Only see yourself in game
- **Solution**: Ensure both windows/tabs are connected to same game code
- **Verify**: Check that Firebase Realtime Database rules allow read/write

## Performance Testing

### Load Testing
1. Create multiple games simultaneously
2. Have multiple players join each game
3. Verify performance remains acceptable

### Latency Testing
1. Simulate slow network (browser dev tools)
2. Verify updates still sync correctly
3. Check for timeout handling

## Security Testing

### Input Validation
1. Try entering invalid game codes (special characters, too long, etc.)
2. Try entering invalid player names (empty, too long, etc.)
3. Verify proper error messages appear

### Action Validation
1. Try performing actions in wrong phase
2. Try performing same action twice
3. Try buying with insufficient resources
4. Verify all are rejected with proper errors

## Success Criteria

The game is considered fully operational if:
- ✅ All 23 test cases pass
- ✅ No console errors during normal gameplay
- ✅ Real-time synchronization works across multiple clients
- ✅ Game state persists across page reloads
- ✅ All 7 phases function correctly
- ✅ Victory conditions work properly
- ✅ Mobile UI is responsive and functional

## Reporting Issues

If you find bugs or issues:
1. Note the exact steps to reproduce
2. Check browser console for error messages
3. Note browser and version
4. Include game code and player count
5. Open an issue on GitHub with details

## Additional Resources

- **Game Rules**: See `civilization_game_manual.txt`
- **Deployment**: See `DEPLOYMENT.md`
- **Project Status**: See `PROJECT_STATUS.md`
- **Testing Guide**: See `TESTING_GUIDE.md`
