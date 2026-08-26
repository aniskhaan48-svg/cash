require("dotenv").config();

const app = require("./app");
const prisma = require("./config/prisma");
const ensureSchema = require("./services/ensureSchema");

const PORT = process.env.PORT || 3001;
let server;

async function start() {
  try {
    await ensureSchema();
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database schema initialization failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);

  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
    return;
  }

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
