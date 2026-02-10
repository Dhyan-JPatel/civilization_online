# Card and Dice Mechanics - Demo Guide

This guide demonstrates the new card playing and dice roll visualization features.

## Quick Demo Setup

### Prerequisites
- Browser with JavaScript enabled
- Local server running on port 8080
- Firebase configuration set up

### 5-Minute Demo

#### 1. Card Playing Feature (2 minutes)

**Setup:**
1. Open `http://localhost:8080/index.html`
2. Create game with creator key: `abcd`
3. Enter player name: "Player1"
4. Start the game

**Demo:**
1. Advance to STATE_ACTIONS phase
2. Click "Buy Card (2 Economy)" - see card appear in hand
3. **New Feature:** Hover over any card - cursor changes to pointer with tooltip
4. **New Feature:** Click on a card - confirmation dialog appears
5. **New Feature:** Click "OK" - card is removed and discarded
6. Notice hand count decreases

**Expected:**
- ✅ Cards are clickable
- ✅ Confirmation dialog shows card details
- ✅ Card removed from hand after confirmation
- ✅ Success alert displayed

---

#### 2. Luxury Dice Roll (1 minute)

**Demo:**
1. In STATE_ACTIONS phase, ensure economy ≥ 1 and unrest < 50
2. Click "Buy Luxury (1 Economy)"
3. **New Feature:** Animated modal appears showing dice roll
4. See large dice emoji, roll result (1-6), and luxury gained
5. Click "OK" to close
6. Verify luxury stat increased

**Expected:**
- ✅ Smooth modal animation
- ✅ Clear dice result display
- ✅ Luxury stat updates correctly
- ✅ No more simple alert

---

#### 3. Rebellion Dice Battle (2 minutes)

**Setup:**
1. Use Firebase console or game mechanics to increase unrest to 100+
2. Rebellion automatically starts

**Demo:**
1. Advance to REBELLION phase (or wait for host to advance)
2. **New Feature:** Animated modal shows rebellion battle
3. See two columns:
   - **Rebels**: Dice pool size, individual rolls, total
   - **Government**: Dice pool size, individual rolls, total
4. See winner declared with emoji
5. Click "OK" to close

**Expected:**
- ✅ Dice pools displayed clearly
- ✅ Individual die results visible
- ✅ Totals calculated correctly
- ✅ Winner clearly indicated
- ✅ Smooth animations

---

#### 4. War Battle Results (Optional - if time permits)

**Setup:**
1. Have 2 players in game
2. One declares war during STATE_ACTIONS
3. Advance to WAR phase

**Demo:**
1. Battle automatically resolves
2. **New Feature:** Modal shows battle results
3. See military comparison (attacker vs defender)
4. See casualty dice roll (if applicable)
5. See cards lost and outcome
6. Click "OK" to close

**Expected:**
- ✅ Battle details displayed
- ✅ Casualty roll shown
- ✅ Clear victory/defeat indication
- ✅ War track change explained

---

## Visual Highlights

### Before (Old Behavior)
- Cards displayed but not clickable ❌
- Simple JavaScript alert for luxury: "Luxury purchased! Rolled: 3" ❌
- No visual feedback for rebellion dice rolls ❌
- No visual feedback for war battles ❌

### After (New Behavior)
- Cards have click handlers with confirmation ✅
- Beautiful modal for luxury with large dice emoji ✅
- Rebellion modal shows full dice battle breakdown ✅
- War modal shows complete battle results ✅
- Smooth animations for all modals ✅

---

## Screenshots (Conceptual)

### Card Click Handler
```
┌────────────────────────────────────┐
│ Your Hand (5/10)                   │
├────────────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │
│ │5♥│ │K♠│ │2♦│ │9♣│ │A♥│         │
│ └──┘ └──┘ └──┘ └──┘ └──┘         │
│  ^cursor:pointer, click to discard │
└────────────────────────────────────┘
```

### Dice Result Modal
```
┌─────────────────────────────────────┐
│        🎲 Dice Roll Results         │
├─────────────────────────────────────┤
│                                     │
│   👥 Rebels        🛡️ Government   │
│   3 dice          2 dice            │
│   [4, 2, 6]       [5, 3]           │
│   Total: 12       Total: 8         │
│                                     │
│        👥 Rebels Win!               │
│                                     │
│            [  OK  ]                 │
└─────────────────────────────────────┘
```

---

## Technical Notes

### Deduplication Logic
- Uses window-level tracking variables to prevent showing same result multiple times
- Each modal type tracks its own "last shown" value
- Ensures players see results once per occurrence

### Data Persistence
- Dice results stored in Firebase (rebellion.lastDiceRoll, war.lastBattle, player.lastLuxuryRoll)
- Automatically synced across all players
- Natural cleanup as game progresses

### Animations
- `slideIn`: Modal slides down from top (0.3s)
- `fadeIn`: Content fades in (0.5s)
- Smooth, non-jarring transitions

---

## Troubleshooting

### Card Click Not Working?
- Check browser console for errors
- Ensure game is loaded and player is in game
- Verify hand is not empty

### Dice Modal Not Appearing?
- Check if unrest ≥ 100 for rebellion
- Verify war is declared for battle results
- Ensure game phase is correct

### Modal Shows Multiple Times?
- Refresh page to reset tracking variables
- Check Firebase data for duplicate entries

---

## Next Steps

After demo:
1. ✅ Card playing works correctly
2. ✅ All dice rolls have visual feedback
3. ✅ Modals display with smooth animations
4. ✅ No JavaScript errors
5. ✅ Firebase synchronization intact

Ready for production! 🎉
