# 🏛️ Civilization Online

A strategic multiplayer card-and-dice game where you build a powerful empire while managing internal pressures like population strain, civil unrest, rebellion, and economic collapse.

## 📋 Features

- **Complete Game Implementation**: Full rulebook implementation with all phases (Upkeep, Internal Pressure, State Actions, War, Rebellion, Natural Events, Cleanup)
- **Multiplayer Lobbies**: Game-code-based lobbies with no authentication required
- **Persistent Sessions**: Automatic reconnection after page reload
- **Mobile-First UI**: Touch-friendly interface optimized for iPhone/iPad
- **Real-time Sync**: All game state synchronized via Firebase Realtime Database
- **Server-Side Logic**: Authoritative game logic with transaction-based mutations

## 🚀 Setup

### Firebase Configuration

This application requires a Firebase Realtime Database. To configure:

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable Realtime Database in your Firebase project
3. Set database rules to allow read/write (or customize for security)

### Configuration Methods

#### Option 1: Runtime Injection (Recommended for Production)

Edit `firebase-config-loader.js` to load configuration from your backend:

```javascript
fetch('/api/firebase-config')
    .then(response => response.json())
    .then(config => {
        window.__FIREBASE_CONFIG__ = config;
    });
```

#### Option 2: Build-Time Injection

Set the `window.__FIREBASE_CONFIG__` object before loading `main.js`:

```html
<script>
    window.__FIREBASE_CONFIG__ = {
        apiKey: "YOUR_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        databaseURL: "https://your-project-default-rtdb.firebaseio.com",
        projectId: "your-project"
    };
</script>
```

#### Option 3: Development Only

For local development, you can directly edit `firebase-config-loader.js`:

```javascript
window.__FIREBASE_CONFIG__ = {
    apiKey: "your-dev-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project"
};
```

**⚠️ WARNING: Never commit real credentials to version control!**

## 🎮 How to Play

### Creating a Game

1. Open the application in your browser
2. Enter the creator key (default: "BeforeRoboticsGame")
3. Enter your display name
4. Click "Create Game"
5. Share the 5-character game code with other players

### Joining a Game

1. Enter the 5-character game code
2. Enter your display name
3. Click "Join Game"
4. Wait for the host to start the game

### Game Controls

- **Host Controls**: Only the game creator can advance phases
- **Phase Bar**: Shows current phase and round number (sticky at top)
- **Player Dashboard**: View your civilization's stats
- **Hand Viewer**: See your cards (red = Economy, black = Military)
- **Actions Panel**: Take state actions during your turn
- **Emergency Cards**: Hidden cards for special situations

### Game Phases

1. **SETUP**: Initial game setup
2. **UPKEEP**: Food production, morale calculation, population calculation
3. **INTERNAL_PRESSURE**: Food stress, siege pressure, economic collapse checks
4. **STATE_ACTIONS**: Take up to 2 actions (buy cards, farms, luxury, etc.)
5. **WAR**: Resolve wars and battles
6. **REBELLION**: Handle civil unrest and rebellions
7. **NATURAL_EVENTS**: Optional random events
8. **CLEANUP**: Discard excess cards, reset for next round

### Actions

- **Buy Card**: 2 Economy → Draw 1 card
- **Buy Farm**: 5 Economy → +1 Farm (produces 20 food/round)
- **Buy Luxury**: 1 Economy → Roll 1 die, add to luxury
- **Reduce Unrest**: Decrease unrest by 10
- **Declare War**: Start a war with another player
- **Foreign Interference**: Add unrest to opponents (requires 75+ unrest)

### Victory Condition

The game ends when only one civilization remains and successfully survives two full rounds without rebellion or economic collapse.

## 📱 Mobile Support

The UI is optimized for mobile devices:

- Large tap targets (48px minimum)
- Responsive grid layouts
- Sticky phase bar for easy navigation
- Bottom sheets and modal drawers for actions
- Touch-friendly card interactions

## 🔒 Security

- All game mutations use Firebase transactions
- Host-only phase advancement
- Input validation and sanitization
- Player data isolation
- Race condition prevention

## 🛠️ Technical Details

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase Realtime Database
- **SDK**: Firebase Modular SDK v9+

### Data Model

```
/games/{gameCode}
  ├── phase
  ├── locked
  ├── hostId
  ├── round
  ├── turnOrder[]
  ├── warTracks{}
  ├── rebellions{}
  ├── occupations{}
  ├── sieges{}
  ├── naturalEventsEnabled
  └── players/{playerId}
      ├── name
      ├── stats
      │   ├── unrest
      │   ├── economy
      │   ├── military
      │   ├── food
      │   ├── luxury
      │   ├── morale
      │   ├── population
      │   └── farms
      ├── hand[]
      ├── deck[]
      ├── emergencyCards[]
      ├── committedTroops{}
      ├── actionsThisRound{}
      ├── lastSeen
      └── connected
```

## 📖 Game Rules

See `civilization_game_manual.txt` for complete rules including:

- Card values and hand limits
- Population and morale calculations
- War and occupation mechanics
- Rebellion stages and resolution
- Economic collapse handling
- Trading and foreign interference

## 🤝 Contributing

This is an open-source implementation of the Civilization card game. Feel free to:

- Report bugs via GitHub issues
- Submit pull requests for improvements
- Suggest new features

## 📄 License

See LICENSE file for details.

## 🎯 Roadmap

- [ ] Natural events toggle and implementation
- [ ] Advanced war mechanics (casualties, siege progression)
- [ ] Trade negotiation interface
- [ ] Emergency card effects
- [ ] Game history and replay
- [ ] Tournament mode
- [ ] AI opponents

## 💡 Tips

- Start with 2-3 players to learn the mechanics
- Balance economy and military - you need both!
- Watch your unrest levels carefully
- Don't expand too quickly - population creates instability
- Wars are expensive - make sure you can afford them
- Use emergency cards strategically

---

Built with ❤️ for strategy game enthusiasts
