const list = document.querySelector('#report-list');
const count = document.querySelector('#report-count');
const searchInput = document.querySelector('#report-search');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const matchesList = document.querySelector('#matches-list');
const firebaseCloud = window.handoffFirebase;
let savedReports = [];
let activeFilter = 'all';
let searchQuery = '';

function textElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function formatDate(value) {
  if (!value) return 'Date not provided';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function renderReport(report) {
  const card = document.createElement('article');
  card.className = 'report-card';
  const top = document.createElement('div');
  top.className = 'report-card-top';
  top.append(textElement('span', 'report-ref', report.receipt_code));
  const actions = document.createElement('div');
  actions.className = 'report-card-actions';
  actions.append(textElement('span', report.is_demo ? 'demo-tag' : 'saved-tag', report.is_demo ? 'FICTIONAL SAMPLE' : 'SAVED REPORT'));
  const copy = textElement('button', 'copy-reference', 'Copy ref');
  copy.type = 'button';
  copy.setAttribute('aria-label', `Copy reference ${report.receipt_code}`);
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(report.receipt_code);
      copy.textContent = 'Copied';
      window.setTimeout(() => { copy.textContent = 'Copy ref'; }, 1400);
    } catch {
      copy.textContent = report.receipt_code;
    }
  });
  actions.append(copy);
  top.append(actions);
  card.append(top);
  card.append(textElement('h2', 'report-traveler', report.traveler_name));
  card.append(textElement('p', 'report-flight', `${report.airline} · ${report.flight_number} · ${formatDate(report.travel_date)}`));
  const details = document.createElement('dl');
  for (const [label, value] of [
    ['Bag', `${report.bag_color} ${report.bag_type}`],
    ['Last seen', report.last_seen_location],
    ['Identifying details', report.identifying_details || 'None provided']
  ]) {
    const group = document.createElement('div');
    group.append(textElement('dt', '', label));
    group.append(textElement('dd', '', value));
    details.append(group);
  }
  card.append(details);
  return card;
}

function renderList() {
  const query = searchQuery.trim().toLowerCase();
  const matches = savedReports.filter((report) => {
    if (activeFilter === 'demo' && !report.is_demo) return false;
    if (activeFilter === 'saved' && report.is_demo) return false;
    if (!query) return true;
    return [report.receipt_code, report.traveler_name, report.airline, report.flight_number,
      report.travel_date, report.last_seen_location, report.bag_type, report.bag_color,
      report.identifying_details].filter(Boolean).join(' ').toLowerCase().includes(query);
  });
  count.textContent = `${matches.length} of ${savedReports.length} ${savedReports.length === 1 ? 'report' : 'reports'}`;
  list.replaceChildren();
  if (!matches.length) {
    list.append(textElement('p', 'empty-state', savedReports.length ? 'No reports match those filters. Try a different search.' : 'No reports yet. Use “New report” to add one.'));
    return;
  }
  const fragment = document.createDocumentFragment();
  matches.forEach((report) => fragment.append(renderReport(report)));
  list.append(fragment);
}

function words(value) {
  const ignored = new Set(['airport', 'terminal', 'carousel', 'baggage', 'arrival', 'arrivals', 'international', 'hall', 'the', 'at', 'near', 'a', 'an', 'and', 'of', 'with', 'dark', 'light', 'bright', 'pale', 'deep', 'small', 'large', 'tiny', 'bag', 'handle', 'front', 'side', 'pocket']);
  return (value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2 && !ignored.has(word)) || [];
}

function colorFamilies(value) {
  const groups = [
    ['green', 'forest', 'olive', 'lime', 'sage'],
    ['blue', 'navy', 'teal', 'turquoise', 'aqua'],
    ['black', 'charcoal', 'gray', 'grey', 'graphite'],
    ['white', 'cream', 'ivory'],
    ['red', 'coral', 'maroon', 'burgundy'],
    ['yellow', 'gold', 'mustard'],
    ['orange', 'amber'],
    ['brown', 'tan', 'beige', 'camel'],
    ['purple', 'violet', 'lavender'],
    ['pink', 'rose']
  ];
  const input = new Set(words(value));
  return new Set(groups.filter(group => group.some(color => input.has(color))).map(group => group[0]));
}

