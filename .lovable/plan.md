

## Fix: Auto-scroll transcript in LiveInterview

The transcript `ScrollArea` (line 201) never scrolls to show new messages. The fix is simple:

**`src/components/interview/LiveInterview.tsx`**:
- Add a ref to a dummy div at the bottom of the transcript list
- Add a `useEffect` that triggers `scrollIntoView` whenever `live.transcript` changes

This is the same pattern already used in `TextInterview.tsx` (line with `scrollRef`).

### Changes
```tsx
// Add a ref for the bottom of transcript
const transcriptEndRef = useRef<HTMLDivElement>(null);

// Auto-scroll when transcript updates
useEffect(() => {
  transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [live.transcript]);

// Inside the ScrollArea, after the transcript map:
<div ref={transcriptEndRef} />
```

**File modified**: `src/components/interview/LiveInterview.tsx` only.

