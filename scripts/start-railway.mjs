import { execSync } from "node:child_process";

function run(command) {
  execSync(command, {
    stdio: "inherit",
    shell: true,
  });
}

try {
  console.log("Running DB push...");
  run("pnpm run db:push");
  console.log("DB push completed");
  run("pnpm --filter @workspace/api-server run start");
} catch (error) {
  console.error("Railway startup failed.");
  process.exit(error?.status ?? 1);
}
