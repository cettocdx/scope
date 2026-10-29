import { config } from "dotenv";

// Imported first by index.ts. The project's .env wins over keys exported in the
// shell (e.g. ~/.zshrc), so the keys in .env are the ones the server uses.
config({ override: true });