function placeTokens(value) {
  const aliases = [
    ['heathrow', 'lhr'], ['delhi', 'indira', 'gandhi', 'del'],
    ['toronto', 'pearson', 'yyz'], ['sydney', 'syd'], ['singapore', 'changi', 'sin'],
    ['dubai', 'dxb'], ['jfk', 'kennedy', 'new', 'york'], ['mumbai', 'bom'],
    ['zurich', 'zrh'], ['amsterdam', 'schiphol', 'ams'],
    ['los', 'angeles', 'lax'], ['vancouver', 'yvr']
  ];
  const input = new Set(words(value));
  const result = new Set(input);
  for (const group of aliases) {
    if (group.some(token => input.has(token))) group.forEach(token => result.add(token));
  }
  return result;
}

function matchEvidence(lost, found) {
  let score = 0;
  const signals = [];
  const sameType = (lost.bag_type || '').toLowerCase() === (found.bag_type || '').toLowerCase();
  if (sameType) { score += 20; }
  const lostColors = colorFamilies(lost.bag_color);
  const foundColors = colorFamilies(found.bag_color);
  const sameColor = [...lostColors].some(color => foundColors.has(color));
  if (sameColor) { score += 25; signals.push('similar colour'); }
  const lostDate = Date.parse(`${lost.travel_date}T00:00:00Z`);
  const foundDate = Date.parse(`${found.found_date}T00:00:00Z`);
  const dayGap = Math.abs(lostDate - foundDate) / 86400000;
  const dateSignal = Number.isFinite(dayGap) && dayGap <= 7;
  if (Number.isFinite(dayGap) && dayGap <= 1) { score += 20; signals.push('within 1 day'); }
  else if (Number.isFinite(dayGap) && dayGap <= 3) { score += 15; signals.push('within 3 days'); }
  else if (dateSignal) { score += 8; signals.push('within 1 week'); }
  const lostPlace = placeTokens(lost.last_seen_location);
  const samePlace = [...placeTokens(found.found_location)].some(token => lostPlace.has(token));
  if (samePlace) { score += 25; signals.push('same airport or area'); }
  const lostClues = new Set(words(lost.identifying_details));
  const sharedClues = words(found.details).filter(word => lostClues.has(word));
  const hasClue = sharedClues.length > 0;
  if (hasClue) { score += 10; signals.push('shared identifying detail'); }
  const evidenceCount = [sameColor, dateSignal, samePlace, hasClue].filter(Boolean).length;
  const qualifies = (sameType && score >= 45 && evidenceCount >= 2) || (!sameType && score >= 70 && evidenceCount >= 3);
  return { score, signals, sameType, qualifies };
}

function renderPotentialMatches(foundBags) {
  if (!matchesList) return;
  const candidates = [];
  for (const lost of savedReports) {
    for (const found of foundBags) {
      const evidence = matchEvidence(lost, found);
      if (evidence.qualifies) candidates.push({ lost, found, ...evidence });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  matchesList.replaceChildren();
  if (!candidates.length) {
    matchesList.append(textElement('p', 'empty-state', 'No likely match yet. That does not mean your bag has not been found—check with airport lost property and review this page again.'));
    return;
  }
  for (const { lost, found, score, signals, sameType } of candidates) {
    const card = document.createElement('article');
    card.className = 'match-card';
    const heading = document.createElement('div');
    heading.className = 'match-card-heading';
    heading.append(textElement('span', 'match-strength', `${score >= 75 ? 'More matching details' : 'Possible match'} · ${score}/100`));
    heading.append(textElement('span', 'match-refs', `${lost.receipt_code} ↔ ${found.receipt_code}`));
    card.append(heading);
    card.append(textElement('h3', '', `${found.bag_color} ${found.bag_type}`));
    card.append(textElement('p', 'match-context', `${lost.airline} ${lost.flight_number} · your bag was last seen at ${lost.last_seen_location}`));
    card.append(textElement('p', 'match-found', `Found ${formatDate(found.found_date)} at ${found.found_location}${found.details ? ` · ${found.details}` : ''}`));
    card.append(textElement('p', 'match-signals', `${sameType ? 'Bag type matches' : 'Bag type differs'}${signals.length ? ` · ${signals.join(' · ')}` : ''}`));
    if (found.is_demo) card.append(textElement('span', 'demo-tag', 'FICTIONAL SAMPLE'));
    card.append(textElement('p', 'match-advice', 'This score ranks clues; it is not a probability or proof. Ask airport staff or lost property to verify before claiming a bag.'));
    matchesList.append(card);
  }
}
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderList();
});
filterButtons.forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  filterButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  renderList();
}));

