SELECT
  (SELECT COUNT(*) FROM "Tenant") AS tenant_count,
  (SELECT COUNT(*) FROM "User" WHERE "tenantId" = 'tenant_default') AS users_default,
  (SELECT COUNT(*) FROM "Driver" WHERE "tenantId" = 'tenant_default') AS drivers_default,
  (SELECT COUNT(*) FROM "FatigueSheet" WHERE "tenantId" = 'tenant_default') AS sheets_default,
  (SELECT COUNT(*) FROM "TruckRego" WHERE "tenantId" = 'tenant_default') AS regos_default,
  (SELECT COUNT(*) FROM "RoutePreset" WHERE "tenantId" = 'tenant_default') AS presets_default;
