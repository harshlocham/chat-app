# Chat App

A real-time chat application built with Next.js, featuring group and direct messaging, user authentication, and live updates via WebSockets.

![Chat App Screenshot](/public/desktop-hero.png)

## Features

- Real-time messaging with Socket.IO
- Group and direct conversations
- User authentication (NextAuth)
- File uploads (ImageKit)
- Profile picture management
- Optimized message fetching

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`:
```bash
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.IO
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth.js
- **File Storage**: ImageKit
- **Real-time**: Socket.IO

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── conversations/ # Conversation management
│   │   ├── messages/      # Message handling
│   │   └── users/         # User management
│   ├── (chat)/            # Chat pages (grouped routes)
│   ├── login/             # Login page
│   ├── register/          # Registration page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React Components
│   ├── home/              # Chat interface components
│   │   ├── dialogs/       # Modal dialogs
│   │   ├── ChatBox.tsx    # Main chat container
│   │   ├── left-panel.tsx # Sidebar navigation
│   │   └── userProfile.tsx # User profile management
│   └── ui/                # Reusable UI components
├── lib/                   # Utilities & Configurations
│   ├── controllers/       # Business logic controllers
│   ├── repositories/      # Data access layer
│   ├── services/          # Business services
│   ├── validators/        # Input validation schemas
│   ├── api.ts            # API client functions
│   ├── auth.ts           # Authentication configuration
│   ├── db.ts             # Database connection
│   └── utils.ts          # Utility functions
├── models/               # MongoDB Models
│   ├── User.ts           # User model
│   ├── Message.ts        # Message model
│   └── Conversation.ts   # Conversation model
├── store/                # State Management
│   ├── chat-store.ts     # Chat state (Zustand)
│   └── useSocketStore.ts # Socket connection state
├── hooks/                # Custom React Hooks
├── providers/            # Context Providers
├── types/                # TypeScript Type Definitions
├── middleware.ts         # Next.js middleware
└── dummy-data/           # Mock data for development
```

## Screenshots
