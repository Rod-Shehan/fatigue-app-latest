/**
 * Verify a deployed frms-engine on Railway (or any host).
 *
 * Usage:
 *   FRMS_TEST_URL=https://xxx.up.railway.app FRMS_TEST_KEY=your-key node scripts/verify-railway-frms.mjs
 */

const base = (process.env.FRMS_TEST_URL ?? "").replace(/\/$/, "");
const key = process.env.FRMS_TEST_KEY ?? "";

if (!base) {
  console.error("Set FRMS_TEST_URL (e.g. https://xxx.up.railway.app)");
  process.exit(1);
}

async function main() {
  console.log(`Testing ${base}\n`);

  const healthRes = await fetch(`${base}/health`);
  const healthText = await healthRes.text();
  console.log(`GET /health → ${healthRes.status}`);
  console.log(healthText);

  if (!healthRes.ok) {
    console.error("\nFAIL: /health must return 200. Check Root Directory = frms-engine and redeploy.");
    process.exit(1);
  }

  let authConfigured;
  try {
    const health = JSON.parse(healthText);
    authConfigured = health.auth_configured;
    if (authConfigured === false) {
      console.error("\nFAIL: Railway FRMS_PYTHON_API_KEY is not set. Add it under Variables and redeploy.");
      process.exit(1);
    }
  } catch {
    /* older engine without auth_configured — fall through to POST test */
  }

  if (!key) {
    console.warn("\nSKIP: FRMS_TEST_KEY not set — skipping POST /v1/risk-profile");
    process.exit(0);
  }

  const body = {
    driver_name: "smoke-test",
    jurisdiction_code: "wa",
    driver_type: "solo",
    as_of_ms: 1_700_000_000_000,
    horizon_from_ms: 1_700_000_000_000,
    horizon_to_ms: 1_700_003_600_000,
    week_starting: "2026-05-31",
    timeline_blocks: [{ start_ms: 1_700_000_000_000, is_work: true, is_rest: false }],
  };

  const profileRes = await fetch(`${base}/v1/risk-profile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const profileText = await profileRes.text();
  console.log(`\nPOST /v1/risk-profile → ${profileRes.status}`);
  console.log(profileText.slice(0, 500));

  if (profileRes.status === 503) {
    console.error("\nFAIL: Set FRMS_PYTHON_API_KEY on Railway and redeploy.");
    process.exit(1);
  }
  if (profileRes.status === 401) {
    console.error("\nFAIL: FRMS_TEST_KEY does not match Railway FRMS_PYTHON_API_KEY.");
    process.exit(1);
  }
  if (!profileRes.ok) {
    console.error("\nFAIL: unexpected response from risk-profile.");
    process.exit(1);
  }

  console.log("\nOK: Railway FRMS engine is reachable and authenticated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