async function loadReports() {
  try {
    let foundBags = [];
    if (firebaseCloud) {
      const user = await firebaseCloud.ready;
      const [reportsSnapshot, foundSnapshot] = await Promise.all([
        firebaseCloud.db.collection('reports').where('ownerUid', '==', user.uid).get(),
        firebaseCloud.db.collection('foundBags').get()
      ]);
      savedReports = reportsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          receipt_code: `HND-${doc.id.slice(0, 8).toUpperCase()}`,
          traveler_name: data.travelerName,
          airline: data.airline,
          flight_number: data.flightNumber,
          travel_date: data.travelDate,
          last_seen_location: data.lastSeenLocation,
          bag_type: data.bagType,
          bag_color: data.bagColor,
          identifying_details: data.identifyingDetails,
          is_demo: data.isDemo ? 1 : 0,
          created_at: data.createdAt?.toMillis?.() || 0
        };
      }).sort((a, b) => b.created_at - a.created_at);
      foundBags = foundSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          receipt_code: `FND-${doc.id.slice(0, 8).toUpperCase()}`,
          found_date: data.foundDate,
          found_location: data.foundLocation,
          bag_type: data.bagType,
          bag_color: data.bagColor,
          details: data.details,
          is_demo: data.isDemo ? 1 : 0
        };
      });
    } else {
      const [reportsResponse, foundResponse] = await Promise.all([
        fetch('/api/reports', { cache: 'no-store' }),
        fetch('/api/found-bags', { cache: 'no-store' })
      ]);
      if (!reportsResponse.ok || !foundResponse.ok) throw new Error('Could not load local reports.');
      const reportsData = await reportsResponse.json();
      const foundData = await foundResponse.json();
      savedReports = reportsData.reports || [];
      foundBags = foundData.foundBags || [];
    }
    renderList();
    renderPotentialMatches(foundBags);
  } catch (error) {
    console.error('Could not load saved reports:', error);
    count.textContent = 'Saved reports could not be loaded';
    list.replaceChildren(textElement('p', 'empty-state', firebaseCloud
      ? 'Firebase could not load reports. Check that anonymous sign-in is enabled and the Firestore rules are installed.'
      : 'Make sure the local Handoff server is running at http://127.0.0.1:8000, then refresh this page.'));
    if (matchesList) matchesList.replaceChildren(textElement('p', 'empty-state', 'Could not load found-bag reports.'));
  }
}

loadReports();

document.querySelector('#download-backup')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing…';
  try {
    let payload;
    if (firebaseCloud) {
      const user = await firebaseCloud.ready;
      const [lostSnapshot, foundSnapshot] = await Promise.all([
        firebaseCloud.db.collection('reports').where('ownerUid', '==', user.uid).get(),
        firebaseCloud.db.collection('foundBags').get()
      ]);
      payload = {
        app: 'Handoff',
        exportedAt: new Date().toISOString(),
        lostReports: lostSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        foundReports: foundSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };
    } else {
      const response = await fetch('/api/export', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not create the backup.');
      payload = await response.json();
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `handoff-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    button.textContent = 'Backup downloaded';
    window.setTimeout(() => { button.textContent = originalLabel; }, 1800);
  } catch (error) {
    console.error('Backup export failed:', error);
    button.textContent = 'Backup failed';
    window.setTimeout(() => { button.textContent = originalLabel; }, 1800);
  } finally {
    button.disabled = false;
  }
});
