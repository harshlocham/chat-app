---
"@chat/auth": patch
"@chat/socket": patch
"@chat/web": patch
"chat-app": patch
---

Fix socket auth and deployment flow for production by normalizing origins, enabling cross-subdomain auth cookies, and binding the socket server to the Render-injected port.
