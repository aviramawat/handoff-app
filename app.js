const form = document.querySelector('#bag-form');
const savedCard = document.querySelector('#saved-report');
const summary = document.querySelector('#saved-summary');
const toast = document.querySelector('#toast');
const backendStatus = document.querySelector('#backend-status');
const STORAGE_KEY = 'handoff-lost-bag-report-v1';
const firebaseCloud = window.handoffFirebase;
const localServer = ['http:', 'https:'].includes(window.location.protocol);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function displayReport(report, receipt = '', storageMode = 'local') {
  const date = report.date ? new Date(`${report.date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'date not provided';
  const label = storageMode === 'firebase' ? 'Your report is saved to Firebase.' : storageMode === 'server' ? 'Your report is saved to this computer.' : 'Your report is saved in this browser.';
  summary.textContent = `${report.name}, ${label} Your ${report.color.toLowerCase()} ${report.type.toLowerCase()} report for ${report.airline} flight ${report.flight} (${date}) is recorded. Last seen: ${report.location}.${receipt ? ` Your reference is ${receipt}.` : ''}`;
  savedCard.querySelector('.eyebrow').textContent = storageMode === 'firebase' ? 'SAVED TO FIREBASE' : storageMode === 'server' ? 'SAVED TO LOCAL DATABASE' : 'SAVED IN THIS BROWSER';
  savedCard.querySelector('#clear-report').hidden = storageMode !== 'local';
  savedCard.classList.remove('hidden');
}

if (firebaseCloud) {
  backendStatus.textContent = 'Connecting to Firebase…';
  firebaseCloud.ready.then(() => {
    backendStatus.textContent = 'Firebase cloud connected';
    backendStatus.classList.add('connected');
  }).catch(() => {
    backendStatus.textContent = 'Firebase setup needs attention';
  });
} else if (localServer) {
  backendStatus.textContent = 'Local database connected';
  backendStatus.classList.add('connected');
} else {
  backendStatus.textContent = 'Browser demo only';
}

try {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing && !firebaseCloud) displayReport(JSON.parse(existing));
} catch (error) {
  console.warn('Could not read the saved Handoff demo report.', error);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const report = Object.fromEntries(new FormData(form).entries());

  if (firebaseCloud) {
    try {
      const user = await firebaseCloud.ready;
      const document = {
        ownerUid: user.uid,
        travelerName: report.name.trim(),
        email: report.email.trim(),
        airline: report.airline.trim(),
        flightNumber: report.flight.trim(),
        travelDate: report.date,
        lastSeenLocation: report.location.trim(),
        bagType: report.type,
        bagColor: report.color.trim(),
        identifyingDetails: report.details.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isDemo: false
      };
      const saved = await firebaseCloud.db.collection('reports').add(document);
      const receipt = `HND-${saved.id.slice(0, 8).toUpperCase()}`;
      displayReport(report, receipt, 'firebase');
      savedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`Saved to Firebase. Reference: ${receipt}`);
    } catch (error) {
      console.error('Firebase report save failed:', error);
      showToast('Firebase could not save this report. Check your project setup and try again.');
    }
    return;
  }

  if (localServer) {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The report could not be saved.');
      displayReport(report, result.receipt, 'server');
      savedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`Saved to this computer. Reference: ${result.receipt}`);
    } catch (error) {
      showToast(error.message || 'Could not reach the local database.');
    }
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
    displayReport(report);
    savedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Browser demo only: saved in this browser.');
  } catch (error) {
    showToast('This browser could not save the report. Please try another browser.');
  }
});

document.querySelector('#clear-report').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  savedCard.classList.add('hidden');
  form.reset();
  showToast('Saved browser demo report cleared.');
});

