import type { IncomingMessage, ServerResponse } from "node:http";

import { createApp } from "./app";

/**
 * Vercel serverless entry: every /api request is handed to the same Express
 * app the local server runs. The app is built once per warm instance.
 */
const ready = createApp().then(({ app }) => app);

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await ready;
  app(req as never, res as never);
}
