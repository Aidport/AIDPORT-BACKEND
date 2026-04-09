# Aidport – Feature Verification Checklist

## ✅ All Requested Features Implemented

### 1. Core App Structure (from PDF)
- [x] NestJS app with modular structure
- [x] MongoDB + Mongoose
- [x] Argon2 for password hashing
- [x] User & Agent sign up
- [x] Login
- [x] Shipments (post, accept, decline, delivered)
- [x] Dashboard / health endpoints

### 2. Auth Features
- [x] **Sign up** (user & agent)
- [x] **Login**
- [x] **Forgot password** – `POST /auth/forgot-password`
- [x] **Reset password** – `POST /auth/reset-password`
- [x] **Verify email** – `POST /auth/verify-email`
- [x] **Request verification code** – `POST /auth/request-verification-code`

### 3. Email (Google SMTP)
- [x] `EmailService` with Nodemailer (Google SMTP)
- [x] `BaseEmail` abstract class (intro, OTP/code, outro)
- [x] `PasswordResetMail` – reset link email
- [x] `VerificationMail` – OTP verification email

### 4. File Upload
- [x] `FileValidationPipe` – validates extensions (jpg, jpeg, png, svg, webp, gif, mp4, webm, mov)
- [x] `POST /upload/single` – single file
- [x] `POST /upload/multiple` – multiple files
- [x] Optional `imageUrls` on shipments

---

## ✅ Tests

### Unit Tests (35 total)
| Module | Tests |
|--------|-------|
| `EncryptionService` | hash, verify |
| `AuthService` | signUp, signUpAgent, login, forgotPassword, resetPassword, verifyEmail, requestVerificationCode |
| `UserService` | create, findById |
| `ShipmentService` | findOne, accept |
| `EmailService` | isConfigured |
| `FileValidationPipe` | valid/invalid extensions, single/array |

### Integration Tests (6 total)
- Sign up, duplicate email, login, invalid login
- Forgot password
- Reset password with valid token

### E2E Tests (8 total)
- Health check
- Sign up, login
- Protected route (401 without token)
- User profile with token
- Forgot password
- Reset password rejects invalid token

---

## Run Tests

```bash
npm test              # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e      # E2E tests
```
