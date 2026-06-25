import type { PrismaClient } from "@prisma/client";
import { AUTONOMISE_BLOCK_UPLOAD_ID_PREFIX } from "@/lib/integrations/autonomise-block-bridge-config";

export type PurgeAutonomiseBridgeResult = {
  deletedRiskBlocks: number;
  deletedAttributions: number;
};

/**
 * Remove all autonomise-sourced assurance blocks and attribution rows.
 * Live alert ingest rows are untouched — only metrics bridge data is removed.
 */
export async function purgeAutonomiseBridgeData(prisma: PrismaClient): Promise<PurgeAutonomiseBridgeResult> {
  const deletedAttributions = await prisma.autonomiseMetricsAttribution.deleteMany({});

  const deletedRiskBlocks = await prisma.driverRiskBlock.deleteMany({
    where: {
      OR: [
        { fusionSources: { has: "autonomise" } },
        { uploadId: { startsWith: AUTONOMISE_BLOCK_UPLOAD_ID_PREFIX } },
      ],
    },
  });

  return {
    deletedRiskBlocks: deletedRiskBlocks.count,
    deletedAttributions: deletedAttributions.count,
  };
}
