# Database Schema Reference

Quick reference for the Lost & Found AI Matcher PostgreSQL schema.

---

## ENUMs

| ENUM | Values |
|---|---|
| `item_status` | `active`, `matched`, `verified`, `returned`, `closed` |
| `report_type` | `lost`, `found` |
| `verification_status` | `pending`, `question_sent`, `answered`, `correct`, `incorrect`, `escalated`, `approved` |
| `match_status` | `pending`, `approved`, `rejected`, `disputed` |
| `notification_type` | `new_match`, `verification_question`, `verification_result`, `match_approved`, `match_rejected`, `item_returned`, `admin_message` |

---

## Tables

### `users`
Extends Supabase `auth.users`.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Mirrors `auth.users(id)` |
| `email` | TEXT UNIQUE | User email |
| `full_name` | TEXT | Display name |
| `phone` | TEXT | Optional contact number |
| `avatar_url` | TEXT | Optional avatar image URL |
| `role` | TEXT | `user` or `admin` |
| `preferred_lang` | TEXT | `en`, `ta`, or `si` |
| `created_at` | TIMESTAMPTZ | Sign-up time |
| `updated_at` | TIMESTAMPTZ | Last update time |

### `lost_items`

| Column | Type | Visibility | Description |
|---|---|---|---|
| `id` | UUID PK | PUBLIC | Auto-generated item ID |
| `user_id` | UUID FK → users | PUBLIC | Owner of the report |
| `category` | TEXT | PUBLIC | e.g. `keys`, `electronics`, `bag` |
| `brand` | TEXT | PUBLIC | Item brand, if known |
| `colour` | TEXT | PUBLIC | Item colour |
| `description` | TEXT | PUBLIC | Free-text description |
| `location` | TEXT | PUBLIC | Human-readable place name |
| `latitude` | DOUBLE PRECISION | PUBLIC | Optional GPS latitude |
| `longitude` | DOUBLE PRECISION | PUBLIC | Optional GPS longitude |
| `lost_at` | TIMESTAMPTZ | PUBLIC | When the item was lost |
| `reported_at` | TIMESTAMPTZ | PUBLIC | When the report was submitted |
| `photo_url` | TEXT | PUBLIC | Supabase Storage photo URL |
| `description_embedding` | vector(1536) | INTERNAL | OpenAI text embedding |
| `identifying_info` | TEXT | PRIVATE | Serial number, engraving, etc. (shown only after verification) |
| `status` | item_status | PUBLIC | `active`, `matched`, `verified`, `returned`, `closed` |
| `created_at` | TIMESTAMPTZ | PUBLIC | Row creation time |
| `updated_at` | TIMESTAMPTZ | PUBLIC | Last update time |

### `found_items`

| Column | Type | Visibility | Description |
|---|---|---|---|
| `id` | UUID PK | PUBLIC | Auto-generated item ID |
| `user_id` | UUID FK → users | PUBLIC | Finder who posted the report |
| `category` | TEXT | PUBLIC | e.g. `keys`, `electronics`, `bag` |
| `brand` | TEXT | PUBLIC | Item brand, if known |
| `colour` | TEXT | PUBLIC | Item colour |
| `description` | TEXT | PUBLIC | Free-text description |
| `location` | TEXT | PUBLIC | Human-readable place name |
| `latitude` | DOUBLE PRECISION | PUBLIC | Optional GPS latitude |
| `longitude` | DOUBLE PRECISION | PUBLIC | Optional GPS longitude |
| `found_at` | TIMESTAMPTZ | PUBLIC | When the item was found |
| `reported_at` | TIMESTAMPTZ | PUBLIC | When the report was submitted |
| `photo_url` | TEXT | PUBLIC | Supabase Storage photo URL |
| `description_embedding` | vector(1536) | INTERNAL | OpenAI text embedding |
| `private_details` | JSONB | PRIVATE | Verification facts (e.g. `{"keychain_colour":"red"}`) — hidden from public |
| `status` | item_status | PUBLIC | `active`, `matched`, `verified`, `returned`, `closed` |
| `created_at` | TIMESTAMPTZ | PUBLIC | Row creation time |
| `updated_at` | TIMESTAMPTZ | PUBLIC | Last update time |

