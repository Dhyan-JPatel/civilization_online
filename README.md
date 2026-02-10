# Civilization Online

Online multiplayer strategy game to play with friends. Build your empire without letting it collapse under its own weight!

## About

Civilization is a strategy card-and-dice game about building a powerful empire while managing internal pressures such as population strain, civil unrest, rebellion, famine, and economic collapse. Military strength alone won't win—victory belongs to the ruler who can expand, dominate, and still keep their civilization stable.

## Current Status: FULLY PLAYABLE ✅

**All game mechanics are now fully implemented and functional!**

All game phases are now implemented with complete logic:
- ✅ Create and join games with unique game codes
- ✅ Real-time player synchronization
- ✅ Mobile-friendly UI for iPhone/iPad
- ✅ Reconnection support via localStorage
- ✅ Full 7-phase turn structure with automatic processing
- ✅ Complete card system with Economy and Military cards
- ✅ Player stats tracking (Unrest, Economy, Military, Food, Luxury, Morale, Population)
- ✅ **War mechanics** - Battle resolution, casualties, siege, occupation
- ✅ **Rebellion system** - Dice pools, staged resolution, collapse conditions
- ✅ **Trading system** - Send/accept/reject offers, foreign interference
- ✅ **Natural events** - 4 event types with random selection (optional)
- ✅ **Victory conditions** - Last standing + 2-round survival requirement
- ✅ Secure Firebase configuration (no hardcoded secrets)
- ✅ All edge cases handled
- ✅ Zero security vulnerabilities (CodeQL verified)

**New in this update:**
- Complete WAR phase with battle resolution and casualty system
- Complete REBELLION phase with dice-based combat
- Complete NATURAL_EVENTS phase with 4 event types
- Fully functional trading system with offer acceptance/rejection
- Proper 2-round victory condition countdown
- All code quality issues addressed

## Features

### Complete Game Implementation
- **Lobby System**: Create and join games with unique 5-character codes
- **7-Phase Turn Structure**: 
  - UPKEEP: Automatic food production, morale, and population calculations
  - INTERNAL_PRESSURE: Food stress, siege pressure, economic collapse, foreign interference
  - STATE_ACTIONS: Buy cards/farms/luxury, declare war, trade, reduce unrest
  - WAR: War tracks, battles, sieges, occupation mechanics
  - REBELLION: Dice-based rebellion resolution with staged progression
  - NATURAL_EVENTS: Random events affecting players (optional)
  - CLEANUP: Hand limit enforcement and round cleanup
  
- **Card System**: 
  - 52-card deck per player (Economy = red, Military = black)
  - Hand management with 10-card limit
  - Draw and discard mechanics
  - **Interactive card playing** - Click cards to play/discard them
  - Confirmation dialogs for card actions
  
- **Stats & Resources**:
  - Unrest, Economy, Military, Food, Luxury, Morale, Population
  - Farm production system
  - Dynamic stat calculations
  
- **War & Combat**:
  - War track progression (0-7) with automatic battle resolution
  - Military comparison determines winner
  - Casualty dice (1d6) removes military cards from loser
  - **Visual battle results** - Animated modal shows military comparison, dice rolls, and outcomes
  - Siege at track 3+ (stops food production, +8 unrest)
  - Occupation at track 7 (civilization collapse)
  - Conqueror receives +5 unrest per occupied civilization
  - Handles zero military edge cases
  
- **Rebellion System**:
  - Triggered automatically at 100+ unrest
  - Dynamic dice pool calculation (base + modifiers)
  - Rebels: 2 base + population/siege/food/war bonuses
  - Government: 2 base + military/20 bonus dice
  - **Visual dice battle display** - Animated modal shows dice pools, rolls, and winner
  - 3-stage progression (Civil Disorder → Armed Uprising → Regime Collapse)
  - Different track changes per stage
  - Crushed at track 0 (-20 unrest reward)
  - Civilization collapse at track 6
  - Automatic resolution each REBELLION phase
  
- **Trading & Diplomacy**:
  - Send trade offers (food and luxury)
  - Accept or reject received offers
  - Real-time trade offer display
  - Foreign interference (+1 unrest for 1 economy)
  - Target must have 75+ unrest for interference
  - Max 10 interference per target per round
  - Trade restrictions at 50+ unrest
  - Transaction validation prevents cheating
  
- **Natural Events** (Optional):
  - 4 event types: Drought, Plague, Earthquake, Flood
  - Random player and event selection
  - Drought: Halves farm production next round
  - Plague: -5 luxury immediately
  - Earthquake: -1 farm immediately
  - Flood: -10 food immediately
  - Configurable at game creation
  - Events displayed in UI with emojis
  
