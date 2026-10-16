const config = window.HANDOFF_FIREBASE_CONFIG || {};
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

window.handoffFirebase = null;
if (configured && window.firebase) {
  try {
    const app = firebase.initializeApp(config);
    const auth = app.auth();
    const db = app.firestore();
    const ready = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => auth.currentUser || auth.signInAnonymously().then(result => result.user));
    window.handoffFirebase = { app, auth, db, ready };
  } catch (error) {
    console.error('Could not initialize Firebase for Handoff.', error);
  }
}
