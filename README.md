# Chat App

A real-time chat application built with Next.js, featuring group and direct messaging, user authentication, and live updates via WebSockets.
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
INTERNAL_SECRET=generate_a_long_random_secret_shared_by_next_and_socket_server
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
├── Bin
│   ├── register
│   │   └── route.ts
│   ├── socketHandlers.ts
│   └── useConversationId.ts
├── components.json
├── dist
│   └── socket.js
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.socket
├── eslint.config.mjs
├── next-auth.d.ts
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public
│   ├── bg-dark.png
│   ├── bg-light.png
│   ├── dall-e.png
│   ├── desktop-hero.png
│   ├── file.svg
│   ├── globe.svg
│   ├── gpt.png
│   ├── next.svg
│   ├── placeholder.png
│   ├── vercel.svg
│   └── window.svg
├── README.md
├── socket.ts
├── src
│   ├── app
│   │   ├── (chat)
│   │   ├── admin
│   │   │   ├── page.tsx
│   │   │   ├── settings
│   │   │   │   └── page.tsx
│   │   │   └── users
│   │   │       └── page.tsx
│   │   ├── api
│   │   │   ├── admin
│   │   │   │   ├── changeRoal
│   │   │   │   │   └── route.ts
│   │   │   │   ├── dashboard
│   │   │   │   │   └── route.ts
│   │   │   │   └── toggleban
│   │   │   │       └── route.ts
│   │   │   ├── auth
│   │   │   │   ├── [...nextauth]
│   │   │   │   │   └── route.ts
│   │   │   │   ├── imagekit-auth
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sendOtp
│   │   │   │   │   └── route.ts
│   │   │   │   └── verify-otp
│   │   │   │       └── route.ts
│   │   │   ├── conversations
│   │   │   │   ├── [id]
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── me
│   │   │   │   └── route.ts
│   │   │   ├── messages
│   │   │   │   ├── [id]
│   │   │   │   │   ├── delete
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── edit
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── react
│   │   │   │   │       └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── testdb
│   │   │   │   └── route.ts
│   │   │   ├── updateImage
│   │   │   │   └── route.ts
│   │   │   ├── user
│   │   │   │   └── [email]
│   │   │   │       └── route.ts
│   │   │   └── users
│   │   │       └── route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── login
│   │   │   └── page.tsx
│   │   ├── page.tsx
│   │   └── register
│   │       └── page.tsx
│   ├── components
│   │   ├── admin
│   │   │   ├── Charts.tsx
│   │   │   ├── ConversationTable.tsx
│   │   │   ├── ReportTable.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SystemStatus.tsx
│   │   │   ├── TopStats.tsx
│   │   │   ├── UserActions.tsx
│   │   │   └── UserTable.tsx
│   │   ├── chat
│   │   │   └── reaction-bar.tsx
│   │   ├── home
│   │   │   ├── chat-bubble-avatar.tsx
│   │   │   ├── chat-bubble.tsx
│   │   │   ├── chat-placeholder.tsx
│   │   │   ├── ChatBox.tsx
│   │   │   ├── ChatDaySeparator.tsx
│   │   │   ├── conversation.tsx
│   │   │   ├── dialogs
│   │   │   │   ├── FileUpload.tsx
│   │   │   │   ├── user-list-dialog.tsx
│   │   │   │   └── UserItem.tsx
│   │   │   ├── group-members-dialog.tsx
│   │   │   ├── ImageDebug.tsx
│   │   │   ├── ImageUpload.tsx
│   │   │   ├── left-panel.tsx
│   │   │   ├── message-container.tsx
│   │   │   ├── message-input.tsx
│   │   │   ├── ProfilePictureUpload.tsx
│   │   │   ├── right-panel.tsx
│   │   │   ├── theme-switch.tsx
│   │   │   ├── UserAvatar.tsx
│   │   │   └── userProfile.tsx
│   │   └── ui
│   │       ├── avatar.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       └── sonner.tsx
│   ├── context
│   │   └── UserContext.tsx
│   ├── dummy-data
│   │   └── db.ts
│   ├── lib
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── controllers
│   │   │   └── message.controller.ts
│   │   ├── Db
│   │   │   └── offlineMessages.ts
│   │   ├── db.ts
│   │   ├── hooks
│   │   │   ├── useNetworkStatus.ts
│   │   │   ├── useOfflineMessageSync.ts
│   │   │   └── useRateLimitHandler.ts
│   │   ├── mongo.ts
│   │   ├── rateLimiter.ts
│   │   ├── repositories
│   │   │   └── message.repo.ts
│   │   ├── sendOtp.ts
│   │   ├── services
│   │   │   └── message.service.ts
│   │   ├── socket.ts
│   │   ├── socketClient.tsx
│   │   ├── svgs.tsx
│   │   ├── utils.ts
│   │   └── validators
│   │       └──  message.schema.ts
│   ├── middleware.ts
│   ├── models
│   │   ├── Conversation.ts
│   │   ├── Devices.ts
│   │   ├── Message.ts
│   │   ├── OTP.ts
│   │   ├── TempMessage.ts
│   │   └── User.ts
│   ├── pages
│   │   └── api
│   │       └── socket.ts
│   ├── providers
│   │   └── theme-provider.tsx
│   ├── store
│   │   ├── chat-store.ts
│   │   ├── offline-store.ts
│   │   └── useSocketStore.ts
│   └── types
│       ├── conversation.ts
│       ├── next-auth.d.ts
│       └── user.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.server.json
├── types.d.ts
└── utils
    └── imagekit.ts
```

## Screenshots
