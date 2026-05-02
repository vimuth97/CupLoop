# CupLoop — Server

Node.js/Express REST API for the CupLoop reusable coffee cup platform. Connects consumers, cafes, and admins to manage cup rentals, loyalty points, and rewards.

## Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Database**: MongoDB
- **Auth**: JWT (access token 15 min) + refresh tokens (7 days)
- **Password hashing**: bcrypt (cost factor 12)

## Getting Started

```bash
cd server
npm install
# copy .env and set values
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret key for signing JWTs — never commit this |
| `PORT` | Server port (default: 3000) |


## Project Structure

```
server/
├── config/         # Database connection
├── middleware/     # authenticate, requireRole, requireActiveStatus
├── models/         # Mongoose schemas
├── routes/         # Express routers (auth, consumer, cafe, admin)
├── services/       # Business logic and DB access layer
├── utils/          # Shared helpers (errorResponse)
├── docs/           # Full API documentation
└── index.js        # App entry point
```

## Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

When the access token expires, use `POST /auth/refresh` with the refresh token to get a new one without re-logging in.

## Endpoint Summary

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register a new consumer account |
| POST | `/auth/register-cafe` | Register a cafe owner account (pending approval) |
| POST | `/auth/login` | Login and receive access + refresh tokens |
| POST | `/auth/refresh` | Exchange refresh token for a new access token |
| POST | `/auth/logout` | Invalidate refresh token |

### Consumer (`/api/consumer`) — requires consumer JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/consumer/cafes` | List all active cafes, optional location filter |
| GET | `/api/consumer/cafes/:cafeId` | Get a single cafe with its menu |
| GET | `/api/consumer/cafes/:cafeId/rewards` | Browse redeemable rewards at a cafe |
| POST | `/api/consumer/orders` | Create a pending order (buy / rent / own cup) |
| GET | `/api/consumer/orders` | List own orders, optional status filter |
| GET | `/api/consumer/loyalty` | View loyalty points balance, earning history, and environmental impact |
| POST | `/api/consumer/rewards/redeem` | Redeem a cafe reward using loyalty points |
| GET | `/api/consumer/rewards/redemptions` | View redemption history |

### Cafe (`/api/cafe`) — requires cafe JWT + approved status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cafe/inventory` | View full cup inventory with status summary |
| GET | `/api/cafe/orders/pending` | List pending consumer orders |
| PUT | `/api/cafe/orders/:orderId/complete` | Complete a pre-order and award loyalty points |
| POST | `/api/cafe/transactions/walk-in` | Settle a walk-in transaction by customer email |
| GET | `/api/cafe/rewards` | List own reward catalogue |
| POST | `/api/cafe/rewards` | Create a new reward or discount |
| PUT | `/api/cafe/rewards/:rewardId` | Update a reward |
| DELETE | `/api/cafe/rewards/:rewardId` | Delete a reward |
| PUT | `/api/cafe/redemptions/:redemptionId/use` | Mark a consumer redemption as used |

### Admin (`/api/admin`) — requires admin JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Platform stats: cups by status, cafe counts, low inventory alerts |
| GET | `/api/admin/cafes/pending` | List cafes awaiting approval |
| PUT | `/api/admin/cafes/:cafeId/approve` | Approve a cafe registration |
| PUT | `/api/admin/cafes/:cafeId/reject` | Reject a cafe registration with a reason |
| POST | `/api/admin/cups/bulk` | Bulk-add cups to a cafe by barcode list |
| GET | `/api/admin/cups/retired` | List damaged or lost cups |
| DELETE | `/api/admin/cups/retired/bulk` | Remove all damaged/lost cups |
| DELETE | `/api/admin/cups/:cupId` | Remove a single damaged or lost cup |

## Error Response Format

All errors follow this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "fields": { "email": "A valid email address is required" }
  }
}
```

`fields` is only present for validation errors (400).

## Full API Documentation

See [`docs/API.md`](./docs/API.md) for complete endpoint documentation with sample requests and responses.
