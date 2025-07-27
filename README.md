# Chat App (Next.js)

This is a real-time chat application built with [Next.js](https://nextjs.org), supporting group and direct messaging, user authentication, and live updates via WebSockets.

## Features
- Real-time messaging with Socket.IO
- Group and direct conversations
- User authentication (NextAuth)
- File uploads (ImageKit)
- Optimized message fetching and API usage

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Optimized Message Fetching
- Messages are fetched only when the selected conversation changes or when paginating (scrolling up for older messages).
- The app avoids infinite API call loops by carefully managing React hook dependencies.
- For polling or live updates, the app uses WebSockets to receive new messages instantly, reducing the need for repeated HTTP polling.

### Best Practices for API Calls
- Only fetch messages when necessary (on conversation change, scroll, or new message event).
- Avoid including state like `loading` in React hook dependencies to prevent infinite loops.
- Use pagination (cursor-based) for efficient loading of large conversations.
- Use WebSockets for real-time updates instead of frequent polling.

## Troubleshooting

### Infinite API Calls
If you notice repeated or infinite API calls to `/api/messages`, check the following:
- Ensure your `useEffect` and `useCallback` dependencies do **not** include state like `loading` that changes on every fetch.
- Example fix:
  ```js
  // BAD: Causes infinite loop
  useCallback(..., [sel?._id, loading, ...])

  // GOOD: Only include stable dependencies
  useCallback(..., [sel?._id, ...])
  ```
- Only trigger message fetching on conversation change or user action.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
