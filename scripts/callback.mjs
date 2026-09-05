import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist/callback", { recursive: true });
await copyFile("dist/index.html", "dist/callback/index.html");
