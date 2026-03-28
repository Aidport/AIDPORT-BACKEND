# Aidport

Aidport is a NestJS backend for shipment and logistics management, supporting both regular users and agents (logistics partners).

## Project Structure

```
src/
├── core/                 # App-wide infrastructure
│   └── encryption/       # Argon2 password hashing
├── common/               # Reusable utilities
│   ├── decorators/       # @CurrentUser, @Roles, @Public
│   ├── dto/              # Pagination, etc.
│   ├── guards/           # JWT auth, Roles guard
│   └── pipes/            # Validation pipe
├── modules/              # Domain modules
│   ├── auth/             # Signup, login (User & Agent)
│   ├── user/             # User profile, CRUD
│   ├── agent/            # Agent-specific logic
│   └── shipment/         # Post shipments, accept/decline, deliver
├── app.module.ts
├── health.controller.ts
└── main.ts
```

## Tech Stack

- **NestJS** – Backend framework
- **MongoDB** – Database (via Mongoose)
- **Argon2** – Password hashing
- **JWT** – Authentication
- **Passport** – Auth strategy
- **class-validator** – DTO validation
- **Cloudinary + Multer** – File uploads

## Setup

1. Copy env file and configure:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Ensure MongoDB is running (or use the default `mongodb://localhost:27017/aidport`).

4. Configure Cloudinary (for file uploads): Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `.env`.

5. Start the app:

```bash
npm run start:dev
```

## API Endpoints

### Auth (public)
- `POST /auth/signup` – User registration
- `POST /auth/signup/agent` – Agent registration
- `POST /auth/signup/admin` – Admin registration
- `POST /auth/login` – Login
- `POST /auth/forgot-password` – Forgot password
- `POST /auth/reset-password` – Reset password
- `POST /auth/verify-email` – Verify email
- `POST /auth/resend-verification` – Resend verification

### Users (protected)
- `GET /users/me` – Current user profile
- `PATCH /users/me` – Update profile (name, phone, address, city, state, zipCode, country, avatarUrl)
- `PATCH /users/me/settings` – Update settings (notifications, language, timezone)
- `PATCH /users/me/password` – Change password

### Dashboard (protected)
- `GET /dashboard/me` – Dashboard for current user (role-based)
- `GET /dashboard/user` – User dashboard (shipments, stats)
- `GET /dashboard/agent` – Agent dashboard (incoming, accepted, delivered, weekly trend)

### Admin (protected, Admin only)
- `GET /admin/users` – List all users
- `GET /admin/agents` – List all agents
- `GET /admin/shipments` – List all shipments
- `GET /admin/analytics` – Overview, charts, weekly trend
- `POST /admin/users` – Create user (body: name, email, password, role?)

### Shipments (protected)
- `POST /shipments` – Create shipment
- `GET /shipments` – List shipments (paginated)
- `GET /shipments/incoming` – Incoming shipments (agents only)
- `GET /shipments/:id` – Get shipment
- `PATCH /shipments/:id` – Update shipment
- `POST /shipments/:id/accept` – Accept (agents only)
- `POST /shipments/:id/decline` – Decline (agents only)
- `POST /shipments/:id/delivered` – Mark delivered (agents only)

### Upload (protected, Cloudinary)
- `POST /upload/single` – Upload single file
- `POST /upload/multiple` – Upload multiple files (max 10)

### Health
- `GET /` – Health check
- `GET /health` – Health status

## Testing

```bash
# Unit tests
npm test

# E2E tests (uses MongoMemoryServer)
npm run test:e2e

# Integration tests
npm run test:integration

# Coverage
npm run test:cov
```

## Figma Reference

Design: [Aidport Figma](https://www.figma.com/design/iQdu83cjBHqq8jSL06ZeUa/Aidport?node-id=120-273)
# AIDPORT-BACKEND
# AIDPORT-BACKEND
