# Handoff

A mobile-friendly lost-bag reporting prototype. It supports Firebase Cloud Firestore for cloud reports and keeps the local Python/SQLite backend as a fallback.

## Connect Firebase

1. Create a Firebase project and register a **Web app** in the Firebase console.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create a **Cloud Firestore** database.
4. Paste the Firestore rules from `firestore.rules` into **Firestore → Rules** and publish them. These rules let an anonymous user create and read only reports owned by that same Firebase user; updates and deletes are disabled.
5. Copy the Firebase web app settings into `firebase-config.js`: `apiKey`, `authDomain`, `projectId`, and `appId`.
6. In Firebase Authentication → Settings → Authorized domains, add `127.0.0.1` if it is missing. Open Handoff at `http://127.0.0.1:8000`. Reports save to Firestore under the signed-in account.

Firebase's web config is intended to be included in browser code. Keep security in the Firestore rules; never add a service account private key to this project. Firebase requires anonymous sign-in to be enabled for the app's per-user rules.

## Run the local app

From this folder, run:

```powershell
python server.py
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000). The server listens only on this computer. If Firebase isn't configured, submissions save to the local SQLite database at `data/handoff.sqlite3`.

## Demo data

The local SQLite database contains 12 clearly fictional sample reports (`DEMO-001`–`DEMO-012`) with reserved `example.com` email addresses. They are marked `is_demo = 1`. Re-run `python seed_demo_data.py` to insert any missing sample rows. They are local examples and are not automatically copied into Firebase. The Saved reports page includes search, sample/saved filters, copyable references, suggested matches, and a JSON backup download. Matching checks bag type, related color names, venue and nearby-area clues, date proximity, and distinctive description words; the displayed score ranks clues and is never a probability. Place types include airports, railway and metro stations, bus terminals, hotels, malls, event venues, parks, restaurants, and other public places. The app can also submit found-item reports without collecting finder contact details.

## Privacy and scope

Reports contain contact and journey details. Firebase lost reports are scoped to the current signed-in account. Found-bag listings share only item type, colour, date, place, and visible details so Handoff users can compare them against their own lost reports. Until a permanent sign-in method is added and linked, reports may not be available from another browser or device. Local fallback data stays on this computer. Handoff does not contact venue operators or lost-property desks, and it does not verify or claim a bag for anyone. Before a public launch, add deletion/export controls, abuse protection, privacy terms, and production monitoring.



