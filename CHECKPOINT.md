# WebRTC Calling Pipeline Tracker

Updated: 2026-04-14

## Current state (implemented)

- Socket signaling relay exists for offer/answer/ICE and call lifecycle events in `apps/socket/server/socket/handlers/call/call.handler.ts`.
- Redis-backed call orchestration/state machine exists (ringing -> accepted -> active, reject/end/timeout, reconnect helpers) in `apps/socket/server/socket/services/call.orchestration.service.ts`.
- Browser WebRTC primitives exist (`PeerManager` + `useWebRTC`) in `apps/web/lib/webrtc/peer-manager.ts` and `apps/web/hooks/useWebRTC.ts`.
- Client signaling emitter/listener hook exists in `apps/web/hooks/useCallSignaling.ts`.
- Client call store/selectors exist in `apps/web/store/call-store.ts` and `apps/web/hooks/useCallState.ts`.

## Pending to enable end-to-end video call pipeline

### P0 - Wire hooks into real UI flow

- [ ] Mount a top-level calling controller (provider or page-level component) that uses `useCallSignaling`, `useCallState`, and `useWebRTC` together.
- [ ] Handle incoming signaling events for `call:offer`, `call:answer`, and `call:ice-candidate` on the client and bridge them to `handleOffer`, `handleAnswer`, and `handleICE`.
- [ ] Start local media before generating offer/answer and send SDP/candidates through signaling.
- [ ] Render local and remote streams with `<video>` elements and proper autoplay/playsInline/muted behavior.

### P0 - Trigger points and call controls

- [ ] Add call start actions in chat UI (audio/video buttons) and trigger `emitOfferInit` + `startOutgoingCall`.
- [ ] Add incoming call modal actions wired to `emitAccept` / `emitReject`.
- [ ] Add in-call controls for mute/camera/end and connect to media tracks + `emitEnd`.

### P1 - Reconnect and resilience

- [ ] Implement reconnect flow using `CALL_RECONNECT` event and backend helpers (`markCallReconnecting`, `resumeCallFromReconnect`, `refreshCallHeartbeat`, `expireReconnectGrace`) which are present but not wired in handlers.
- [ ] Add heartbeat/TTL refresh while call is active to avoid false expiry.
- [ ] Add ICE restart handling path on reconnect (`restartIce` + signaling round trip).

### P1 - Media/network production readiness

- [ ] Add TURN servers (STUN-only is currently configured) and env-based ICE config.
- [ ] Add device selection/fallback and permission-denied UX.
- [ ] Add cleanup safeguards on route change/tab close to prevent leaked tracks/peer connections.

### P2 - Platform and UX finish

- [ ] Add Picture-in-Picture support for remote video in web call UI.
- [ ] Add call quality/debug surface (connection state, ICE state, bitrate summary).
- [ ] Add missed/failed call toast and call history integration.

### P2 - Tests

- [ ] Unit tests for call controller signaling-to-WebRTC bridging.
- [ ] Socket integration tests for offer/answer/ICE relay and call state transitions.
- [ ] E2E happy-path test: outgoing -> accepted -> active -> end.

## Fastest path to first successful video call

1. Build a minimal call controller component that mounts in the chat screen.
2. Wire signaling (`CALL_OFFER`, `CALL_ANSWER`, `CALL_ICE_CANDIDATE`) to `useWebRTC` handlers.
3. Add two `<video>` elements and local media startup.
4. Wire start/accept/end buttons.
5. Validate with two browsers using the same socket backend.
