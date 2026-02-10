# Civilization Online

Online multiplayer strategy game to play with friends. Build your empire without letting it collapse under its own weight!

## About

Civilization is a strategy card-and-dice game about building a powerful empire while managing internal pressures such as population strain, civil unrest, rebellion, famine, and economic collapse. Military strength alone won't win—victory belongs to the ruler who can expand, dominate, and still keep their civilization stable.

## Current Status: Phases 1-5 Complete ✅

All game phases are now implemented:
- ✅ Create and join games with unique game codes
- ✅ Real-time player synchronization
- ✅ Mobile-friendly UI for iPhone/iPad
- ✅ Reconnection support via localStorage
- ✅ Full 7-phase turn structure (UPKEEP, INTERNAL_PRESSURE, STATE_ACTIONS, WAR, REBELLION, NATURAL_EVENTS, CLEANUP)
- ✅ Complete card system with Economy and Military cards
- ✅ Player stats tracking (Unrest, Economy, Military, Food, Luxury, Morale, Population)
- ✅ War mechanics with progressive stages and occupation
- ✅ Rebellion system with dice pools and staged resolution
- ✅ Farm management and food production
- ✅ Trading and diplomacy system
- ✅ Natural events (optional)
- ✅ Victory conditions
- ✅ Secure Firebase configuration (no hardcoded secrets)

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
  
- **Stats & Resources**:
  - Unrest, Economy, Military, Food, Luxury, Morale, Population
  - Farm production system
  - Dynamic stat calculations
  
- **War & Combat**:
  - War track progression (0-7)
  - Siege mechanics at track 3+
  - Occupation at track 7
  - Battle outcomes with casualty rolls
  
- **Rebellion System**:
  - Triggered at 100+ unrest
  - Dice pools for rebels vs government
  - Staged resolution (Civil Disorder → Armed Uprising → Regime Collapse)
  
- **Trading & Diplomacy**:
  - Trade offers for resources
  - Foreign interference for destabilization
  - Trade validation and enforcement
  
- **Victory Conditions**:
  - Last civilization standing
  - Must survive 2 rounds without rebellion or economic collapse
  
- **Real-time Multiplayer**:
  - Up to 6 players per game
  - Real-time updates via Firebase
  - Auto-reconnection after page reload
  - Mobile-optimized UI with touch targets

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

### For Developers

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup and deployment instructions.

Quick start:
1. Edit `firebase-config-loader.js` with your Firebase project configuration
2. Run a local web server: `python3 -m http.server 8080` or `npm start`
3. Open `test.html` in your browser to verify setup
4. Open `index.html` to start the game
5. Use creator key: `BeforeRoboticsGame` to create a game
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
