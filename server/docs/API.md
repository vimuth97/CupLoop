# CupLoop API Documentation

Base URL: `http://localhost:3000`

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

Error responses always follow:
```json
{ "error": { "code": "ERROR_CODE", "message": "Description", "fields": {} } }
```

---

## Auth

### POST /auth/register

Register a new consumer account.

**Request**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "password": "Secure@123"
}
```

**Response 201**
```json
{
  "message": "Account created successfully",
  "user": {
    "id": "64abc123",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "role": "consumer",
    "loyaltyPoints": 0,
    "createdAt": "2026-05-02T10:00:00Z"
  }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing/invalid fields or weak password |
| `EMAIL_CONFLICT` | 409 | Email already registered |

---

### POST /auth/register-cafe

Register a cafe owner account and cafe profile. The cafe starts with `activeStatus: false` and requires admin approval.

**Request**
```json
{
  "firstName": "Tom",
  "lastName": "Lee",
  "email": "tom@greencup.com",
  "password": "Secure@123",
  "cafeName": "The Green Cup",
  "address": "123 Main St, Brisbane",
  "lat": -27.4698,
  "lng": 153.0251,
  "contactInfo": "+61 7 1234 5678"
}
```

**Response 201**
```json
{
  "message": "Cafe registration submitted. Your account is pending admin approval.",
  "user": { "id": "64abc", "firstName": "Tom", "lastName": "Lee", "email": "tom@greencup.com", "role": "cafe", "createdAt": "2026-05-02T10:00:00Z" },
  "cafe": { "id": "64def", "name": "The Green Cup", "activeStatus": false, "createdAt": "2026-05-02T10:00:00Z" }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing/invalid fields |
| `EMAIL_CONFLICT` | 409 | Email already registered |

---

### POST /auth/login

Authenticate any user (consumer, cafe, admin) and receive tokens.

**Request**
```json
{ "email": "jane@example.com", "password": "Secure@123" }
```

**Response 200**
```json
{
  "message": "Login successful",
  "accessToken": "<jwt — expires in 15 min>",
  "refreshToken": "<opaque hex — expires in 7 days>",
  "user": { "id": "64abc", "firstName": "Jane", "lastName": "Smith", "email": "jane@example.com", "role": "consumer" }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing email or password |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_INACTIVE` | 401 | Account has been deactivated |

---

### POST /auth/refresh

Exchange a valid refresh token for a new access token.

**Request**
```json
{ "refreshToken": "<refresh token from login>" }
```

**Response 200**
```json
{ "accessToken": "<new jwt>" }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing refresh token |
| `INVALID_REFRESH_TOKEN` | 401 | Token not found or invalid |
| `REFRESH_TOKEN_EXPIRED` | 401 | Token has expired |

---

### POST /auth/logout

Invalidate the refresh token. The client should discard both tokens.

**Request**
```json
{ "refreshToken": "<refresh token>" }
```

**Response 200**
```json
{ "message": "Logged out successfully" }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing refresh token |

---

## Consumer

All endpoints require `Authorization: Bearer <consumerAccessToken>`.

---

### GET /api/consumer/cafes

List all active cafes. Optionally filter by proximity — all three query params must be provided together.

**Query params (optional)**

| Param | Type | Description |
|-------|------|-------------|
| `lat` | number | Origin latitude (-90 to 90) |
| `lng` | number | Origin longitude (-180 to 180) |
| `radius` | number | Search radius in kilometres |

**Response 200**
```json
{
  "count": 2,
  "cafes": [
    { "_id": "64def", "name": "The Green Cup", "location": { "address": "123 Main St", "coordinates": { "type": "Point", "coordinates": [153.02, -27.47] } }, "cupInventoryCount": 45, "rating": 4.5 }
  ]
}
```

With location search, response also includes `searchOrigin: { lat, lng, radiusKm }`.

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Partial or invalid location params |

---

### GET /api/consumer/cafes/:cafeId

Get a single active cafe with its full menu.

**Response 200**
```json
{
  "cafe": { "_id": "64def", "name": "The Green Cup", "location": {}, "cupInventoryCount": 45 },
  "menu": {
    "cafeId": "64def",
    "items": [
      { "_id": "64item1", "name": "Flat White", "price": 4.5, "category": "Coffee" }
    ]
  }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `CAFE_NOT_FOUND` | 404 | Cafe not found or not active |

---

### GET /api/consumer/cafes/:cafeId/rewards

Browse currently active redeemable rewards at a cafe, sorted by points cost ascending.

**Response 200**
```json
{
  "count": 2,
  "rewards": [
    { "_id": "64rwd1", "title": "Free Flat White", "type": "free_item", "itemName": "Flat White", "pointsCost": 50, "validUntil": "2026-12-31T23:59:59Z" },
    { "_id": "64rwd2", "title": "20% Off", "type": "discount", "discountPercentage": 20, "pointsCost": 30, "validUntil": "2026-12-31T23:59:59Z" }
  ]
}
```

---

### POST /api/consumer/orders

Create a pending order. Points are awarded when the cafe completes it.

| Type | Points on completion | Barcode required |
|------|---------------------|-----------------|
| `buy` | 5 | Yes |
| `rent` | 10 | Yes |
| `own_cup` | 15 | No |

**Request**
```json
{ "cafeId": "64def", "type": "rent", "barcode": "CUP-042" }
```

**Response 201**
```json
{
  "message": "Order created. Visit the cafe to complete your purchase and earn loyalty points.",
  "order": { "id": "64ord1", "type": "rent", "status": "pending", "cafeId": "64def", "cupId": "64cup1", "loyaltyPointsOnCompletion": 10, "createdAt": "2026-05-02T10:00:00Z" }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing/invalid fields |
| `CUP_NOT_AVAILABLE` | 404 | Cup not found or not available at this cafe |

---

### GET /api/consumer/orders

List own orders. Optionally filter by `?status=pending` or `?status=completed`.

**Response 200**
```json
{
  "count": 3,
  "orders": [
    { "_id": "64ord1", "type": "rent", "status": "completed", "cafeId": { "name": "The Green Cup" }, "completedAt": "2026-05-02T11:00:00Z" }
  ]
}
```

---

### GET /api/consumer/loyalty

View loyalty points balance, earning history, and environmental impact.

**Response 200**
```json
{
  "totalPoints": 45,
  "impact": { "singleUseCupsAvoided": 7 },
  "history": [
    {
      "rewardId": "64rwd1",
      "points": 15,
      "source": "own_cup",
      "earnedAt": "2026-05-02T11:00:00Z",
      "transaction": { "id": "64ord1", "type": "own_cup", "status": "completed", "completedAt": "2026-05-02T11:00:00Z" },
      "cafe": { "id": "64def", "name": "The Green Cup", "address": "123 Main St" },
      "cup": null
    }
  ]
}
```

---

### POST /api/consumer/rewards/redeem

Redeem a cafe reward. Points are deducted immediately. Present the redemption at the cafe to claim it.

**Request**
```json
{ "cafeRewardId": "64rwd1" }
```

**Response 201**
```json
{
  "message": "Reward redeemed. Present this to the cafe to claim it.",
  "redemption": {
    "_id": "64red1",
    "cafeRewardId": { "title": "Free Flat White", "type": "free_item" },
    "cafeId": { "name": "The Green Cup" },
    "pointsSpent": 50,
    "status": "pending",
    "redeemedAt": "2026-05-02T12:00:00Z"
  }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing cafeRewardId |
| `INSUFFICIENT_POINTS` | 400 | Not enough loyalty points |
| `REWARD_NOT_AVAILABLE` | 404 | Reward expired or inactive |

---

### GET /api/consumer/rewards/redemptions

View full redemption history, newest first.

**Response 200**
```json
{
  "count": 1,
  "redemptions": [
    { "_id": "64red1", "cafeRewardId": { "title": "Free Flat White", "pointsCost": 50 }, "cafeId": { "name": "The Green Cup" }, "pointsSpent": 50, "status": "used", "usedAt": "2026-05-02T13:00:00Z" }
  ]
}
```

---

## Cafe

All endpoints require `Authorization: Bearer <cafeAccessToken>` and an approved cafe account.

---

### GET /api/cafe/inventory

View all cups assigned to this cafe with a status breakdown.

**Response 200**
```json
{
  "cafe": { "id": "64def", "name": "The Green Cup" },
  "summary": { "available": 40, "in_use": 5, "damaged": 0, "lost": 0, "total": 45 },
  "cups": [
    { "barcode": "CUP-001", "status": "available", "materialType": "bamboo", "createdAt": "2026-04-01T00:00:00Z" }
  ]
}
```

---

### GET /api/cafe/orders/pending

List all pending consumer pre-orders for this cafe.

**Response 200**
```json
{
  "count": 1,
  "orders": [
    { "_id": "64ord1", "type": "rent", "status": "pending", "userId": { "firstName": "Jane", "lastName": "Smith", "email": "jane@example.com" }, "cupId": { "barcode": "CUP-042" }, "createdAt": "2026-05-02T10:00:00Z" }
  ]
}
```

---

### PUT /api/cafe/orders/:orderId/complete

Complete a pending pre-order when the consumer arrives and pays. Awards loyalty points.

**Response 200**
```json
{
  "message": "Order completed. 10 loyalty point(s) awarded to the consumer.",
  "order": { "id": "64ord1", "type": "rent", "status": "completed", "rewardPointsEarned": 10, "completedAt": "2026-05-02T11:00:00Z" }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `ORDER_NOT_FOUND` | 404 | Order not found |
| `FORBIDDEN` | 403 | Order belongs to a different cafe |
| `ORDER_ALREADY_COMPLETED` | 409 | Order already completed |

---

### POST /api/cafe/transactions/walk-in

Settle a transaction on the spot for a customer without a pre-order. Identified by email.

**Request**
```json
{ "customerEmail": "jane@example.com", "type": "own_cup" }
```

For `buy` or `rent`, also include `"barcode": "CUP-042"`.

**Response 201**
```json
{
  "message": "Transaction completed. 15 loyalty point(s) awarded to Jane Smith.",
  "transaction": { "id": "64tx1", "type": "own_cup", "status": "completed", "rewardPointsEarned": 15, "completedAt": "2026-05-02T11:00:00Z" },
  "consumer": { "id": "64abc", "firstName": "Jane", "lastName": "Smith", "email": "jane@example.com", "loyaltyPointsAfter": 60 }
}
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing/invalid fields |
| `CONSUMER_NOT_FOUND` | 404 | No consumer account with that email |
| `ACCOUNT_INACTIVE` | 403 | Consumer account is deactivated |
| `CUP_NOT_AVAILABLE` | 404 | Cup not found or unavailable |

---

### GET /api/cafe/rewards

List all rewards in this cafe's catalogue, including inactive ones.

**Response 200**
```json
{
  "count": 2,
  "rewards": [
    { "_id": "64rwd1", "title": "Free Flat White", "type": "free_item", "pointsCost": 50, "active": true, "validFrom": "2026-05-01T00:00:00Z", "validUntil": "2026-12-31T23:59:59Z" }
  ]
}
```

---

### POST /api/cafe/rewards

Create a new reward or discount for consumers to redeem.

**Request — discount**
```json
{ "title": "20% Off", "type": "discount", "discountPercentage": 20, "pointsCost": 30, "validFrom": "2026-05-01T00:00:00Z", "validUntil": "2026-12-31T23:59:59Z" }
```

**Request — free item**
```json
{ "title": "Free Flat White", "type": "free_item", "itemName": "Flat White", "pointsCost": 50, "validFrom": "2026-05-01T00:00:00Z", "validUntil": "2026-12-31T23:59:59Z" }
```

**Response 201**
```json
{ "message": "Reward created successfully", "reward": { "_id": "64rwd1", "title": "Free Flat White", "pointsCost": 50 } }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing/invalid fields |

---

### PUT /api/cafe/rewards/:rewardId

Update an existing reward. Send only the fields to change.

**Request**
```json
{ "pointsCost": 40, "active": false }
```

**Response 200**
```json
{ "message": "Reward updated", "reward": { "_id": "64rwd1", "pointsCost": 40, "active": false } }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `REWARD_NOT_FOUND` | 404 | Reward not found or not owned by this cafe |

---

### DELETE /api/cafe/rewards/:rewardId

Remove a reward from the catalogue.

**Response 200**
```json
{ "message": "Reward deleted" }
```

---

### PUT /api/cafe/redemptions/:redemptionId/use

Mark a consumer's redemption as used when they present it at the cafe.

**Response 200**
```json
{ "message": "Redemption marked as used", "redemption": { "_id": "64red1", "status": "used", "usedAt": "2026-05-02T13:00:00Z" } }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `REDEMPTION_NOT_FOUND` | 404 | Redemption not found or belongs to different cafe |
| `REDEMPTION_ALREADY_USED` | 409 | Already marked as used |

---

## Admin

All endpoints require `Authorization: Bearer <adminAccessToken>`.

---

### GET /api/admin/dashboard

Platform-wide stats for the admin dashboard.

**Response 200**
```json
{
  "cups": { "available": 320, "in_use": 85, "damaged": 12, "lost": 4, "total": 421 },
  "cafes": { "pending": 3, "approved": 14, "rejected": 2 },
  "alerts": {
    "lowInventoryCafes": {
      "threshold": 100,
      "count": 2,
      "cafes": [ { "name": "Brew & Go", "cupInventoryCount": 42 } ]
    }
  }
}
```

---

### GET /api/admin/cafes/pending

List all cafe registrations awaiting approval.

**Response 200**
```json
{
  "count": 1,
  "cafes": [
    { "_id": "64def", "name": "The Green Cup", "ownerId": { "firstName": "Tom", "email": "tom@greencup.com" }, "activeStatus": false }
  ]
}
```

---

### PUT /api/admin/cafes/:cafeId/approve

Approve a cafe. Sets `activeStatus: true` so the owner can access management endpoints.

**Response 200**
```json
{ "message": "Cafe approved successfully", "cafe": { "id": "64def", "name": "The Green Cup", "activeStatus": true, "approvedAt": "2026-05-02T10:00:00Z" } }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `CAFE_NOT_FOUND` | 404 | Cafe not found |

---

### PUT /api/admin/cafes/:cafeId/reject

Reject a cafe registration with a mandatory reason.

**Request**
```json
{ "reason": "Unable to verify business registration documents." }
```

**Response 200**
```json
{ "message": "Cafe registration rejected", "cafe": { "id": "64def", "name": "The Green Cup", "activeStatus": false, "rejectedReason": "Unable to verify business registration documents." } }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing reason |
| `CAFE_NOT_FOUND` | 404 | Cafe not found |

---

### POST /api/admin/cups/bulk

Add multiple cups to a cafe in one request. Duplicate barcodes are skipped, not rejected.

**Request**
```json
{ "cafeId": "64def", "barcodes": ["CUP-001", "CUP-002", "CUP-003"], "materialType": "bamboo" }
```

**Response 201** (all inserted)
```json
{ "message": "3 cup(s) added to \"The Green Cup\" successfully.", "cafe": { "id": "64def", "name": "The Green Cup" }, "inserted": 3, "skippedDuplicates": 0, "duplicateBarcodes": [] }
```

**Response 207** (partial — some duplicates)
```json
{ "message": "2 cup(s) added to \"The Green Cup\". 1 duplicate barcode(s) were skipped.", "inserted": 2, "skippedDuplicates": 1, "duplicateBarcodes": ["CUP-001"] }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `VALIDATION_ERROR` | 400 | Missing cafeId, empty barcodes, or over 500 items |
| `CAFE_NOT_FOUND` | 404 | Cafe not found |

---

### GET /api/admin/cups/retired

List damaged or lost cups. Optionally filter with `?status=damaged` or `?status=lost`.

**Response 200**
```json
{
  "count": 3,
  "filter": "damaged,lost",
  "cups": [
    { "barcode": "CUP-007", "status": "damaged", "currentCafeId": { "name": "The Green Cup" } }
  ]
}
```

---

### DELETE /api/admin/cups/retired/bulk

Permanently remove all damaged and/or lost cups. Optionally scope with `?status=damaged` or `?status=lost`.

**Response 200**
```json
{ "message": "3 cup(s) permanently removed from the system", "deleted": 3, "filter": "damaged,lost" }
```

---

### DELETE /api/admin/cups/:cupId

Permanently remove a single cup. Only `damaged` or `lost` cups can be deleted.

**Response 200**
```json
{ "message": "Cup \"CUP-007\" has been permanently removed from the system", "removed": { "id": "64cup7", "barcode": "CUP-007", "status": "damaged" } }
```

**Errors**

| Code | Status | Reason |
|------|--------|--------|
| `CUP_NOT_FOUND` | 404 | Cup not found |
| `INVALID_CUP_STATUS` | 409 | Cup is available or in_use — cannot be deleted |
