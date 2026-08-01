const { spawnSync } = require("node:child_process");

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = (payload.tool_input && payload.tool_input.file_path) || "";
  const normalized = filePath.replace(/\\/g, "/");
  const touchesSrcOrTests = /(^|\/)(src|tests)\//.test(normalized);
  if (!touchesSrcOrTests) {
    process.exit(0);
  }

  const typecheck = spawnSync("npm", ["run", "typecheck"], { stdio: "inherit", shell: true });
  if (typecheck.status !== 0) {
    process.exit(typecheck.status ?? 1);
  }

  const test = spawnSync("npm", ["test"], { stdio: "inherit", shell: true });
  process.exit(test.status ?? 1);
});
