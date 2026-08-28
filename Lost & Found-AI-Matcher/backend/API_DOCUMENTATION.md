# Lost & Found AI Matcher — API Documentation

## Base URL

```
http://localhost:4000/api
```

The backend runs on the port defined by `PORT` (default `4000`).

## Authentication

Most endpoints require a JSON Web Token (JWT) obtained through signup or login. Include the token in the `Authorization` header as a Bearer token:

```
Authorization: Bearer <token>
```

## Matching Score Formula

Matches are ranked with a weighted score from `0` to `100`:

```
Match Score = (30% × description similarity)
            + (25% × image similarity)
            + (20% × location proximity)
            + (15% × time proximity)
            + (10% × attribute similarity)
```

| Factor | Weight | Details |
|--------|--------|---------|
| Description | 30% | Cosine similarity of OpenAI text embeddings; falls back to simple word overlap if embeddings are unavailable. |
| Image | 25% | GPT-4o-mini vision comparison of the two item photos. |
| Location | 20% | Haversine distance; 100% within 5 km, decaying linearly to 0% at 15 km. |
| Time | 15% | 100% within 72 hours, decaying linearly to 0% at 288 hours. |
| Attributes | 10% | Category (50%), brand (25%), and colour (25%) string matching. |

Only matches with a total score of at least `40` are stored and returned.

---

## Authentication Endpoints

### POST /auth/signup

Register a new user.

**Headers**