### `matches`
Pairs a lost item with a found item.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated match ID |
| `lost_item_id` | UUID FK → lost_items | The lost item |
| `found_item_id` | UUID FK → found_items | The found item |
| `total_score` | DOUBLE PRECISION | Weighted total 0–100 |
| `desc_score` | DOUBLE PRECISION | Description similarity (30%) |
| `image_score` | DOUBLE PRECISION | Image similarity (25%) |
| `location_score` | DOUBLE PRECISION | Location proximity (20%) |
| `time_score` | DOUBLE PRECISION | Time proximity (15%) |
| `attr_score` | DOUBLE PRECISION | Brand/Colour/Category (10%) |
| `status` | match_status | `pending`, `approved`, `rejected`, `disputed` |
| `created_at` | TIMESTAMPTZ | Match creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

### `verification_questions`

| Column | Type | Visibility | Description |
|---|---|---|---|
| `id` | UUID PK | INTERNAL | Question ID |
| `match_id` | UUID FK → matches | INTERNAL | Related match |
| `question_text` | TEXT | PUBLIC (to claimant) | e.g. "What colour was the keychain?" |
| `correct_answer` | TEXT | PRIVATE | The actual answer from `private_details` |
| `created_at` | TIMESTAMPTZ | INTERNAL | Creation time |

### `verification_attempts`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Attempt ID |
| `question_id` | UUID FK → verification_questions | Question being answered |
| `match_id` | UUID FK → matches | Related match |
| `claimant_id` | UUID FK → users | Person answering (lost-item owner) |
| `answer_text` | TEXT | Submitted answer |
| `is_correct` | BOOLEAN | NULL until judged |
| `judged_by` | UUID FK → users | Finder who judged |
| `judged_at` | TIMESTAMPTZ | When judgment happened |
| `attempt_number` | INTEGER | Retry counter (default 1) |
| `created_at` | TIMESTAMPTZ | Attempt time |

### `notifications`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Notification ID |
| `user_id` | UUID FK → users | Recipient |
| `type` | notification_type | `new_match`, `verification_question`, etc. |
| `title` | TEXT | Notification title |
| `message` | TEXT | Notification body |
| `match_id` | UUID FK → matches | Optional related match |
| `item_id` | UUID | Optional related item (lost or found) |
| `item_type` | report_type | `lost` or `found` |
| `is_read` | BOOLEAN | Read state |
| `email_sent` | BOOLEAN | Whether email was dispatched |
| `created_at` | TIMESTAMPTZ | Notification time |

### `item_status_log`
Audit trail for status changes.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Log entry ID |
| `item_id` | UUID | Polymorphic: lost or found item ID |
| `item_type` | report_type | `lost` or `found` |
| `old_status` | item_status | Previous status |
| `new_status` | item_status | New status |
| `changed_by` | UUID FK → users | User who made the change |
| `reason` | TEXT | Optional reason |
| `created_at` | TIMESTAMPTZ | When change occurred |

---

## Example INSERT JSON

### `lost_items`

```json
{
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "category": "keys",
  "brand": null,
  "colour": "silver",
  "description": "Bunch of house keys with a red rubber keychain",
  "location": "Colombo Fort railway station",
  "latitude": 6.9355,
  "longitude": 79.8506,
  "lost_at": "2026-08-25T08:30:00Z",
  "photo_url": "https://.../item-photos/key1.jpg",
  "identifying_info": "Serial number KY-8842 engraved on the largest key",
  "status": "active"
}
```

### `found_items`

```json
{
  "user_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  "category": "keys",
  "brand": null,
  "colour": "silver",
  "description": "Set of keys found near the ticket counter with a red keychain",
  "location": "Colombo Fort railway station",
  "latitude": 6.9356,
  "longitude": 79.8507,
  "found_at": "2026-08-25T09:00:00Z",
  "photo_url": "https://.../item-photos/key2.jpg",
  "private_details": {
    "keychain_colour": "red",
    "key_count": "4"
  },
  "status": "active"
}
```

---

## Visibility Legend

- **PUBLIC** — visible in listings and to other users
- **PRIVATE** — hidden until verification succeeds (only claimant/finder/admin see it)
- **INTERNAL** — used by the app/AI, not exposed in normal UI
