## Goal
Add a back button to the Login page so users can return to the main landing page.

## Changes
1. **`src/pages/Login.tsx`**
   - Import `ArrowRight` (or appropriate back arrow icon) and `Link` from react-router-dom.
   - Add a back button in the top-left corner of the login card (or above it) linking to `/`.
   - Keep existing layout intact.

## Result
Users can easily navigate back to the main page from the login screen.