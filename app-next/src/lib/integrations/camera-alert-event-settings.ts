import type { PrismaClient } from "@prisma/client";
import {
  catalogueEntriesOfferedToTenant,
  defaultEnabledAlarmIds,
  FATIGUE_EVENT_PRESET_LABELS,
  getCatalogueEntry,
  type FatigueEventPresetId,
} from "@/lib/integrations/fatigue-event-catalogue";
import { getAutonomiseEventPresetFromEnv } from "@/lib/integrations/autonomise-webhook-auth";

export type CameraAlertEventSettingsEntry = {
  vendorAlarmId: string;
  displayName: string;
  tier: string;
  family: string;
  enabled: boolean;
  defaultEnabled: boolean;
};

export type CameraAlertEventSettingsSnapshot = {
  enabledAlarmIds: string[];
  entries: CameraAlertEventSettingsEntry[];
  envPreset: FatigueEventPresetId;
  updatedAt: string | null;
};

const SETTINGS_ID = "default";

function parseEnabledIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((id) => id && getCatalogueEntry(id));
  return [...new Set(ids)];
}

export function defaultEnabledAlarmIdsFromEnv(): string[] {
  return defaultEnabledAlarmIds(getAutonomiseEventPresetFromEnv());
}

export function normalizeEnabledAlarmIds(ids: readonly string[]): string[] {
  const offered = new Set(catalogueEntriesOfferedToTenant().map((e) => e.vendorAlarmId));
  return [...new Set(ids.filter((id) => offered.has(id)))];
}

export function enabledAlarmIdsForPreset(preset: FatigueEventPresetId): string[] {
  if (preset === "custom") return [];
  return normalizeEnabledAlarmIds(defaultEnabledAlarmIds(preset));
}

export function buildEventSettingsSnapshot(enabledAlarmIds: string[]): CameraAlertEventSettingsSnapshot {
  const enabled = new Set(normalizeEnabledAlarmIds(enabledAlarmIds));
  const entries = catalogueEntriesOfferedToTenant().map((entry) => ({
    vendorAlarmId: entry.vendorAlarmId,
    displayName: entry.displayName,
    tier: entry.tier,
    family: entry.family,
    enabled: enabled.has(entry.vendorAlarmId),
    defaultEnabled: entry.defaultEnabled,
  }));
  return {
    enabledAlarmIds: [...enabled],
    entries,
    envPreset: getAutonomiseEventPresetFromEnv(),
    updatedAt: null,
  };
}

export async function ensureCameraAlertEventSettingsRow(prisma: PrismaClient): Promise<void> {
  const defaults = defaultEnabledAlarmIdsFromEnv();
  await prisma.cameraAlertEventSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      enabledAlarmIds: defaults,
    },
    update: {},
  });
}

export async function getCameraAlertEventSettings(
  prisma: PrismaClient
): Promise<CameraAlertEventSettingsSnapshot> {
  await ensureCameraAlertEventSettingsRow(prisma);
  const row = await prisma.cameraAlertEventSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  const parsed = parseEnabledIds(row?.enabledAlarmIds);
  const enabledAlarmIds = parsed?.length ? parsed : defaultEnabledAlarmIdsFromEnv();
  const snapshot = buildEventSettingsSnapshot(enabledAlarmIds);
  return {
    ...snapshot,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export async function getEnabledAlarmIdSet(prisma: PrismaClient): Promise<Set<string>> {
  const row = await prisma.cameraAlertEventSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row) {
    await ensureCameraAlertEventSettingsRow(prisma);
    return new Set((await getCameraAlertEventSettings(prisma)).enabledAlarmIds);
  }
  const parsed = parseEnabledIds(row.enabledAlarmIds);
  const enabledAlarmIds = parsed?.length ? parsed : defaultEnabledAlarmIdsFromEnv();
  return new Set(enabledAlarmIds);
}

export async function saveCameraAlertEventSettings(
  prisma: PrismaClient,
  args: {
    enabledAlarmIds: string[];
    updatedByUserId: string;
  }
): Promise<CameraAlertEventSettingsSnapshot> {
  const normalized = normalizeEnabledAlarmIds(args.enabledAlarmIds);
  const row = await prisma.cameraAlertEventSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      enabledAlarmIds: normalized,
      updatedByUserId: args.updatedByUserId,
    },
    update: {
      enabledAlarmIds: normalized,
      updatedByUserId: args.updatedByUserId,
    },
  });
  return {
    ...buildEventSettingsSnapshot(normalized),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function presetLabel(preset: FatigueEventPresetId): string {
  return FATIGUE_EVENT_PRESET_LABELS[preset];
}

export function isValidEnabledAlarmPayload(body: unknown): body is { enabledAlarmIds: string[] } {
  if (!body || typeof body !== "object") return false;
  const ids = (body as { enabledAlarmIds?: unknown }).enabledAlarmIds;
  return Array.isArray(ids) && ids.every((id) => typeof id === "string");
}
