# LeetCode Session Bridge (Debug Extension)

This Chrome extension is intended to be loaded in developer mode while working on the LeetCode POTD automation project. It lets a logged‑in LeetCode user share the `LEETCODE_SESSION` and `csrftoken` cookies with the local dashboard without copying them manually.

## How it works

1. Load the extension (Chrome → Extensions → Developer mode → “Load unpacked”, pick this `extension/` directory).
2. Keep a normal LeetCode tab open where you’re already signed in.
3. On the POTD dashboard (e.g. `http://localhost:5173`), click “Fetch from extension”. The page posts a message that the content script picks up.
4. The extension’s background service worker reads the required cookies via the Chrome `cookies` API and returns them to the page.
5. The frontend forwards the tokens to the backend via `/api/leetcode/session`.

Only the `LEETCODE_SESSION` and `csrftoken` values are captured. No other browsing data is touched. Remove the extension (or click “Disconnect” in the dashboard) to revoke access.
