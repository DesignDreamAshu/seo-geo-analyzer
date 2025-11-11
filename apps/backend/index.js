import "tsx/esm";

const entry = new URL("./src/index.ts", import.meta.url);

import(entry).catch((error) => {
  console.error("Failed to start backend via tsx runtime.", error);
  process.exit(1);
});
