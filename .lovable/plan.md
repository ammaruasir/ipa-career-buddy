## Goal
Restore the CV Review AI chat so it actually sends requests to the `cv-chat-stream` backend and returns streamed answers instead of the current failure state.

## What I found
- The chat request in the browser is going to `/api/chat` and returns `404`.
- The `cv-chat-stream` backend also logged a crash: `TypeError: messages.some is not a function`.
- In `CVChatPanel.tsx`, the transport is created only after the auth token arrives, but `useChat` is initialized before that and appears to keep the default transport.
- The installed AI SDK expects request customization via `prepareSendMessagesRequest` when we need to guarantee the final request body shape.

## Plan
1. **Fix the client transport initialization in `CVChatPanel.tsx`**
   - Replace the current `useRef`-based transport setup with a stable transport that updates when `authToken`, `cvDocumentId`, or `language` changes.
   - Ensure `useChat` always receives the intended transport instead of silently falling back to the default `/api/chat` endpoint.

2. **Normalize the outbound request body for AI SDK 5/6**
   - Use `prepareSendMessagesRequest` so the POST body explicitly includes:
     - `messages` as the UI message array
     - `cv_document_id`
     - `language`
     - existing request metadata like `id`, `trigger`, and `messageId`
   - Keep auth headers attached on every request.

3. **Harden the backend function `cv-chat-stream`**
   - Validate that `body.messages` is an array before passing it to `convertToModelMessages`.
   - Return a clear `400` error for malformed payloads instead of crashing.
   - Keep current rate-limit and auth checks intact.

4. **Validate the full flow**
   - Redeploy the function if needed.
   - Test from the browser preview that the request goes to `functions/v1/cv-chat-stream` rather than `/api/chat`.
   - Confirm the UI shows either a streamed answer or a meaningful backend error, not the current generic failure.

## Technical notes
- Files likely involved:
  - `src/components/cv-builder/CVChatPanel.tsx`
  - `supabase/functions/cv-chat-stream/index.ts`
- This should be a focused fix only for the broken CV Review AI chat path; no unrelated UI changes are needed.