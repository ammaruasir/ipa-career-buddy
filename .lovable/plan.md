# GPT-style CV Chat — Full Rebuild

Make the CV coach feel and behave like ChatGPT (streaming bubbles, Markdown, attachments, working buttons) by moving to the AI SDK + AI Elements stack, while keeping the existing structured outputs (justifications, replacements, suggested actions) and the "accept improvement" workflow.

## Problems today

1. The edge function `chat-with-cv` is non-streaming and forces a tool call. With long CV grounding it now hits **504 IDLE_TIMEOUT (150s)** → the UI stays stuck on "جارٍ التحليل..." forever.
2. Because the request never resolves, **every button appears broken**: starter prompts, Send / Enter, and the per-message "اعتمد هذا التحسين" (it requires a finished AI reply).
3. There is no attachment button at all.
4. The UI is hand-rolled bubbles — not GPT-style, no Markdown rendering, no streaming feel.

## Target UX (ChatGPT-style)

- Streaming assistant bubbles that type out token-by-token.
- Markdown rendering (lists, bold, code).
- Sticky scroll-to-bottom + scroll button.
- Composer with: textarea, attachment button (📎), submit (with stop-while-streaming), Enter to send, Shift+Enter newline.
- Starter prompt chips on empty state.
- Each assistant message keeps the existing extras below the bubble:
  - Justification cards
  - Replacement cards with **"اعتمد هذا التحسين"** button (writes to `revision.accepted_rewrites` via existing `onAcceptImprovement`)
  - Suggested-actions panel
  - "Use as improvement" generic button (opens existing picker dialog)
- Attachments: image or PDF page sent inline to the AI as a `file` part (e.g. "حلّل هذه الشهادة"). Stored only for the current turn (no upload bucket).

## Implementation

### 1. Install AI Elements primitives
Run once:
```
bun x ai-elements@latest add conversation message prompt-input shimmer response
```
(plus `bun add ai @ai-sdk/react @ai-sdk/openai-compatible zod` if missing).

### 2. New streaming edge function `cv-chat-stream`
- `supabase/functions/cv-chat-stream/index.ts`
- Uses `streamText` from `npm:ai` + Lovable AI Gateway provider (`google/gemini-3-flash-preview`).
- Accepts `{ messages: UIMessage[], cv_document_id, conversation_id?, language }`.
- Loads CV grounding (same query as today) and prepends as `system`.
- Streams main coaching text (Markdown allowed).
- For structured extras, run a **second, fast non-streaming `generateText` with `Output.object`** (schema = `{ justifications, suggested_actions, replacements }`) once the user message is known, and emit it as a **custom data part** via `result.toUIMessageStreamResponse({ messageMetadata })` or `createUIMessageStream` + `writer.write({ type: "data-extras", data: ... })`.
- `onFinish` saves the completed assistant `UIMessage` (text + extras) to `cv_conversations.messages`, matching today's persistence shape.
- Keeps existing `checkRateLimit` and `sanitizeForPrompt` guards.
- `supabase/config.toml` gets `[functions.cv-chat-stream] verify_jwt = false` only if needed (default fine here since we read the auth header manually).

### 3. Rewrite `src/components/cv-builder/CVChatPanel.tsx` with AI Elements
- Use `useChat` from `@ai-sdk/react` with a `DefaultChatTransport` pointed at the Supabase function URL (`${VITE_SUPABASE_URL}/functions/v1/cv-chat-stream`) with the user's access token in `Authorization`.
- Compose:
  ```
  <Conversation>
    <ConversationContent>
      {messages.map(m => (
        <Message from={m.role}>
          <MessageContent>
            {m.parts.map(part => …)}
          </MessageContent>
        </Message>
      ))}
      {status === "submitted" && <Shimmer>جارٍ التفكير…</Shimmer>}
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
  <PromptInput onSubmit={…}>
    <PromptInputTextarea />
    <PromptInputFooter className="justify-between">
      <AttachmentButton />
      <PromptInputSubmit status={status} />
    </PromptInputFooter>
  </PromptInput>
  ```
- Render text parts with `<MessageResponse>` so Markdown streams correctly.
- Render the custom `data-extras` part → existing JustificationCard, Replacement cards (with working "اعتمد هذا التحسين" calling `onAcceptImprovement`), and suggested-actions list. Generic "Use as improvement" button still opens the picker `Dialog`.
- Starter prompts on empty state call `sendMessage({ text: prompt })` — guaranteed to work because they go through `useChat`.
- Attachment button: hidden `<input type="file" accept="image/*,application/pdf">` → on change, call `sendMessage({ files: [file] })` (AI SDK handles base64 file parts).
- Assistant bubble = transparent background (per chat-agent UI contract). User bubble = `bg-primary text-primary-foreground` rounded.
- Keep RTL/LTR via `dir={language === "ar" ? "rtl" : "ltr"}`.
- Auto-focus textarea on mount, after send, after streaming ends.

### 4. Keep the picker dialog
Existing extract-from-reply + before/after preview dialog stays — just opened from the new message component.

### 5. Cleanup
- Leave old `chat-with-cv` function in place for one release (not deleted) but no longer called.
- No DB migration needed — `cv_conversations.messages` JSON already stores arbitrary shapes; we'll persist AI SDK `UIMessage[]` directly there going forward.

## Files touched

- **new** `supabase/functions/cv-chat-stream/index.ts`
- **new** `supabase/functions/_shared/ai-gateway.ts` (Lovable provider helper, if not present)
- **rewritten** `src/components/cv-builder/CVChatPanel.tsx`
- **new** `src/components/ai-elements/*` (installed by CLI)
- `package.json` (new deps)

## Out of scope

- Voice input, image generation, web-search tools.
- Persistent file uploads (attachments are per-turn only).
- Threaded conversations (CV chat stays a single conversation per CV doc — matches current behavior).
