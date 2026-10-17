const firebaseCloud = window.handoffFirebase;
const form = document.querySelector('#auth-form');
const message = document.querySelector('#auth-message');
const title = document.querySelector('#auth-title');
const intro = document.querySelector('#auth-intro');
const nameField = document.querySelector('#name-field');
const submit = document.querySelector('#auth-submit');
const forgot = document.querySelector('#forgot-password');
const signInTab = document.querySelector('#signin-tab');
const registerTab = document.querySelector('#register-tab');
const socialButtons = [...document.querySelectorAll('.social-button')];
const params = new URLSearchParams(window.location.search);
const requestedReturn = params.get('return') || '/reports.html';
const returnUrl = new URL(requestedReturn, window.location.origin);
const returnTo = returnUrl.origin === window.location.origin
  ? `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`
  : '/reports.html';
let mode = 'signin';
let currentUser = null;

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle('success', success);
}

function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === 'register';
  title.textContent = registering ? 'Make Handoff yours.' : 'Welcome back.';
  intro.textContent = registering ? 'Create an account to keep your reports safe and easy to find.' : 'Sign in to save and find your bag reports from any device.';
  nameField.classList.toggle('hidden', !registering);
  form.elements.password.autocomplete = registering ? 'new-password' : 'current-password';
  submit.innerHTML = registering ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  forgot.hidden = registering;
  signInTab.classList.toggle('active', !registering);
  registerTab.classList.toggle('active', registering);
  signInTab.setAttribute('aria-selected', String(!registering));
  registerTab.setAttribute('aria-selected', String(registering));
  setMessage('');
}

function authError(error) {
  const errors = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/email-already-in-use': 'This account has already been registered. Please choose Sign in.',
    'auth/provider-already-linked': 'This account already has a sign-in method linked. Please choose Sign in.',
    'auth/credential-already-in-use': 'This account has already been registered with this provider. Please choose Sign in.',
    'auth/invalid-credential': 'Email or password is incorrect. Check them and try again.',
    'auth/user-not-found': 'No account uses this email yet. Create an account first.',
    'auth/wrong-password': 'Email or password is incorrect. Check them and try again.',
    'auth/too-many-requests': 'Too many attempts. Wait a little, then try again.',
    'auth/unauthorized-domain': 'Firebase blocked this app address. Add 127.0.0.1 (without :8000) under Authentication → Settings → Authorized domains, then reload this page.',
    'auth/operation-not-allowed': 'This sign-in provider is not enabled in Firebase yet. Enable it in Authentication → Sign-in method.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing. Try again when ready.',
    'auth/account-exists-with-different-credential': 'This email already uses another sign-in method. Sign in with that method first.'
  };
  return errors[error.code] || error.message || 'Sign in could not be completed. Please try again.';
}

signInTab.addEventListener('click', () => setMode('signin'));
registerTab.addEventListener('click', () => setMode('register'));

if (!firebaseCloud) {
  socialButtons.forEach(button => { button.disabled = true; });
  setMessage('Firebase is not configured on this copy of the app.');
} else {
  socialButtons.forEach(button => { button.disabled = true; });
  firebaseCloud.ready.then(user => {
    currentUser = user;
    socialButtons.forEach(button => { button.disabled = false; });
    if (user && !user.isAnonymous) {
      const identity = user.displayName || user.email || 'your account';
      setMessage(`You’re signed in as ${identity}. You can still open Create account to check whether an email is already registered.`, true);
    }
    return firebaseCloud.auth.getRedirectResult();
  }).then(result => {
    if (result?.user) window.location.replace(returnTo);
  }).catch(error => setMessage(authError(error)));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (!firebaseCloud) return setMessage('Firebase is not configured. Reload the app and try again.');
  submit.disabled = true;
  submit.textContent = mode === 'register' ? 'Creating account…' : 'Signing in…';
  setMessage('');
  try {
    await firebaseCloud.ready;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (mode === 'register') {
      const emailCredential = firebase.auth.EmailAuthProvider.credential(email, password);
      const credential = currentUser?.isAnonymous
        ? await currentUser.linkWithCredential(emailCredential)
        : await firebaseCloud.auth.createUserWithEmailAndPassword(email, password);
      const name = form.elements.name.value.trim();
      if (name) await credential.user.updateProfile({ displayName: name });
    } else {
      if (currentUser?.isAnonymous) await firebaseCloud.auth.signOut();
      await firebaseCloud.auth.signInWithEmailAndPassword(email, password);
    }
    window.location.replace(returnTo);
  } catch (error) {
    setMessage(authError(error));
  } finally {
    submit.disabled = false;
    submit.innerHTML = mode === 'register' ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  }
});

