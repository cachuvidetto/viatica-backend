const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

let initialized = false;

// Option 1: Local file (development)
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized from local file');
  initialized = true;
}

// Option 2: Environment variable (production/cloud)
if (!initialized && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized from environment variable');
    initialized = true;
  } catch (err) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
  }
}

if (!initialized) {
  console.warn('⚠️ Firebase not initialized — push notifications will be disabled');
  // Initialize without credentials so the app doesn't crash
  // Firebase-dependent features will gracefully fail
}

module.exports = admin;