```http
Content-Type: application/json
```

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "Jane Doe"
}
```

**Response — 201 Created**

```json
{
  "user": {
    "id": "e50c37fd-1de5-41ed-918d-6ec399c6485d",
    "email": "user@example.com",
    "full_name": "Jane Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123!","full_name":"Jane Doe"}'
```

---

### POST /auth/login

Log in an existing user.

**Headers**

```http
Content-Type: application/json
```

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response — 200 OK**

```json
{
  "user": {
    "id": "e50c37fd-1de5-41ed-918d-6ec399c6485d",
    "email": "user@example.com",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'
```

---

## Report Endpoints

All report endpoints require authentication.

### POST /reports/lost

Submit a lost-item report. The matching engine runs automatically after insertion.

**Headers**

```http
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**

```json
{
  "category": "keys",
  "brand": "Toyota",
  "colour": "silver",
  "description": "Silver Toyota car keys with a leather keychain and gym tag",
  "location": "Colombo Fort Railway Station",
  "latitude": 6.9355,
  "longitude": 79.8487,
  "lost_at": "2024-12-15T08:30:00Z",
  "photo_url": "https://.../item-photos/photo.jpg",
  "identifying_info": "Gym membership tag number 12345"
}
```

Field rules:

- `category` (required, string)
- `brand`, `colour`, `photo_url`, `identifying_info` (optional)
- `description` (required, string, minimum 10 characters)
- `location` (required, string)
- `latitude` (optional, number, -90 to 90)
- `longitude` (optional, number, -180 to 180)
- `lost_at` (required, ISO 8601 date)

**Response — 201 Created**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "category": "keys",
  "brand": "Toyota",
  "colour": "silver",
  "description": "Silver Toyota car keys with a leather keychain and gym tag",
  "location": "Colombo Fort Railway Station",
  "lost_at": "2024-12-15T08:30:00.000Z",
  "status": "active",
  "created_at": "2024-12-15T10:00:00.000Z",
  "matches": [
    {
      "lost_item_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "found_item_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "total_score": 87,
      "desc_score": 92,
      "image_score": 50,
      "location_score": 100,
      "time_score": 100,
      "attr_score": 90
    }
  ]
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/reports/lost \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "category": "keys",
    "brand": "Toyota",
    "colour": "silver",
    "description": "Silver Toyota car keys with a leather keychain and gym tag",
    "location": "Colombo Fort Railway Station",
    "latitude": 6.9355,
    "longitude": 79.8487,
    "lost_at": "2024-12-15T08:30:00Z"
  }'
```

---

### POST /reports/found

Submit a found-item report. The matching engine runs automatically after insertion.

**Headers**

```http
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**

```json
{
  "category": "keys",
  "brand": "Toyota",
  "colour": "silver",
  "description": "Found a set of car keys near the ticket counter with tags attached",
  "location": "Colombo Fort Railway Station",
  "latitude": 6.9356,
  "longitude": 79.8490,
  "found_at": "2024-12-15T09:15:00Z",
  "photo_url": "https://.../item-photos/photo.jpg",
  "private_details": {
    "keychain_material": "leather",
    "gym_tag": "yes",
    "number_of_keys": "3"
  }
}
```

Field rules:

- `category` (required, string)
- `brand`, `colour`, `photo_url` (optional)
- `description` (required, string, minimum 10 characters)
- `location` (required, string)
- `latitude` (optional, number, -90 to 90)
- `longitude` (optional, number, -180 to 180)
- `found_at` (required, ISO 8601 date)
- `private_details` (optional, object) — used for verification questions

**Response — 201 Created**

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "category": "keys",
  "brand": "Toyota",
  "colour": "silver",
  "description": "Found a set of car keys near the ticket counter with tags attached",
  "location": "Colombo Fort Railway Station",
  "found_at": "2024-12-15T09:15:00.000Z",
  "status": "active",
  "created_at": "2024-12-15T10:05:00.000Z",
  "matches": []
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/reports/found \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "category": "keys",
    "brand": "Toyota",
    "colour": "silver",
    "description": "Found a set of car keys near the ticket counter with tags attached",
    "location": "Colombo Fort Railway Station",
    "latitude": 6.9356,
    "longitude": 79.8490,
    "found_at": "2024-12-15T09:15:00Z",
    "private_details": {"keychain_material":"leather","gym_tag":"yes","number_of_keys":"3"}
  }'
```

---

### GET /reports/:id

Get a single report by ID. The endpoint searches `lost_items` first, then `found_items`. Private fields (`identifying_info`) are hidden unless the caller owns the report.

**Headers**

```http
Authorization: Bearer <token>
```

**Response — 200 OK**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "e50c37fd-1de5-41ed-918d-6ec399c6485d",
  "category": "keys",
  "brand": "Toyota",
  "colour": "silver",
  "description": "Silver Toyota car keys with a leather keychain and gym tag",
  "location": "Colombo Fort Railway Station",
  "latitude": 6.9355,
  "longitude": 79.8487,
  "event_time": "2024-12-15T08:30:00.000Z",
  "photo_url": "https://.../item-photos/photo.jpg",
  "status": "active",
  "created_at": "2024-12-15T10:00:00.000Z",
  "type": "lost"
}
```

**cURL Example**

```bash
curl -X GET http://localhost:4000/api/reports/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer <token>"
```

---

### GET /reports/user/:userId

Get all reports belonging to a user. Regular users may only access their own reports; admins may access any user's reports.

**Headers**

```http
Authorization: Bearer <token>
```

**Response — 200 OK**

```json
{
  "lost": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "category": "keys",
      "description": "Silver Toyota car keys with a leather keychain and gym tag",
      "location": "Colombo Fort Railway Station",
      "event_time": "2024-12-15T08:30:00.000Z",
      "photo_url": "https://.../item-photos/photo.jpg",
      "status": "active",
      "created_at": "2024-12-15T10:00:00.000Z",
      "type": "lost"
    }
  ],
  "found": []
}
```

**cURL Example**

```bash
curl -X GET http://localhost:4000/api/reports/user/e50c37fd-1de5-41ed-918d-6ec399c6485d \
  -H "Authorization: Bearer <token>"
```

---

## Upload Endpoints

### POST /upload

Upload an item photo. The image is resized to a maximum width of 800px and stored in the Supabase `item-photos` bucket.

**Headers**

```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body**

Multipart form with one file field:

- `photo` (required, image file, max 5 MB)

**Response — 201 Created**

```json
{
  "url": "https://.../storage/v1/object/public/item-photos/123e4567-e89b-12d3-a456-426614174000.jpg",
  "fileName": "123e4567-e89b-12d3-a456-426614174000.jpg"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/upload \
  -H "Authorization: Bearer <token>" \
  -F "photo=@/path/to/photo.jpg"
```

---

## Match Endpoints

All match endpoints require authentication.

### POST /matches/run/:reportId?type=lost|found

Manually trigger the matching engine for a report.

**Headers**

```http
Authorization: Bearer <token>
```

**Query Parameters**

- `type` (required): `lost` or `found`

**Response — 200 OK**

```json
{
  "report_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "match_count": 2,
  "matches": [
    {
      "lost_item_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "found_item_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "total_score": 87,
      "desc_score": 92,
      "image_score": 50,
      "location_score": 100,
      "time_score": 100,
      "attr_score": 90
    }
  ]
}
```

**cURL Example**

```bash
curl -X POST "http://localhost:4000/api/matches/run/a1b2c3d4-e5f6-7890-abcd-ef1234567890?type=lost" \
  -H "Authorization: Bearer <token>"
```

---

### GET /matches/:reportId?type=lost|found

Get existing matches for a report, sorted by total score descending.

**Headers**

```http
Authorization: Bearer <token>
```

**Query Parameters**

- `type` (required): `lost` or `found`

**Response — 200 OK (type=lost)**

```json
[
  {
    "id": "m1n2o3p4-q5r6-7890-stuv-w12345678901",
    "total_score": 87,
    "desc_score": 92,
    "image_score": 50,
    "location_score": 100,
    "time_score": 100,
    "attr_score": 90,
    "status": "pending",
    "created_at": "2024-12-15T10:10:00.000Z",
    "found_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "found_category": "keys",
    "found_brand": "Toyota",
    "found_colour": "silver",
    "found_description": "Found a set of car keys near the ticket counter...",
    "found_location": "Colombo Fort Railway Station",
    "found_photo_url": "https://.../item-photos/photo.jpg",
    "found_at": "2024-12-15T09:15:00.000Z"
  }
]
```

**cURL Example**

```bash
curl -X GET "http://localhost:4000/api/matches/a1b2c3d4-e5f6-7890-abcd-ef1234567890?type=lost" \
  -H "Authorization: Bearer <token>"
```

---

## Verification Endpoints

All verification endpoints require authentication.

### GET /verify/:matchId/question

Retrieve the verification question for a match. Only the lost-item owner (claimant) or an admin can call this.

**Headers**

```http
Authorization: Bearer <token>
```

**Response — 200 OK**

```json
{
  "question_id": "q1w2e3r4-t5y6-7890-uioz-a12345678901",
  "question_text": "What material is the keychain made of?"
}
```

**cURL Example**

```bash
curl -X GET http://localhost:4000/api/verify/m1n2o3p4-q5r6-7890-stuv-w12345678901/question \
  -H "Authorization: Bearer <token>"
```

---

### POST /verify/:matchId/answer

Submit an answer to the verification question. Only the lost-item owner may answer.

**Headers**

```http
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**

```json
{
  "answer": "leather"
}
```

**Response — 201 Created**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "attempt_number": 1,
  "created_at": "2024-12-15T10:20:00.000Z"
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/verify/m1n2o3p4-q5r6-7890-stuv-w12345678901/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"answer":"leather"}'
```

---

### POST /verify/:matchId/judge

The finder judges whether the submitted answer is correct.

**Headers**

```http
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**

```json
{
  "is_correct": true,
  "attempt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response — 200 OK (correct)**

```json
{
  "result": "correct",
  "message": "Verification passed. Contact information is now available."
}
```

**Response — 200 OK (incorrect)**

```json
{
  "result": "incorrect",
  "remaining_attempts": 2,
  "message": "Incorrect. 2 attempt(s) remaining."
}
```

**cURL Example**

```bash
curl -X POST http://localhost:4000/api/verify/m1n2o3p4-q5r6-7890-stuv-w12345678901/judge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"is_correct":true,"attempt_id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'
```

---

## Notification Endpoints

All notification endpoints require authentication.

### GET /notifications

Get the authenticated user's notifications.

**Headers**

```http
Authorization: Bearer <token>
```

**Query Parameters**

- `page` (optional, default `1`)
- `limit` (optional, default `20`)
- `unread` (optional, `true` to return only unread notifications)

**Response — 200 OK**

```json
{
  "notifications": [
    {
      "id": "n1m2o3p4-q5r6-7890-stuv-w12345678901",
      "type": "new_match",
      "title": "New match found!",
      "message": "Your lost item has a 87% match with a found item.",
      "match_id": "m1n2o3p4-q5r6-7890-stuv-w12345678901",
      "item_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "item_type": "lost",
      "is_read": false,
      "created_at": "2024-12-15T10:10:00.000Z"
    }
  ],
  "unread_count": 1,
  "page": 1,
  "limit": 20
}
```

**cURL Example**

```bash
curl -X GET "http://localhost:4000/api/notifications?page=1&limit=20&unread=true" \
  -H "Authorization: Bearer <token>"
```

---

## Admin Endpoints

All admin endpoints require authentication and an `admin` role.

### GET /admin/stats

Return dashboard statistics for lost items, found items, and matches.

**Headers**

```http
Authorization: Bearer <token>
```

**Response — 200 OK**

```json
{
  "lost_items": {
    "total": "42",
    "active": "38"
  },
  "found_items": {
    "total": "35",
    "active": "31"
  },
  "matches": {
    "total": "12",
    "pending": "8",
    "approved": "3",
    "disputed": "1"
  }
}
```

**cURL Example**

```bash
curl -X GET http://localhost:4000/api/admin/stats \
  -H "Authorization: Bearer <admin-token>"
```

---

### GET /admin/matches

Return all matches with pagination and optional status filter.

**Headers**

```http
Authorization: Bearer <token>
```

**Query Parameters**

- `page` (optional, default `1`)
- `limit` (optional, default `20`)
- `status` (optional, one of `pending`, `approved`, `rejected`, `disputed`)

**Response — 200 OK**

```json
{
  "page": 1,
  "limit": 20,
  "matches": [
    {
      "id": "m1n2o3p4-q5r6-7890-stuv-w12345678901",
      "total_score": 87,
      "status": "pending",
      "created_at": "2024-12-15T10:10:00.000Z",
      "lost_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "lost_category": "keys",
      "lost_desc": "Silver Toyota car keys...",
      "found_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "found_category": "keys",
      "found_desc": "Found a set of car keys..."
    }
  ]
}
```

**cURL Example**

```bash
curl -X GET "http://localhost:4000/api/admin/matches?status=pending&page=1&limit=20" \
  -H "Authorization: Bearer <admin-token>"
```

---

## Common Errors

All endpoints return errors in the following shape:

```json
{
  "message": "Error description"
}
```

Common HTTP status codes:

| Status | Meaning |
|--------|---------|
| 400 | Bad request — validation error or missing fields. |
| 401 | Unauthorized — missing or invalid JWT. |
| 403 | Forbidden — insufficient permissions. |
| 404 | Not found — resource does not exist. |
| 429 | Too many requests — rate limit or verification retry limit exceeded. |
| 500 | Internal server error. |
