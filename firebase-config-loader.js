// firebase-config-loader.js
// This file demonstrates how to inject Firebase configuration at runtime
// Use this approach in production to avoid exposing secrets

(function() {
    // Option 1: Load from environment/build-time injection
    // (Set these during your build process)
    if (typeof __FIREBASE_CONFIG_FROM_BUILD__ !== 'undefined') {
        window.__FIREBASE_CONFIG__ = __FIREBASE_CONFIG_FROM_BUILD__;
        return;
    }
    
    // Option 2: Fetch from a secure endpoint
    // Uncomment and modify to fetch from your backend
    /*
    fetch('/api/firebase-config')
        .then(response => response.json())
        .then(config => {
            window.__FIREBASE_CONFIG__ = config;
        })
        .catch(err => console.error('Failed to load Firebase config:', err));
    */
    
    // Option 3: For local development only (NOT FOR PRODUCTION)
    // You can set config directly here during development
    // IMPORTANT: Never commit real credentials!
    if (!window.__FIREBASE_CONFIG__) {
        window.__FIREBASE_CONFIG__ = {
            apiKey: "YOUR_API_KEY_HERE",
            authDomain: "your-project.firebaseapp.com",
            databaseURL: "https://your-project-default-rtdb.firebaseio.com",
            projectId: "your-project",
            storageBucket: "your-project.appspot.com",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID"
        };
        
        // Log a warning if placeholder values are detected
        const hasPlaceholders = Object.values(window.__FIREBASE_CONFIG__).some(value => 
            typeof value === 'string' && (value.includes('YOUR_') || value.includes('your-project'))
        );
        
        if (hasPlaceholders) {
            console.warn('⚠️ Firebase configuration contains placeholder values. The application will not work until you configure it with your actual Firebase project settings.');
            console.warn('See DEPLOYMENT.md for instructions on how to configure Firebase.');
        }
    }
})();
