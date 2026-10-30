import "./env";
import { createApp } from "./app";

createApp().then(({ server }) => {
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: process.platform === "linux",
    },
    () => {
      console.log(`express server serving on port ${port}`);
    },
  );
});
