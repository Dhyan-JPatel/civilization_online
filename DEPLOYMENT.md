# Deployment Instructions for Civilization Online

## Overview
Civilization Online requires Firebase Realtime Database configuration to be injected at runtime. The application does NOT contain hardcoded Firebase credentials for security reasons.

## Firebase Configuration

The application expects `window.RUNTIME_FIREBASE_CONFIG` to be available before `main.js` loads.

### Required Configuration Structure
```javascript
window.RUNTIME_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Deployment Methods

### Method 1: Build-time Injection
Add a script tag before loading the app in `index.html`:

```html
<script>
  window.RUNTIME_FIREBASE_CONFIG = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    // ... etc
  };
</script>
<script type="module" src="main.js"></script>
```

### Method 2: Server-side Injection
If using a web server (Express, etc.), inject the configuration server-side:

```javascript
app.get('/', (req, res) => {
  const html = fs.readFileSync('index.html', 'utf8');
  const configScript = `<script>window.RUNTIME_FIREBASE_CONFIG=${JSON.stringify(firebaseConfig)};</script>`;
  res.send(html.replace('</head>', `${configScript}</head>`));
});
```

### Method 3: Environment Variables via Build Tool
Use a build tool like Vite, Webpack, or Parcel to inject environment variables:

```javascript
// vite.config.js
export default {
  define: {
    'window.RUNTIME_FIREBASE_CONFIG': JSON.stringify({
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      // ... etc
    })
  }
}
```

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Realtime Database
3. Set Database Rules for development:
```json
{
  "rules": {
    "games": {
      "$gameCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

**Note**: Update rules for production to restrict write access appropriately.

4. Get your configuration from Project Settings > General > Your apps

## Local Development

For local development, create `index.dev.html` (gitignored) with embedded config:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Civilization Online - DEV</title>
  <link rel="stylesheet" href="style.css">
  
  <script>
    window.RUNTIME_FIREBASE_CONFIG = {
      // Your Firebase config here
    };
  </script>
</head>
<body>
  <!-- Copy body from index.html -->
</body>
</html>
```

Then open `index.dev.html` in your browser.

## Creator Key

The current creator key for creating games is: **BeforeRoboticsGame**

This can be changed in `main.js` by modifying the `CREATOR_KEY` constant.

## Testing

1. Open the app in two browser windows/tabs
2. In window 1: Create a game (use creator key)
3. Note the game code
4. In window 2: Join using the game code
5. As host (window 1): Click "Start Game"
6. Verify both windows show the updated game state

## Mobile Testing

The app is optimized for mobile devices. Test on:
- iPhone (Safari)
- iPad (Safari)
- Android (Chrome)

Use browser dev tools to simulate mobile viewports.

## Security Notes

- Never commit Firebase credentials to the repository
- Use environment variables in CI/CD pipelines
- Rotate API keys if accidentally exposed
- Update Firebase Database Rules for production

## Support

For issues, contact the repository maintainer or open an issue on GitHub.
