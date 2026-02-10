# Deployment Guide

## Prerequisites

- A Firebase account ([Create one here](https://console.firebase.google.com))
- A web server or hosting platform (Firebase Hosting, Netlify, Vercel, GitHub Pages, etc.)

## Step 1: Set Up Firebase

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Add Project"
   - Name your project (e.g., "civilization-game")
   - Follow the setup wizard

2. **Enable Realtime Database**
   - In your Firebase project, go to "Build" > "Realtime Database"
   - Click "Create Database"
   - Choose a location (e.g., "us-central1")
   - Start in "Test Mode" for development (you can secure it later)

3. **Configure Database Rules**
   
   For development, use these rules:
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
   
   For production, consider more restrictive rules:
   ```json
   {
     "rules": {
       "games": {
         "$gameCode": {
           ".read": "data.exists()",
           ".write": "!data.exists() || data.child('players').child(auth.uid).exists()"
         }
       }
     }
   }
   ```

4. **Get Your Firebase Configuration**
   - In Firebase Console, go to Project Settings (gear icon)
   - Scroll down to "Your apps" section
   - Click "Web" icon to add a web app
   - Register your app (name it anything)
   - Copy the firebaseConfig object shown

## Step 2: Configure the Application

### Option A: Environment Variable Injection (Recommended for Production)

1. Create a backend endpoint that serves the Firebase config
2. Modify `firebase-config-loader.js` to fetch from your endpoint:

```javascript
fetch('/api/firebase-config')
    .then(response => response.json())
    .then(config => {
        window.__FIREBASE_CONFIG__ = config;
    });
```

3. Ensure your backend secures this endpoint appropriately

### Option B: Build-Time Injection

1. Use your build tool to inject the config during build
2. Example with webpack:

```javascript
// webpack.config.js
plugins: [
    new webpack.DefinePlugin({
        '__FIREBASE_CONFIG_FROM_BUILD__': JSON.stringify({
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            databaseURL: process.env.FIREBASE_DATABASE_URL,
            projectId: process.env.FIREBASE_PROJECT_ID
        })
    })
]
```

### Option C: Direct Configuration (Development Only)

⚠️ **WARNING: Never commit real credentials to version control!**

1. Edit `firebase-config-loader.js`
2. Replace the placeholder config with your actual Firebase config:

```javascript
window.__FIREBASE_CONFIG__ = {
    apiKey: "AIza...",  // Your actual API key
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

## Step 3: Deploy the Application

### Option 1: Firebase Hosting (Recommended)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase Hosting in your project directory:
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to the folder containing your files
   - Configure as single-page app: No
   - Don't overwrite existing files

4. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

5. Your site will be live at: `https://your-project.web.app`

### Option 2: Netlify

1. Create a `netlify.toml` file:
   ```toml
   [build]
     publish = "."
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. Connect your GitHub repo to Netlify
3. Deploy automatically on push

### Option 3: Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

### Option 4: GitHub Pages

1. Push your code to a GitHub repository
2. Go to Settings > Pages
3. Select your branch and root folder
4. Save and wait for deployment

Note: For GitHub Pages, you may need to configure the base URL.

## Step 4: Test Your Deployment

1. Open your deployed site
2. Try creating a game (use creator key: "BeforeRoboticsGame")
3. Open the site in another browser/tab and join the game
4. Test game functionality

## Step 5: Security Hardening (Production)

### Firebase Database Rules

Update your database rules to be more restrictive:

```json
{
  "rules": {
    "games": {
      "$gameCode": {
        ".read": "data.exists()",
        ".write": "data.child('players').hasChild(auth.uid) || !data.exists()",
        "players": {
          "$playerId": {
            ".write": "$playerId === auth.uid || data.parent().child('hostId').val() === auth.uid"
          }
        },
        "phase": {
          ".write": "root.child('games').child($gameCode).child('hostId').val() === auth.uid"
        }
      }
    }
  }
}
```

### Rate Limiting

Consider implementing rate limiting on your backend if using environment variable injection.

### HTTPS

Ensure your site is served over HTTPS (most hosting platforms do this automatically).

## Troubleshooting

### Firebase Connection Issues

- Check browser console for errors
- Verify your Firebase config is correct
- Ensure Realtime Database is enabled in Firebase Console
- Check that database rules allow read/write access

### Game Code Not Working

- Verify the game was created successfully in Firebase Console
- Check the database path: `/games/{gameCode}`
- Ensure the game hasn't expired or been deleted

### Players Can't Join

- Check if game is locked (already started)
- Verify database rules allow writes
- Check browser console for errors

### Changes Not Syncing

- Check internet connection
- Verify Firebase connection status (green dot in UI)
- Check browser console for Firebase errors
- Ensure database rules allow updates

## Monitoring

### Firebase Console

- Monitor active connections: Database > Usage
- View database content: Database > Data
- Check for errors: Cloud Functions (if using)

### Browser DevTools

- Check console for JavaScript errors
- Monitor network tab for Firebase requests
- Use Application tab to inspect localStorage

## Performance Optimization

1. **Database Indexing**: Add indexes for frequently queried paths
2. **Connection Limits**: Monitor concurrent connections (Firebase has limits)
3. **Data Cleanup**: Periodically remove old/abandoned games
4. **CDN**: Use a CDN for static assets

## Cost Considerations

Firebase Realtime Database has:
- **Spark Plan (Free)**:
  - 1 GB storage
  - 10 GB/month download
  - 100 simultaneous connections

- **Blaze Plan (Pay as you go)**:
  - $5/GB stored
  - $1/GB downloaded
  - No connection limits

For a small game with 10-20 concurrent games:
- Estimated cost: $0-5/month
- Consider implementing game cleanup to save storage

## Maintenance

### Regular Tasks

1. **Clean up old games**: Remove games older than 7 days
2. **Monitor usage**: Check Firebase quotas monthly
3. **Update dependencies**: Keep Firebase SDK updated
4. **Backup data**: Export database periodically

### Backup Script Example

```javascript
// backup-games.js
const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({ /* config */ });
const db = admin.database();

db.ref('games').once('value', (snapshot) => {
    const backup = snapshot.val();
    fs.writeFileSync('backup.json', JSON.stringify(backup, null, 2));
    console.log('Backup complete!');
});
```

## Support

For issues with:
- **Firebase**: [Firebase Support](https://firebase.google.com/support)
- **This Application**: Create an issue on GitHub
- **Game Rules**: See `civilization_game_manual.txt`

---

**Ready to Play!** 🎮

Your Civilization Online game is now deployed and ready for players!