- **Victory Conditions**:
  - Last civilization standing wins
  - Must survive 2 additional rounds without:
    - Active rebellion
    - Economic collapse (economy < 0)
  - Victory countdown displayed to all players
  - Countdown resets if disqualified or new players survive
  - Automatic winner determination
  
- **Real-time Multiplayer**:
  - Up to 6 players per game
  - Real-time updates via Firebase
  - Auto-reconnection after page reload
  - Mobile-optimized UI with touch targets
  
- **Enhanced UI/UX**:
  - **Interactive card system** - Click cards to play/discard with confirmation dialogs
  - **Animated dice result modals** - Beautiful display of all dice rolls with:
    - Rebellion battles showing rebel vs government dice pools
    - War battles showing military comparison and casualties
    - Luxury purchases showing dice roll results
  - Smooth animations (slideIn, fadeIn) for modal transitions
  - Clear visual feedback for all game actions

### Phase 1 (Complete)
- **Create Games**: Host creates a game using a creator key and receives a unique 5-character game code
- **Join Games**: Players join with game code + display name (no account required)
- **Real-time Updates**: All players see changes instantly via Firebase Realtime Database
- **Reconnection**: Automatically reconnect after page reload
- **Mobile-Friendly**: Optimized for touch devices and narrow viewports
- **Secure**: No Firebase credentials committed to repository

### Phases 2-5 (Complete)
- Full 7-phase turn structure with automatic calculations
- Complete card and dice mechanics
- War system with progressive stages
- Rebellion tracking and resolution
- Trading and foreign interference
- Natural events (optional, configurable at game creation)
- Victory condition detection
- Touch-optimized UI for iPhone/iPad
- Action validation and server-side transactions

## Getting Started

### For Players

See [GAMEPLAY_GUIDE.md](GAMEPLAY_GUIDE.md) for complete gameplay instructions including:
- All 7 game phases explained
- Player actions and strategies
- Victory conditions
- Trading and diplomacy
- War and rebellion mechanics

### For Developers

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup and deployment instructions.

Quick start:
1. Edit `firebase-config-loader.js` with your Firebase project configuration
2. Run a local web server: `python3 -m http.server 8080` or `npm start`
3. Open `test.html` in your browser to verify setup
4. Open `index.html` to start the game
5. Use creator key: `abcd` to create a game
6. Open another tab to join as a second player

**Note**: For production deployment, configure `firebase-config-loader.js` to fetch configuration from a secure endpoint rather than embedding it directly.

### Testing Your Setup

1. **Run Automated Tests**: Open `test.html` in your browser to verify:
   - All files are present
   - JavaScript structure is correct
   - Firebase configuration is valid
   
2. **Manual Testing**: See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing procedures

### For Players

1. Get the game link from your host
2. Enter the game code provided by your host
3. Choose a display name
4. Wait for the host to start the game

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database**: Firebase Realtime Database
- **Firebase SDK**: Modular v10.7.1 (loaded via CDN)
- **Hosting**: Static site (can be hosted on Firebase Hosting, Netlify, Vercel, etc.)
- **Dependencies**: Documented in package.json (external CDN dependencies)

## Project Structure

```
civilization_online/
├── index.html              # Main HTML (no secrets)
├── main.js                 # Application logic with modular Firebase
├── style.css               # Responsive mobile-first styles
├── firebase-config-loader.js  # Runtime configuration loader
├── test.html               # Automated test page
├── package.json            # Dependency documentation
├── civilization_game_manual.txt  # Complete game rules
├── DEPLOYMENT.md           # Setup and deployment guide
├── LICENSE                 # Apache 2.0 License
└── README.md               # This file
```

## Security

- Firebase configuration is loaded via `firebase-config-loader.js` which supports:
  - Runtime injection from environment variables
  - Fetching from a secure backend endpoint
  - Direct configuration for development (not recommended for production)
- No secrets are committed to the repository (firebaseconfig.txt is .gitignored)
- All database writes use Firebase transactions for consistency
- See DEPLOYMENT.md for secure configuration methods

## Game Rules

See [civilization_game_manual.txt](civilization_game_manual.txt) for complete game rules including:
- Win conditions
- 7-phase turn structure
- Stats and resource management
- War and rebellion mechanics
- Trading and diplomacy

## Contributing

This project implements the complete Civilization Online game. All phases (1-5) are complete and ready for testing.

To play:
1. Create a game using the creator key
2. Share the game code with friends
3. Start the game when all players have joined
4. Follow the 7-phase turn structure
5. Manage your civilization to avoid collapse and achieve victory

See [civilization_game_manual.txt](civilization_game_manual.txt) for complete game rules.

## License

Apache 2.0 - See [LICENSE](LICENSE) file for details.

## Support

For issues or questions, open an issue on GitHub.