forgot.addEventListener('click', async () => {
  const email = form.elements.email.value.trim();
  if (!email) return setMessage('Enter your email above, then choose “Forgot password?”');
  if (!firebaseCloud) return setMessage('Firebase is not configured.');
  try {
    await firebaseCloud.auth.sendPasswordResetEmail(email);
    setMessage('Password reset email sent. Check your inbox.', true);
  } catch (error) {
    setMessage(authError(error));
  }
});

async function socialSignIn(providerName, button) {
  if (!firebaseCloud) return setMessage('Firebase is not configured.');
  const originalTexts = socialButtons.map(item => item.innerHTML);
  socialButtons.forEach(item => { item.disabled = true; });
  button.textContent = `Opening ${providerName}…`;
  setMessage('');
  const provider = providerName === 'Google'
    ? new firebase.auth.GoogleAuthProvider()
    : new firebase.auth.FacebookAuthProvider();
  provider.addScope('email');
  if (providerName === 'Google') provider.setCustomParameters({ prompt: 'select_account' });
  const user = firebaseCloud.auth.currentUser || currentUser;
  try {
    // Open the popup immediately inside the click handler. Do not await
    // Firebase initialization first; browsers can otherwise block the popup.
    const popup = user?.isAnonymous
      ? user.linkWithPopup(provider)
      : firebaseCloud.auth.signInWithPopup(provider);
    setMessage(`Waiting for ${providerName} sign-in…`, true);
    const result = await popup;
    if (mode === 'register' && !user?.isAnonymous && result.additionalUserInfo && !result.additionalUserInfo.isNewUser) {
      currentUser = result.user;
      setMessage(`This ${providerName} account has already been registered. Choose Sign in.`, false);
      socialButtons.forEach((item, index) => {
        item.disabled = false;
        item.innerHTML = originalTexts[index];
      });
      return;
    }
    if (mode === 'register') {
      const name = form.elements.name.value.trim();
      if (name && result.user && !result.user.displayName) await result.user.updateProfile({ displayName: name });
    }
    window.location.replace(returnTo);
  } catch (error) {
    console.error(`${providerName} sign-in failed:`, error);
    if (error.code === 'auth/popup-blocked') {
      setMessage('Your browser blocked the sign-in pop-up. Continuing in this tab…', true);
      try {
        if (user?.isAnonymous) await user.linkWithRedirect(provider);
        else await firebaseCloud.auth.signInWithRedirect(provider);
        return;
      } catch (redirectError) {
        error = redirectError;
      }
    }
    const messageText = providerName === 'Facebook' && error.code === 'auth/operation-not-allowed'
      ? 'Enable Facebook in Firebase Authentication, then add your Meta App ID and App Secret in the provider settings.'
      : authError(error);
    setMessage(messageText);
    socialButtons.forEach((item, index) => {
      item.disabled = false;
      item.innerHTML = originalTexts[index];
    });
  }
}

document.querySelector('#google-login').addEventListener('click', event => socialSignIn('Google', event.currentTarget));
document.querySelector('#facebook-login').addEventListener('click', event => socialSignIn('Facebook', event.currentTarget));
