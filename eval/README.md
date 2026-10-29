# Recognition benchmark

`npm run eval` sends each photo in `photos/` to `/api/identify` and checks the
kind (product / generic / not for sale), the brand, and the key words of the
name listed in `cases.json`.

- `EVAL_API=https://scope-api-flax.vercel.app npm run eval` checks the live server.
- The photos are test images made for this benchmark (most generated with
  Higgsfield). None of them are customer photos.
- Add a case whenever a real scan goes wrong (the app logs "Not right?"
  corrections as `scan_corrected`), so the fix stays fixed.
