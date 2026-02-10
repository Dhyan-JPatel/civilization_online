/***** 🔴 UPDATE THESE VALUES 🔴 *****/
const CREATOR_KEY = "BeforeRoboticsGame";

firebase.initializeApp({
  apiKey: "AIzaSyB60cn2DLhu_VzhprtZ5x_SSzfcfjKzfVk",
  authDomain: "civilization-game-efa6b.firebaseapp.com",
  databaseURL: "https://civilization-game-efa6b-default-rtdb.firebaseio.com",
  projectId: "civilization-game-efa6b"
});
/************************************/

const db = firebase.database();
let gameRef = null;
let playerId = crypto.randomUUID();

/* ---------------- GAME CREATION ---------------- */

function createGame() {
  const enteredKey = document.getElementById("creatorKey").value;
  if (enteredKey !== CREATOR_KEY) {
    alert("Not authorized");
    return;
  }

  const gameCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  gameRef = db.ref("games/" + gameCode);

  gameRef.set({
    locked: false,
    phase: "SETUP",
    currentPlayer: 0,
    players: {
      [playerId]: createPlayer()
    }
  });

  listen(gameCode);
  alert("Game Code: " + gameCode);
}

/* ---------------- JOIN GAME ---------------- */

function joinGame() {
  const code = document.getElementById("gameCodeInput").value.toUpperCase();
  gameRef = db.ref("games/" + code);

  gameRef.once("value", snap => {
    if (!snap.exists()) {
      alert("Game not found");
      return;
    }

    if (snap.val().locked) {
      alert("Game already started");
      return;
    }

    gameRef.child("players").child(playerId).set(createPlayer());
    listen(code);
  });
}

/* ---------------- LISTEN FOR UPDATES ---------------- */

function listen(code) {
  gameRef = db.ref("games/" + code);

  gameRef.on("value", snapshot => {
    render(snapshot.val());
  });
}

/* ---------------- GAME LOGIC ---------------- */

function createPlayer() {
  return {
    unrest: 0,
    economy: 0,
    military: 0,
    food: 0,
    luxury: 0,
    morale: 0,
    population: 0
  };
}

/* ---------------- UI RENDER ---------------- */

function render(game) {
  const playerCount = Object.keys(game.players).length;

  document.getElementById("game").innerHTML = `
    <h2>Phase: ${game.phase}</h2>
    <p>Players: ${playerCount}</p>
    <button onclick="nextPhase()">Next Phase</button>
  `;
}

/* ---------------- PHASE CONTROL ---------------- */

function nextPhase() {
  if (!gameRef) return;

  gameRef.transaction(game => {
    if (!game) return game;

    const phases = ["SETUP", "UPKEEP", "PRESSURE", "ACTIONS", "WAR", "REBELLION", "CLEANUP"];
    let index = phases.indexOf(game.phase);
    game.phase = phases[(index + 1) % phases.length];
    game.locked = true;

    return game;
  });
}
