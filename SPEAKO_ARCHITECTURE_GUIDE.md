# Speako — Complete Architecture & Panel Presentation Guide

> **Project**: Speako (Language Exchange & Communication Platform)  
> **Stack**: React 19, Vite, Tailwind CSS, DaisyUI, Node.js, Express.js, MongoDB Atlas, Mongoose, GetStream Chat & Video SDKs, Node Crypto, JWT

---

## Table of Contents
1. [Phase 1: Architecture & Technology Stack Overview](#phase-1-architecture--technology-stack-overview)
2. [Phase 2: Database Architecture & Data Models (MongoDB & Mongoose)](#phase-2-database-architecture--data-models)
3. [Phase 3: Backend Security, Authentication & Email Engine](#phase-3-backend-security-authentication--email-engine)
4. [Phase 4: Frontend State Architecture, UI & Routing](#phase-4-frontend-state-architecture-ui--routing)
5. [Phase 5: Real-Time Communication (Chat & WebRTC Video Calling)](#phase-5-real-time-communication)
6. [Phase 6: The Global Notification System & Advanced Real-Time Patterns](#phase-6-the-global-notification-system)
7. [Panel Defense Master Q&A (All Phases)](#panel-defense-master-qa)

---

# Phase 1: Architecture & Technology Stack Overview

### 1. High-Level Architecture Model
Speako implements a **Decoupled Client-Server-Cloud Architecture**:
- **Client Tier**: React 19 SPA running in the browser, styled with Tailwind CSS + DaisyUI themes.
- **Server Tier**: Express.js REST API server on Node.js (ES Modules). Handles database operations, authorization boundaries, and token generation.
- **Data & Real-Time Cloud Tier**:
  - **MongoDB Atlas**: Document persistence for profiles, friendship relations, and ephemeral staging sessions.
  - **GetStream Cloud**: Real-time WebSocket edge network for direct messaging and WebRTC media routing (SFU) for video calls.
  - **Email Dispatcher**: Multi-tier failover (Google Apps Script Webhook over Port 443 HTTPS $\rightarrow$ Resend $\rightarrow$ Nodemailer).
  - **DiceBear API**: Dynamic avatar generation.

### 2. Technology Stack & Rationale
| Layer | Technology | Why It Was Chosen |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + Vite | Concurrent rendering, modern hooks, fast Vite HMR and Rollup production bundling. |
| **Styling** | Tailwind CSS + DaisyUI 4 | Semantic theming (`data-theme="forest"`) without CSS duplication. |
| **Server State** | TanStack React Query v5 | Automatic background caching, query deduplication, and declarative cache invalidation. |
| **Client State** | Zustand v5 | Lightweight store for local theme persistence in `localStorage`. |
| **Backend Runtime** | Node.js + Express 4 | High-performance asynchronous event loop, native ES Modules (`type: "module"`). |
| **Database** | MongoDB + Mongoose 8 | Document-oriented schema flexibility, atomic array updates, and native TTL indexes. |
| **Authentication** | JWT in `httpOnly` Cookies | Zero JavaScript access to tokens, completely preventing XSS token exfiltration. |
| **Chat & Video** | GetStream Chat & Video SDKs | Offloads persistent WebSockets and WebRTC media relays (SFU/TURN) to specialized infrastructure. |

---

# Phase 2: Database Architecture & Data Models

### 1. The 4 Mongoose Schemas
1. **`User.js` (Persistent Profiles)**:
   - Contains `fullName`, `email`, `password` (bcrypt hash), `profilePic`, `nativeLanguage`, `learningLanguage`, `isOnboarded`, `tokenVersion`, and `friends` (`ObjectId[]` referencing `User`).
2. **`PendingUser.js` (Unverified Signup Staging)**:
   - Stores `passwordHash`, `otpHash`, `otpAttempts`, `lastOtpSentAt`, `resendCount`.
   - **TTL Index**: `createdAt: { type: Date, default: Date.now, expires: 600 }` (auto-deletes after 10 minutes).
3. **`PasswordReset.js` (Recovery Staging)**:
   - Stores `otpHash`, `resetTokenHash`, `resetTokenExpiresAt`, `isConsumed`, `consumedAt`.
   - **TTL Index**: `createdAt: { type: Date, default: Date.now, expires: 900 }` (auto-deletes after 15 minutes).
4. **`FriendRequest.js` (Social Graph States)**:
   - Stores `sender` and `recipient` ObjectIds, with `status: enum["pending", "accepted"]`.

### 2. Critical Database Patterns
- **Preventing Double-Hashing**: `User.js` uses a `pre("save")` hook to bcrypt-hash modified passwords. When promoting `PendingUser` to `User` during signup, Speako executes `User.collection.insertOne(userDoc)` to bypass Mongoose document middleware and prevent re-hashing the pre-hashed password.
- **Atomic Concurrency Protection**: Password reset uses `PasswordReset.findOneAndUpdate({ resetTokenHash, isConsumed: false, resetTokenExpiresAt: { $gt: new Date() } }, { isConsumed: true })`. This guarantees single-use authorization and eliminates race conditions.
- **Atomic Social Operators**: `$addToSet` guarantees idempotent friend addition without duplicate IDs. `$nin` and `$ne` filter out self and existing connections in partner recommendations.

---

# Phase 3: Backend Security, Authentication & Email Engine

### 1. Dual-Verification Security Flows
- **Registration**: Email validated for `@gmail.com` $\rightarrow$ Password pre-hashed with bcrypt (10 rounds) $\rightarrow$ 6-digit CSPRNG OTP generated and SHA-256 hashed $\rightarrow$ Staged in `PendingUser` $\rightarrow$ Promoted to `User` only upon OTP match.
- **Forgot Password**: Generic 200 response returned regardless of account existence (prevents email harvesting) $\rightarrow$ Dummy cryptographic hashing performed for non-existent users (prevents timing side-channels) $\rightarrow$ OTP verified $\rightarrow$ 32-byte single-use `resetToken` generated $\rightarrow$ Password updated and `tokenVersion` incremented.

### 2. Cryptographic Highlights
- **`crypto.randomInt(100000, 1000000)`**: OS kernel CSPRNG entropy; immune to predictable `Math.random()` exploits.
- **`crypto.timingSafeEqual`**: Constant-time comparison mitigating nanosecond-level side-channel timing attacks on OTP verification.
- **`httpOnly` Cookie Hardening**: `httpOnly: true` (XSS immune), `sameSite: "strict"` (CSRF immune), `secure: production` (HTTPS only).
- **Stateless Session Revocation (`tokenVersion`)**: Bumping `user.tokenVersion += 1` revokes all active JWT sessions across devices instantly without requiring a Redis database.

### 3. Failover Email Engine (`mail.js`)
- Cloud hosts like Render and AWS drop outbound SMTP traffic on ports 25, 465, and 587.
- Speako executes a 3-tier priority delivery engine:
  1. **Tier 1**: Google Apps Script Webhook (Port 443 / HTTPS POST) — bypasses SMTP blocks and sends without custom domain verification.
  2. **Tier 2**: Resend API (HTTPS REST API).
  3. **Tier 3**: Nodemailer connection pool (local development fallback).

---

# Phase 4: Frontend State Architecture, UI & Routing

### 1. Server State vs. Client State Separation
- **TanStack React Query**: Manages asynchronous server data (`authUser`, `friends`, `friendRequests`, `streamToken`). Employs declarative cache invalidation (`queryClient.invalidateQueries`) to synchronize UI states on mutations.
- **Zustand (`useThemeStore`)**: Manages local UI theme preference (`forest`, `coffee`, etc.) persisted in browser `localStorage`.

### 2. Route Protection Hierarchy (React Router 7)
- **Tier 1 (Loading Guard)**: `if (isLoading) return <PageLoader />` prevents Flash of Unauthenticated Content (FOUC).
- **Tier 2 (Auth Guard)**: Unauthenticated requests redirected to `/login`.
- **Tier 3 (Onboarding Guard)**: Authenticated users with `isOnboarded: false` are forced to `/onboarding`.

### 3. Multi-Step Form State Machines
- Both Signup and Forgot Password implement progressive state machines with monospaced 6-digit auto-filtered inputs, 60-second cooldown timers with self-cleaning `setInterval` destructors, and password visibility toggles.

---

# Phase 5: Real-Time Communication

### 1. GetStream Chat Integration
- Express issues HMAC-SHA256 user tokens via `generateStreamToken(userId)` (`GET /api/chat/token`). The browser connects directly to GetStream's WebSocket edge servers.
- **Deterministic 1-on-1 Channel IDs**: `[authUser._id, targetUserId].sort().join("_")` guarantees identical room resolution regardless of who initiates chat.

### 2. WebRTC Video Calling (`@stream-io/video-react-sdk`)
- In-chat call invitations send a direct room link: `${origin}/call/${channel.id}`.
- `CallPage.jsx` initializes `StreamVideoClient`, joins the call room via `callInstance.join({ create: true })`, and renders `<SpeakerLayout />` with full hardware mute/camera controls.
- Automatically handles call disconnection transitions via `CallingState.LEFT` to return the user to Home.

---

# Phase 6: The Global Notification System

### 1. Hybrid Event Pipeline (`NotificationContext.jsx`)
- **Shared Stream Singleton**: Mounts once on login, connects in the background, and shares the client instance with `ChatPage.jsx` (zero duplicate connections).
- **Hybrid Transport**:
  - **Chat Messages**: Real-time push via Stream WebSockets (`message.new`, `notification.message_new`).
  - **Friend Requests**: 12-second background polling via React Query (`refetchIntervalInBackground: false`).

### 2. Intelligent Notification UX
- **Toast Suppression in Active Chat**: Synchronous `activeChatUserIdRef` check suppresses toast alerts when the user is already viewing that conversation.
- **Silent Initial Seeding**: Populates `seenRequestIds` on initial page load to eliminate toast storms for pre-existing requests.
- **Navigation Badges**: Normalizes counts (`unreadMessageCount + pendingFriendRequestCount`) with `99+` formatting across desktop Navbar, mobile drawer, Sidebar, and Home action buttons.
- **3-Tier Stacked Notifications Page**: Organizes notifications into:
  1. *Friend Requests* (Incoming requests with Accept action)
  2. *New Connections* (Accepted requests)
  3. *Unread Messages* (Active unread chats with last message preview and direct Reply button)

---

# Panel Defense Master Q&A

### Database & Concurrency
- **Q: Why use a separate `PendingUser` collection instead of `isVerified: false` in `User`?**  
  *A*: To protect unique email indexes from abandoned signups, keep `User` table index memory small, and leverage MongoDB TTL indexes for automated garbage collection.
- **Q: How does password reset prevent concurrent replay attacks?**  
  *A*: Using atomic `findOneAndUpdate` on `{ resetTokenHash, isConsumed: false }` setting `{ isConsumed: true }`. MongoDB's write lock ensures only the first request succeeds.
- **Q: What is the Mongoose double-hashing problem?**  
  *A*: Pre-save bcrypt hooks re-hash already-hashed passwords. We resolve this by using `User.collection.insertOne()` during signup verification to bypass Mongoose document middleware.

### Security & Session Management
- **Q: Why `httpOnly` cookies over `localStorage`?**  
  *A*: `localStorage` is accessible to JavaScript and vulnerable to XSS exfiltration. `httpOnly` cookies are inaccessible to scripts, and `SameSite: 'strict'` prevents CSRF.
- **Q: How does `tokenVersion` revoke sessions across devices without Redis?**  
  *A*: By embedding `tokenVersion` in the JWT and comparing it against MongoDB in `protectRoute`. Incrementing `user.tokenVersion += 1` invalidates all older tokens instantly.
- **Q: How does the system defend against Timing Attacks?**  
  *A*: Using `crypto.timingSafeEqual` for OTP comparison and executing dummy cryptographic operations on non-existent accounts in the forgot-password flow.

### Real-Time & Frontend Architecture
- **Q: Why GetStream over custom Socket.io / WebRTC?**  
  *A*: Custom WebRTC requires TURN servers and complex SFU media routing for reliability across firewalls. Stream provides enterprise infrastructure at zero backend maintenance.
- **Q: Why TanStack React Query over storing everything in Redux?**  
  *A*: Server state requires caching, background deduping, and revalidation, which React Query provides out of the box. Client state (theme) is cleanly isolated in Zustand.
- **Q: Why use a hybrid polling/WebSocket approach for notifications?**  
  *A*: High-frequency chat messages use Stream's existing WebSockets. Low-frequency friend requests use lightweight 12-second polling, avoiding the cost of custom backend WebSocket servers.
