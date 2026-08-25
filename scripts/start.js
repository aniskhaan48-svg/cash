const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const publicPort = String(process.env.PORT || "3000");
const backendPort = String(
  process.env.BACKEND_PORT || (publicPort === "3001" ? "3002" : "3001")
);
const backendUrl = process.env.BACKEND_URL || `http://127.0.0.1:${backendPort}`;

function run(name, cwd, env) {
  const child = spawn(npmCommand, ["start"], {
    cwd,
    env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[${name}] exited unexpectedly${signal ? ` (${signal})` : ` with code ${code}`}`
    );
    shutdown(code || 1);
  });

  return child;
}

console.log(`[cashbox] frontend public port: ${publicPort}`);
console.log(`[cashbox] backend internal port: ${backendPort}`);
console.log(`[cashbox] backend URL for frontend proxy: ${backendUrl}`);

if (!process.env.DATABASE_URL) {
  console.warn("[cashbox] WARNING: DATABASE_URL is not set. Database requests will fail until it is added in Railway Variables.");
}

if (!process.env.JWT_SECRET) {
  console.warn("[cashbox] WARNING: JWT_SECRET is not set. Login token signing requires this variable in Railway Variables.");
}

let shuttingDown = false;
let backend;
let frontend;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [frontend, backend]) {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  const timer = setTimeout(() => process.exit(exitCode), 5000);
  timer.unref();

  Promise.all(
    [frontend, backend]
      .filter(Boolean)
      .map(
        (child) =>
          new Promise((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) return resolve();
            child.once("exit", resolve);
          })
      )
  ).finally(() => process.exit(exitCode));
}

backend = run("backend", path.join(root, "backend"), {
  ...process.env,
  PORT: backendPort,
});

frontend = run("frontend", path.join(root, "frontend"), {
  ...process.env,
  PORT: publicPort,
  BACKEND_URL: backendUrl,
});

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
