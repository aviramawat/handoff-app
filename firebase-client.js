const config = window.HANDOFF_FIREBASE_CONFIG || {};
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

window.handoffFirebase = null;
if (configured && window.firebase) {
  try {
    const app = firebase.initializeApp(config);
    const auth = app.auth();
    const db = app.firestore();
    const ready = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          unsubscribe();
          resolve(user);
        }, reject);
      }));
    window.handoffFirebase = { app, auth, db, ready };
  } catch (error) {
    console.error('Could not initialize Firebase for Handoff.', error);
  }
}
