import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Sets Neon RLS session claims for command_operator global access. */
export async function withOperatorContext<T>(
  operatorId: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('request.jwt.claim.role', 'command_operator', true),
             set_config('request.jwt.claim.sub', ${operatorId}, true)
    `;
    return fn(tx);
  });
}

/** Service path for edge ingest / triggers — bypasses operator RLS via table owner role. */
export async function withServiceContext<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export type { TxClient };
