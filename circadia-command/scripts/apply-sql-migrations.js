import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "prisma/sql/001_command_lifecycle.sql",
  "prisma/sql/003_edge_ingress_triggers.sql",
  "prisma/sql/004_lifecycle_transition_log.sql",
  "prisma/sql/005_identity_map_extensions.sql",
  "prisma/sql/006_operator_passkeys.sql",
  "prisma/sql/007_operator_passwords.sql",
  "prisma/sql/008_operator_roles.sql",
];

for (const f of files) {
  console.log(`Applying ${f}...`);
  execSync(`npx prisma db execute --file ${f} --schema prisma/schema.prisma`, {
    cwd: root,
    stdio: "inherit",
  });
}
console.log("Done.");
