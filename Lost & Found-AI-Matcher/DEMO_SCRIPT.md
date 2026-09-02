# Demo Script (2–3 minutes)

This script walks a judge through the complete user journey on the live deployment. Use the two demo accounts and exact test data below so every step is reproducible.

---

## Demo Accounts

| Role  | Email                         | Password      |
|-------|-------------------------------|---------------|
| Owner | `nimal.owner@campus.lk`       | `DemoPass123!`|
| Finder| `kumara.finder@campus.lk`     | `DemoPass123!`|

> Create these accounts via the app’s sign-up flow before the demo, or seed them with the `user` role in Supabase Auth.

---

## Test Data

### Lost item (file as Owner)

| Field            | Value                                                              |
|------------------|--------------------------------------------------------------------|
| Type             | Lost                                                               |
| Category         | `keys`                                                             |
| Brand            | —                                                                  |
| Colour           | `silver`                                                           |
| Description      | `Bunch of house keys with a red rubber keychain`                   |
| Location         | `Colombo Fort railway station`                                     |
| Lost at          | `2026-08-25 08:30`                                                 |
| Identifying info | `Serial number KY-8842 engraved on the largest key`                |
| Photo            | `demo-key-lost.jpg`                                                |

### Found item (file as Finder)

| Field           | Value                                                                 |
|-----------------|-----------------------------------------------------------------------|
| Type            | Found                                                                 |
| Category        | `keys`                                                                |
| Brand           | —                                                                     |
| Colour          | `silver`                                                              |
| Description     | `Set of keys found near the ticket counter with a red keychain`       |
| Location        | `Colombo Fort railway station`                                        |
| Found at        | `2026-08-25 09:00`                                                    |
| Private details | `keychain_colour: red`, `number_of_keys: 4`, `tag_text: Peradeniya Hostel` |
| Photo           | `demo-key-found.jpg`                                                  |

---

## Narrator Walkthrough

### 0:00–0:15 — Opening

> “Campuses lose hundreds of items every semester. Our platform turns scattered WhatsApp posts into an AI-matched, privacy-safe lost-and-found system. I’ll show you the full journey from two sides: the owner who lost something and the finder who found it.”

### 0:15–0:35 — Owner reports a lost item

1. Sign in as **Owner** (`nimal.owner@campus.lk`).
2. Click **“Report Lost Item.”**
3. Fill the form with the lost-item test data above and upload `demo-key-lost.jpg`.
4. Submit.

> Narrator: “The owner files a lost report. The description is embedded with OpenAI and stored in a `pgvector` column for later matching.”

### 0:35–0:55 — Finder reports a found item

1. Open an incognito/private window and sign in as **Finder** (`kumara.finder@campus.lk`).
2. Click **“Report Found Item.”**
3. Fill the found-item test data above. In the **private details** section, enter:
   - `keychain_colour`: `red`
   - `number_of_keys`: `4`
   - `tag_text`: `Peradeniya Hostel`
4. Upload `demo-key-found.jpg` and submit.

> Narrator: “The finder also provides hidden verification facts. These are never shown publicly — they’re used later to prove ownership.”

### 0:55–1:15 — AI matching

1. As the owner, refresh the **My Matches** page.
2. Point out the new match card for the keys.
3. Expand the match card to show the score breakdown:
   - Description similarity: ~0.9
   - Image similarity: high
   - Location proximity: very close
   - Time proximity: close
   - Attribute match: category + colour match
4. Highlight the **total score** above the 40-point threshold.

> Narrator: “The matching engine combines description embeddings, image similarity, location, time, and attributes into a single transparent score.”

### 1:15–1:45 — Verification: wrong answer, then correct

1. On the match card, click **“Answer Verification Question.”**
2. The question appears, generated from the finder’s private details:  
   **“What colour is the keychain?”**
3. First, enter a wrong answer: `blue`. Submit.
4. Show the retry message and the updated **retries remaining** count.
5. Now enter the correct answer: `red`. Submit.

> Narrator: “A random claimant might guess once, but the real owner knows the hidden detail. OpenAI judges the answer automatically, and the system gives a limited number of retries before escalating to an admin.”

### 1:45–2:10 — Contact unlocked and messaging

1. The match card now shows the status as **Verified / Approved**.
2. The owner sees the finder’s contact details and the hidden identifying info becomes visible to the verified parties.
3. Click **“Open Message Thread.”**
4. Send a message from the owner: `Hi, I lost my keys this morning. Can we meet at the station?`
5. Switch to the finder window and reply: `Sure, I’m at the ticket counter until 6 PM.`

> Narrator: “Only after successful verification do both sides see contact information and can chat in-app, keeping private details protected up front.”

### 2:10–2:30 — Admin overview

1. Sign in to the **Admin Dashboard** with an admin account.
2. Show the **Stats** cards: active items, matches, pending disputes.
3. Navigate to **Pending Matches** and approve or reject a pending match.
4. Navigate to **Disputes** to show the attempt history for any escalated verification.

> Narrator: “Admins can monitor the platform, resolve disputes, update item statuses, and prevent fraudulent claims without exposing private data prematurely.”

### 2:30–2:45 — Closing

> “That’s the full loop: report, match, verify, connect, and moderate — all while keeping sensitive information private until ownership is proven.”

---

## Timing Tips

- Pre-create the two demo accounts and upload the two demo photos before recording.
- Run the matching step once beforehand so the match appears immediately during the live demo.
- Keep the admin account signed in a separate tab to avoid logging out the owner/finder.

---

## Fallbacks

- If OpenAI judging is slow, mention that the backend gracefully handles retries and surfaces escalation to the admin panel.
- If the generated question differs slightly from the script, read the actual question aloud — the flow is the same.
