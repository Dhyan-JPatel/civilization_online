# Deployment Instructions for Civilization Online

## Overview
Civilization Online requires Firebase Realtime Database configuration to be injected at runtime via the `firebase-config-loader.js` file. The application does NOT contain hardcoded Firebase credentials for security reasons.

## Firebase Configuration

The application uses `firebase-config-loader.js` which sets `window.__FIREBASE_CONFIG__` before `main.js` loads. This file supports three configuration methods:

### Required Configuration Structure
```javascript
window.__FIREBASE_CONFIG__ = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Configuration Methods

### Method 1: Direct Edit (Development Only)
Edit `firebase-config-loader.js` directly and replace the placeholder values:

```javascript
window.__FIREBASE_CONFIG__ = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

**⚠️ WARNING: Only use this method for local development. Never commit real credentials!**

### Method 2: Build-time Injection (Recommended)
Use build tools to inject configuration during build:

```javascript
// In firebase-config-loader.js, uncomment and modify:
if (typeof __FIREBASE_CONFIG_FROM_BUILD__ !== 'undefined') {
    window.__FIREBASE_CONFIG__ = __FIREBASE_CONFIG_FROM_BUILD__;
    return;
}
```

Then use your build tool to define `__FIREBASE_CONFIG_FROM_BUILD__`:

```javascript
// vite.config.js example
export default {
  define: {
    '__FIREBASE_CONFIG_FROM_BUILD__': JSON.stringify({
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      // ... other config
    })
  }
}
```

### Method 3: Fetch from Secure Endpoint (Production Recommended)
Edit `firebase-config-loader.js` to fetch configuration from your backend:

```javascript
// In firebase-config-loader.js, uncomment and modify:
fetch('/api/firebase-config')
    .then(response => response.json())
    .then(config => {
        window.__FIREBASE_CONFIG__ = config;
    })
    .catch(err => console.error('Failed to load Firebase config:', err));
```

Then implement `/api/firebase-config` endpoint on your server to return the configuration.

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

For local development, the simplest approach is to edit `firebase-config-loader.js` directly:

1. Open `firebase-config-loader.js`
2. Replace the placeholder values in Option 3 with your actual Firebase configuration
3. Save the file
4. Open `index.html` in your browser (or use a local web server like `python -m http.server`)

**Important**: 
- Do NOT commit your real Firebase credentials to version control
- The `.gitignore` file includes `firebaseconfig.txt` to prevent accidental commits
- Consider using `index.dev.html` for development if you prefer keeping config separate

Alternatively, create `index.dev.html` (gitignored) with inline config:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Civilization Online - DEV</title>
  <link rel="stylesheet" href="style.css">
  
  <script>
    window.__FIREBASE_CONFIG__ = {
      apiKey: "your-dev-api-key",
      authDomain: "your-project.firebaseapp.com",
      databaseURL: "https://your-project-default-rtdb.firebaseio.com",
      projectId: "your-project",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "your-sender-id",
      appId: "your-app-id"
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
