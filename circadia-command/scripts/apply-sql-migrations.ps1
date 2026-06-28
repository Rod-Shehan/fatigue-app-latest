# Apply Circadia Command SQL to Neon (safe on shared DB — additive only).
# Do NOT run `prisma db push` against the shared customer Neon instance.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot + "\.."

if (-not (Test-Path ".env")) {
  Write-Error "Missing .env — copy .env.example and set DATABASE_URL"
}

$files = @(
  "prisma/sql/001_command_lifecycle.sql",
  "prisma/sql/003_edge_ingress_triggers.sql",
  "prisma/sql/004_lifecycle_transition_log.sql",
  "prisma/sql/005_identity_map_extensions.sql",
  "prisma/sql/007_operator_passwords.sql",
  "prisma/sql/008_operator_roles.sql",
  "prisma/sql/009_drop_passkeys.sql"
)

foreach ($f in $files) {
  Write-Host "Applying $f ..."
  npx prisma db execute --file $f --schema prisma/schema.prisma
}

Write-Host "Done."
