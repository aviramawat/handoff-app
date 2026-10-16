const form = document.querySelector('#found-form');
const saved = document.querySelector('#found-saved');
const summary = document.querySelector('#found-summary');
const toast = document.querySelector('#toast');
const firebaseCloud = window.handoffFirebase;
const localServer = ['http:', 'https:'].includes(window.location.protocol);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const item = Object.fromEntries(new FormData(form).entries());
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    let reference;
    if (firebaseCloud) {
      await firebaseCloud.ready;
      const doc = await firebaseCloud.db.collection('foundBags').add({
        bagType: item.type,
        bagColor: item.color.trim(),
        foundDate: item.date,
        foundLocation: item.location.trim(),
        details: item.details.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isDemo: false
      });
      reference = `FND-${doc.id.slice(0, 8).toUpperCase()}`;
    } else if (localServer) {
      const response = await fetch('/api/found-bags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this found-bag report.');
      reference = result.receipt;
    } else {
      throw new Error('Open Handoff from its local server to report a found bag.');
    }
    summary.textContent = `Reference ${reference} · ${item.color} ${item.type} · ${item.location}`;
    saved.classList.remove('hidden');
    saved.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.reset();
    toast.textContent = `Found bag saved. Reference: ${reference}`;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2800);
  } catch (error) {
    console.error('Found-bag report failed:', error);
    toast.textContent = error.message || 'Could not save this found-bag report.';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  } finally {
    saveButton.disabled = false;
  }
});
