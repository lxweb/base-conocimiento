import { startApp } from "./app.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const mediaDir = process.env.MEDIA_DIR ?? "/data/media";
const port = Number(process.env.PORT ?? 3000);

const app = await startApp({ databaseUrl, mediaDir });
await app.listen({ port, host: "0.0.0.0" });
