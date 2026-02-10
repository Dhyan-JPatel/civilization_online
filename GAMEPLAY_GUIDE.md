# Civilization Online - Complete Gameplay Guide

## Overview

Civilization Online is a fully functional multiplayer strategy game where you build and manage your civilization while competing with other players. Victory requires balancing expansion, military strength, and internal stability.

## Game Setup

1. **Creating a Game**: 
   - Host enters the creator key
   - Enters their display name
   - Optionally enables natural events
   - Receives a unique 5-character game code
   
2. **Joining a Game**:
   - Players enter the game code
   - Enter their display name
   - Wait in lobby for host to start

3. **Starting the Game**:
   - Host clicks "Start Game" when all players are ready
   - Each player starts with 4 cards and 1 farm

## 7-Phase Turn Structure

### Phase 1: UPKEEP (Automatic)

**Food Production**:
- Each farm produces 20 food
- ⚠️ No production if under siege (war track ≥ 3)
- 🌾 Drought effect: halved production for one round

**Stat Calculations**:
- Economy = sum of red cards in hand
- Military = sum of black cards in hand
- Morale = Luxury + (Food ÷ 2)
- Population = ⌊(Luxury × √Food) ÷ (Morale ÷ 10 + 1)⌋ + Military

**Population Pressure**:
- 30-49 population: +2 unrest
- 50-74 population: +4 unrest
- 75-99 population: +7 unrest
- 100+ population: +10 unrest

### Phase 2: INTERNAL PRESSURE (Automatic)

**Food Stress**:
- Food < Population: +5 unrest
- Food < 0: +10 unrest

**Siege Pressure**:
- +8 unrest per round if any war track ≥ 3

**Economic Collapse**:
- If economy reaches 0: +10 unrest and civilization collapses

**Rebellion Trigger**:
- At 100+ unrest: rebellion automatically starts at track 2

### Phase 3: STATE ACTIONS (Player Actions)

**Available Actions** (1 per category per round):

1. **Buy Card** (2 economy)
   - Draw one card from your deck
   - Hand limit: 10 cards

2. **Buy Farm** (5 economy)
   - Increases food production by 20/round

3. **Buy Luxury** (1 economy)
   - Roll 1d6, add result to luxury
   - ⚠️ Cannot buy if unrest ≥ 50

4. **Reduce Unrest**
   - Reduces unrest by 10

5. **Declare War**
   - Opens war track (0-7) with target player
   - Both players now at war

6. **Send Trade Offer**
   - Offer resources (food, luxury)
   - Request resources in return
   - ⚠️ Cannot trade if unrest ≥ 50

7. **Foreign Interference** (via diplomacy)
   - Costs 1 economy
   - +1 unrest to target
   - Target must have 75+ unrest
   - Max 10 interference per target per round

### Phase 4: WAR (Automatic Resolution)

**Battle Resolution**:
- Compare military values (attacker vs defender)
- Attacker wins ties
- Victory margin determines track progression:
  - Clear victory (margin ≥ 50% of defender): +2 track
  - Minor victory: +1 track
  - Defender victory: -1 track

**Casualties**:
- Loser rolls 1d6 casualty die
- Lose corresponding fraction of military cards:
  - 1: lose 1/6 of military cards
  - 2: lose 2/6
  - 3: lose 3/6
  - 4: lose 4/6
  - 5: lose 5/6
  - 6: lose all military cards

**War Track Stages**:
- **0-2**: Border Conflict
- **3-4**: Siege State (no food production, +8 unrest)
- **5-6**: Capital Threatened
- **7**: Civilization Collapse (occupation)

**Occupation**:
- Conquered civilization collapses
- Conqueror gains +5 unrest per round

### Phase 5: REBELLION (Automatic Resolution)

**Dice Pools**:

Rebel Dice:
- Base: 2 dice
- +1 if population ≥ 75
- +1 if under siege
- +1 if food shortage
- +1 if war track ≥ 5

Government Dice:
- Base: 2 dice
- +1 per 20 military value

**Resolution**:
- Both sides roll their dice pools
- Total values compared

**Outcomes by Stage**:

**Stage 1: Civil Disorder**
- Rebel win: track +1
- Government win: track -1

