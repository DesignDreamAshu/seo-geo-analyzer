import "dotenv/config";

const bootstrap = async () => {
  try {
    await import("./src/server.js");
  } catch (error) {
    console.error("Failed to start backend server", error);
    process.exit(1);
  }
};

bootstrap();
