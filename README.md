# 🗣️ Speako — Language Exchange & Real-Time Communication Platform

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Render-success?style=for-the-badge&logo=render)](https://speako-nrmb.onrender.com)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Stream](https://img.shields.io/badge/Stream-Chat%20%26%20Video-005FFF?style=for-the-badge&logo=stream)](https://getstream.io/)
[![Resend](https://img.shields.io/badge/Resend-Email%20API-black?style=for-the-badge&logo=resend)](https://resend.com/)

**Speako** is a full-stack MERN real-time social platform engineered to connect language learners worldwide with native speakers. The application combines **smart language matching**, **low-latency WebSocket chat**, **WebRTC voice and video calling**, and a **zero-trust cryptographic email OTP verification** system.

🌐 **Live Application**: [https://speako-nrmb.onrender.com](https://speako-nrmb.onrender.com)  
💻 **Repository**: [https://github.com/Saurav-Kumar-03/Speako](https://github.com/Saurav-Kumar-03/Speako)

---

## 📸 Key Features

- **🔐 2-Phase Staging & Email OTP Verification**:
  - Unverified accounts are staged in an isolated `PendingUser` collection with a **10-minute MongoDB TTL** auto-purge index.
  - Cryptographically secure 6-digit OTP generated via `crypto.randomInt` and stored as a one-way `SHA-256` hash.
  - Brute-force protection: 60-second cooldown timer, 5-attempt limit, and 3-resend maximum.
  - Sub-second (<500ms) transactional email dispatch using the **Resend REST API** (over HTTPS port 443), bypassing cloud hosting SMTP port firewalls.
- **💬 Real-Time Messaging**: Powered by GetStream Chat SDK with typing indicators, read receipts, reactions, and thread replies.
- **📹 WebRTC Video & Voice Calling**: Peer-to-peer and group room calls via GetStream Video SDK.
- **🤝 Mutual-Consent Social Graph**: Users must send and accept connection requests before initiating chat or video calls, preventing spam and unsolicited contact.
- **🌐 Language Matching Engine**: Discover conversation partners based on matching native and target languages.
- **🎨 Modern UI/UX**: Built with React 18, Vite, Tailwind CSS, and DaisyUI themes with full mobile responsiveness.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, DaisyUI, Lucide React, Axios |
| **Backend** | Node.js, Express.js (ES Modules), JSON Web Tokens (JWT), Cookie-Parser |
| **Database** | MongoDB Atlas, Mongoose ODM (with TTL index) |
| **Real-Time** | GetStream.io (Stream Chat & Video WebRTC SDKs) |
| **Email API** | Resend HTTP API (Production) / Nodemailer (Local fallback) |
| **Media Storage** | Cloudinary |
| **Hosting & CI/CD** | Render Cloud Platform, GitHub Actions |

---

## 📐 Architecture Overview

```
[ React 18 + Vite Frontend ]
           │
           ▼ (HTTPS / REST & WebSockets)
[ Express.js REST API Server ]
     │             │              │
     ▼             ▼              ▼
[ MongoDB Atlas ] [ GetStream.io ] [ Resend API ]
(Data + 10m TTL)  (Chat & WebRTC)  (HTTPS Mail)
```

---

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Saurav-Kumar-03/Speako.git
cd Speako
```

### 2. Configure Environment Variables

Create `backend/.env`:
```env
PORT=5001
MONGO_URI=your_mongodb_atlas_connection_string
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret
JWT_SECRET_KEY=your_jwt_secret_key
NODE_ENV=development

# Email Verification (Resend API recommended)
RESEND_API_KEY=your_resend_api_key

# Local Gmail SMTP Fallback (Optional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_google_app_password
```

Create `frontend/.env`:
```env
VITE_STREAM_API_KEY=your_stream_api_key
```

### 3. Install Dependencies & Run
```bash
# Install root, backend, and frontend dependencies
npm install --prefix backend
npm install --prefix frontend

# Run development servers concurrently
# Terminal 1: Backend
npm run dev --prefix backend

# Terminal 2: Frontend
npm run dev --prefix frontend
```

---

## 🚢 Production Deployment

The project is structured as a full-stack monorepo ready for platforms like **Render**:

```bash
# Production Build Command:
npm run build

# Production Start Command:
npm start
```

---

## 👨‍💻 Author

**Saurav Kumar**  
GitHub: [@Saurav-Kumar-03](https://github.com/Saurav-Kumar-03)
