# Fix "تعذّر الوصول للذكاء الاصطناعي" in CV Coach chat

## Root cause

Edge function logs show:

```
TypeError: messages.some is not a function
  at standardizePrompt (... ai/6.0.185 ...)
```

In `supabase/functions/cv-chat-stream/index.ts`, `convertToModelMessages(messages)` is called **without `await`**. In AI SDK v6 this helper returns a `Promise<ModelMessage[]>`, so `streamText` receives a Promise instead of an array and crashes immediately. The client then shows the generic "تعذّر الوصول للذكاء الاصطناعي" toast.

This is the only failure — auth, rate limit, gateway, and streaming wiring all work (curl returned `200 text/event-stream`).

## Change

Edit `supabase/functions/cv-chat-stream/index.ts` (one line):

```ts
const result = streamText({
  model,
  system,
  messages: await convertToModelMessages(messages),
  abortSignal: req.signal,
});
```

No other files change. No frontend changes. No schema changes.

## Verification

1. Redeploy `cv-chat-stream` (automatic).
2. `supabase--curl_edge_functions` POST `/cv-chat-stream` with a minimal `messages` payload → expect SSE chunks of `type:"text-delta"` instead of an immediate `type:"error"`.
3. In the preview, send a message from the CV chat panel → assistant reply should stream in.
