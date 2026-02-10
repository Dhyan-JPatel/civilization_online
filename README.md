# Civilization Online

Online multiplayer strategy game to play with friends. Build your empire without letting it collapse under its own weight!

## About

Civilization is a strategy card-and-dice game about building a powerful empire while managing internal pressures such as population strain, civil unrest, rebellion, famine, and economic collapse. Military strength alone won't win—victory belongs to the ruler who can expand, dominate, and still keep their civilization stable.

## Current Status: Phase 1 Complete ✅

Phase 1 implements the lobby and game setup foundation:
- ✅ Create and join games with unique game codes
- ✅ Real-time player synchronization
- ✅ Mobile-friendly UI for iPhone/iPad
- ✅ Reconnection support via localStorage
- ✅ Host controls for starting games
- ✅ Secure Firebase configuration (no hardcoded secrets)

**Phase 2** (coming next) will implement full game rules, actions, turn system, war mechanics, and rebellion phases.

## Features

### Phase 1 (Current)
- **Create Games**: Host creates a game using a creator key and receives a unique 5-character game code
- **Join Games**: Players join with game code + display name (no account required)
- **Real-time Updates**: All players see changes instantly via Firebase Realtime Database
- **Reconnection**: Automatically reconnect after page reload
- **Mobile-Friendly**: Optimized for touch devices and narrow viewports
- **Secure**: No Firebase credentials committed to repository

### Phase 2 (Planned)
- Full 7-phase turn structure
- Player stats tracking (Unrest, Economy, Military, Food, Luxury, Morale, Population)
- Card system (Economy and Military cards)
- War mechanics with progressive stages
- Rebellion system
- Farm management
- Emergency cards
- Natural events

## Getting Started

### For Developers

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup and deployment instructions.

Quick start:
1. Create `index.dev.html` with your Firebase config (see DEPLOYMENT.md)
2. Open `index.dev.html` in your browser
3. Use creator key: `BeforeRoboticsGame` to create a game
4. Open another tab to join as a second player

### For Players

1. Get the game link from your host
2. Enter the game code provided by your host
3. Choose a display name
4. Wait for the host to start the game

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database**: Firebase Realtime Database
- **Firebase SDK**: Modular v10.7.1 (no compat mode)
- **Hosting**: Static site (can be hosted on Firebase Hosting, Netlify, Vercel, etc.)

## Project Structure

```
civilization_online/
├── index.html              # Main HTML (no secrets)
├── main.js                 # Application logic with modular Firebase
├── style.css               # Responsive mobile-first styles
├── firebaseconfig.txt      # Placeholder instructions for config
├── civilization_game_manual.txt  # Complete game rules
├── DEPLOYMENT.md           # Setup and deployment guide
├── LICENSE                 # Apache 2.0 License
└── README.md               # This file
```

## Security

- Firebase configuration must be provided at runtime via `window.RUNTIME_FIREBASE_CONFIG`
- No secrets are committed to the repository
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

This project is in active development. Phase 1 is complete and Phase 2 (full game rules) is planned.

## License

Apache 2.0 - See [LICENSE](LICENSE) file for details.

## Support

For issues or questions, open an issue on GitHub.
