const files = [
  "prisma/sql/001_command_lifecycle.sql",
  "prisma/sql/003_edge_ingress_triggers.sql",
  "prisma/sql/004_lifecycle_transition_log.sql",
  "prisma/sql/005_identity_map_extensions.sql",
  "prisma/sql/007_operator_passwords.sql",
  "prisma/sql/008_operator_roles.sql",
  "prisma/sql/009_drop_passkeys.sql",
];
console.log("Apply on Neon (in order):\n");
for (const f of files) {
  console.log(`  npx prisma db execute --file ${f} --schema prisma/schema.prisma`);
}
