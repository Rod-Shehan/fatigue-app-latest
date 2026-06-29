import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    readFileSync(path, "utf8").split("\n").forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    });
  } catch {
    /* */
  }
}

loadEnvFile(".env.local");

const CORE_PLUS_ADAS = [
  "VT3600AI_ALARM_DSM_Fatigue",
  "VT3600AI_ALARM_DSM_Distracted",
  "VT3600AI_ALARM_ADAS_LaneDeparture",
  "VT3600AI_ALARM_ADAS_FollowingDistanceWarning",
  "VT3600AI_ALARM_ADAS_ForwardCollisionWarning",
];

const prisma = new PrismaClient();
const before = await prisma.cameraAlertEventSettings.findUnique({ where: { id: "default" } });
console.log("before", before?.enabledAlarmIds);

await prisma.cameraAlertEventSettings.upsert({
  where: { id: "default" },
  create: { id: "default", enabledAlarmIds: CORE_PLUS_ADAS },
  update: { enabledAlarmIds: CORE_PLUS_ADAS },
});

const after = await prisma.cameraAlertEventSettings.findUnique({ where: { id: "default" } });
console.log("after", after?.enabledAlarmIds);
await prisma.$disconnect();
