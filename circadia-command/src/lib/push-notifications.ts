import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type PushIncidentPayload = {
  lifecycleId: string;
  vehicleRegistration: string;
  fatigueMetricType: string;
  detectedAt: string;
};

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:command@circadia24.com";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null;
}

function configureWebPush(): boolean {
  const cfg = getVapidConfig();
  if (!cfg) return false;
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  return true;
}

async function claimPushDispatch(lifecycleId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ lifecycle_id: string }>>`
      INSERT INTO push_dispatch_log (lifecycle_id)
      VALUES (${lifecycleId}::uuid)
      ON CONFLICT DO NOTHING
      RETURNING lifecycle_id::text AS lifecycle_id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error("push_dispatch_log claim failed", err);
    return false;
  }
}

export async function dispatchNewIncidentPush(payload: PushIncidentPayload): Promise<void> {
  try {
    if (!configureWebPush()) return;

    const claimed = await claimPushDispatch(payload.lifecycleId);
    if (!claimed) return;

    const subs = await prisma.operatorPushSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subs.length === 0) return;

  const title = `Command · ${payload.fatigueMetricType.replace(/_/g, " ")}`;
  const body = `${payload.vehicleRegistration} · ${new Date(payload.detectedAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Perth",
  })} AWST`;
  const pushBody = JSON.stringify({
    title,
    body,
    url: `/triage?select=${encodeURIComponent(payload.lifecycleId)}`,
    lifecycleId: payload.lifecycleId,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushBody
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.operatorPushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    })
  );
  } catch (err) {
    console.error("dispatchNewIncidentPush failed", err);
  }
}
