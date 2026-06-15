const files = [
  "prisma/sql/001_command_lifecycle.sql",
  "prisma/sql/003_edge_ingress_triggers.sql",
  "prisma/sql/004_lifecycle_transition_log.sql",
  "prisma/sql/005_identity_map_extensions.sql",
];
console.log("Apply on Neon (in order):\n");
for (const f of files) {
  console.log(`  psql "%DATABASE_URL%" -f ${f}`);
}