**Stage 2: Armed Uprising**
- Rebel win: track +2
- Government win: track -1

**Stage 3: Regime Collapse**
- Rebel win: track +2
- Government win: track -2

**Track Results**:
- Track reaches 0: Rebellion crushed, -20 unrest
- Track reaches 6: Civilization collapses
- Track 2-3: Stage 1-2
- Track 4+: Stage 3

### Phase 6: NATURAL EVENTS (Automatic, if enabled)

Random player selected, random event applied:

1. **Drought** (25% chance)
   - Next round: farm production halved

2. **Plague** (25% chance)
   - Lose 5 luxury immediately

3. **Earthquake** (25% chance)
   - Lose 1 farm immediately

4. **Flood** (25% chance)
   - Lose 10 food immediately

### Phase 7: CLEANUP (Automatic)

- Discard cards over hand limit (10)
- Clear processed trade offers
- Reset interference tracking
- Advance to next round

## Victory Conditions

**Win Condition**:
- Last civilization standing (all others collapsed)
- No draw condition - game continues among survivors

**Collapse Triggers**:
1. Economic collapse (economy reaches 0)
2. Rebellion success (track reaches 6)
3. Military occupation (war track reaches 7)

## Trading System

**Sending Trade Offers**:
1. Open Trade modal
2. Select target player
3. Enter resources to offer (food, luxury)
4. Enter resources to request
5. Click "Send Trade Offer"

**Receiving Trade Offers**:
- View offers in Trade modal
- Accept: resources transfer immediately
- Reject: offer is cancelled

**Trade Restrictions**:
- Cannot trade with unrest ≥ 50
- Economy values cannot be directly traded (cards stay with players)
- One trade offer per round

## Strategy Tips

1. **Balance Growth and Stability**
   - High population increases unrest
   - Manage luxury to control morale

2. **War Carefully**
   - Battles cost military cards
   - Siege damages enemy economy
   - Occupation increases your unrest

3. **Watch Your Unrest**
   - 50+: Can't buy luxury or trade
   - 75+: Vulnerable to foreign interference
   - 100+: Rebellion starts

4. **Food Management**
   - Produce more than population needs
   - Shortage causes unrest
   - Farms are permanent investments

5. **Rebellion Prevention**
   - Reduce unrest before it reaches 100
   - Keep military high for government dice
   - Avoid siege and food shortage

6. **Timing is Key**
   - Host controls phase advancement
   - Coordinate actions in STATE_ACTIONS phase
   - Plan for automatic phase effects

## UI Overview

**Main Dashboard**:
- **Stats Display**: All 7 core stats + farms
- **Phase Indicator**: Current phase and round number
- **Hand Display**: Your cards with suit symbols
- **Other Players**: Quick view of opponents' stats
- **Action Buttons**: Context-sensitive based on phase

**Modals**:
- **War Modal**: Declare war, view active wars with tracks
- **Trade Modal**: Send offers, accept/reject received offers
- **Rebellion Modal**: View rebellion status and stage

**Host Controls**:
- Only visible to game host
- "Advance Phase" button
- Responsible for progressing game

## Mobile Support

- Fully responsive design
- Touch-optimized buttons (48px minimum)
- Works on iPhone, iPad, and Android devices
- Safari and Chrome compatible

## Reconnection

- Automatic reconnection after page reload
- Game state restored via localStorage
- Real-time updates when reconnected

## Technical Notes

- All game logic processed server-side via Firebase transactions
- Atomic updates prevent race conditions
- Real-time synchronization across all players
- No client-side cheating possible

## Troubleshooting

**Can't perform action**:
- Check current phase (actions only in STATE_ACTIONS)
- Check if you already used that action this round
- Check if you have sufficient resources
- Check unrest restrictions

**Game not advancing**:
- Only host can advance phases
- Check if host is still connected

**Trade not working**:
- Both players must have offered resources
- Check unrest levels (must be < 50)
- One trade per round limit

**Rebellion won't end**:
- Rebellion resolves one stage per REBELLION phase
- Track must reach 0 (crushed) or 6 (collapse)
- Improve military for better government dice

## Credits

Based on the Civilization card game rulebook. Implemented as an online multiplayer experience with real-time synchronization and automatic phase processing.

Enjoy building your empire! 🏛️
