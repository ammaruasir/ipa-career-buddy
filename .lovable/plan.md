

## Plan: GCC Male Face Avatar with Traditional Dress

### Approach

Replace the heavy 3D Ready Player Me model with an **AI-generated 2D avatar** of a GCC male face wearing traditional national dress (thobe + ghutra/shemagh). The avatar will be rendered as an image with CSS-based animations for speaking, listening, and idle states — much lighter and visually cleaner than the current 3D canvas.

### Changes

**1. Create a backend function to generate the avatar image**
- New Edge Function `generate-avatar` that uses the Lovable AI image generation API (`google/gemini-2.5-flash-image`) to create a professional portrait of a GCC male with traditional dress (white thobe, ghutra, agal).
- Save the generated image to Supabase Storage so it's reused across sessions (generate once, serve forever).

**2. Replace `AIAvatarScene.tsx`**
- Remove the Three.js `Canvas`, `Environment`, and `AvatarHead` 3D components.
- Replace with a styled `<img>` component showing the generated avatar face.
- Add CSS animations:
  - **Speaking**: Subtle pulse ring + animated sound wave bars around the avatar.
  - **Listening**: Soft glow border.
  - **Idle**: Gentle breathing scale animation.

**3. Clean up `AvatarHead.tsx`**
- Remove the file entirely — no longer needed without the 3D scene.
- Remove the `public/models/avatar.glb` file (saves ~5MB+ of download).

**4. Update `VapiLiveInterview.tsx`**
- Remove `audioAnalyser` prop passing since the 2D avatar doesn't need it.
- Simplify the avatar container sizing.

### Result
- Fast loading (small image vs large GLB model)
- Professional GCC male appearance with traditional dress
- Smooth animated states for speaking/listening/idle
- No Three.js overhead

