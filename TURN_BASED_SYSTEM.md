# Turn-Based Player Action System

## Overview

The game now implements a turn-based system during the STATE_ACTIONS phase where only one player can perform actions at a time. This ensures orderly gameplay and prevents race conditions while maintaining all existing game mechanics.

## How It Works

### Turn Order

1. **Joining Order**: Players are added to the turn order in the sequence they join the game
   - The host (game creator) is always first
   - Subsequent players are added in their joining order

2. **Turn Tracking**: 
   - `turnOrder` array stores player IDs in order
   - `currentTurnIndex` tracks position in the turn order
   - System automatically skips collapsed/eliminated players

### During STATE_ACTIONS Phase

**For the Current Player:**
- All action buttons are enabled (subject to normal game rules)
- "YOUR TURN" message is displayed in green
- "End Turn" button is visible and enabled
- Can perform any available actions

**For Other Players:**
- All action buttons are disabled
- "Waiting for [Player Name]'s turn..." message is displayed in orange
- Cannot perform any actions
- Can view game state and other players' stats

### Turn Transitions

1. Current player clicks "End Turn" button
2. Turn advances to next active player in the turn order
3. Cycle repeats through all active players
4. When the last player ends their turn, cycle returns to first player

### Phase Transitions

When STATE_ACTIONS phase ends and UPKEEP phase begins:
- Turn index resets to the first active player
- All action counters are reset
- Turn cycle starts fresh for the new round

## Technical Implementation

### Key Functions

**`isPlayerTurn(game, playerId)`**
- Checks if it's currently a specific player's turn
- Returns `true` only during STATE_ACTIONS phase for the current turn player
- Returns `true` for all players during other phases (no turn restriction)

**`getCurrentTurnPlayer(game)`**
- Returns the player ID of the current turn player
- Automatically skips collapsed players
- Returns `null` if all players are collapsed

**`advanceTurn()`**
- Advances to the next active player in turn order
- Skips collapsed players automatically
- Uses Firebase transaction for consistency
- Only works during STATE_ACTIONS phase

**`validatePlayerTurn(game, playerId)`**
- Helper function that throws an error if it's not the player's turn
- Used in all action functions for consistent validation
- Provides clear error message with current turn player's name

### Modified Action Functions

All STATE_ACTIONS phase functions now validate turns:
- `buyCard()`
- `buyFarm()`
- `buyLuxury()`
- `reduceUnrest()`
- `declareWar()`
- `sendTradeOffer()`
- `playEmergencyCard()`

Each function:
1. Validates it's STATE_ACTIONS phase
2. Validates it's the player's turn (throws error if not)
3. Proceeds with normal action logic

### UI Components

**Turn Info Display** (`#turnInfo`)
- Shows "YOUR TURN" in green when it's your turn
- Shows "Waiting for [Name]'s turn..." in orange when it's not

**End Turn Button** (`#actionEndTurn`)
- Visible only during STATE_ACTIONS phase
- Enabled only for current turn player
- Green button with checkmark icon

**Turn Order List** (`#otherPlayersList`)
- Shows all players in turn order
- Current turn player marked with 🎯 emoji
- Current turn player has green border during STATE_ACTIONS
- Includes "(You)" indicator for current player's row

## Database Structure

```javascript
{
  games: {
    [gameCode]: {
      turnOrder: ['player1_id', 'player2_id', 'player3_id'],  // Order of play
      currentTurnIndex: 0,  // Index in turnOrder array (0-based)
      phase: 'STATE_ACTIONS',  // Current game phase
      // ... other game data
      players: {
        'player1_id': { /* player data */ },
        'player2_id': { /* player data */ },
        'player3_id': { /* player data */ }
      }
    }
  }
}
```

## Edge Cases Handled

1. **Player Collapse**: Collapsed players are automatically skipped in turn order
2. **Player Disconnection**: Disconnected players remain in turn order but their turn would need to be skipped manually (future enhancement)
3. **All Players Collapsed**: System gracefully handles case where all players are eliminated
4. **Mid-Turn Collapse**: If current player collapses during their turn, their turn continues (they can still act if not completely eliminated)

## Security Considerations

1. **XSS Protection**: Player names are sanitized before display to prevent XSS attacks
2. **Transaction Safety**: Firebase transactions ensure turn advancement is atomic
3. **Turn Validation**: Server-side validation prevents cheating by checking turns
4. **No Race Conditions**: Only one player can act at a time, eliminating race conditions

## Future Enhancements

Potential improvements for consideration:
1. **Turn Timer**: Add optional timer to limit turn duration
2. **Skip Turn Option**: Allow players to skip their turn manually
3. **Turn History**: Log which player took which actions on their turn
4. **Reconnection Handling**: Better handling of disconnected players in turn order
5. **Host Override**: Allow host to manually advance turns if a player is unresponsive

## Testing Recommendations

When testing the turn-based system:
1. Create a game with 3+ players
2. Verify only current player can take actions
3. Test "End Turn" button advances correctly
4. Test with player collapse (verify skipping)
5. Verify turn order display shows correct indicators
6. Test phase transitions reset turn to first player
7. Verify error messages when attempting actions out of turn
