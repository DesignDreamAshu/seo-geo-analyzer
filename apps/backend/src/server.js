import "tsx/esm";

const entry = new URL("./index.ts", import.meta.url);

const bootstrap = async () => {
  try {
    await import(entry.href);
  } catch (error) {
    console.error("Failed to start backend via legacy server.js entry.", error);
    process.exit(1);
  }
};

bootstrap();
