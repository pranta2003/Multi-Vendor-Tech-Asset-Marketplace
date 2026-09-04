import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/prisma';

const main = async (): Promise<void> => {
  const p = await prisma.product.findFirstOrThrow({ where: { slug: 'scarce-admin-kit' } });
  await prisma.product.update({ where: { id: p.id }, data: { stock: 5 } });

  const attempt = (label: string) =>
    prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id, stock FROM products WHERE id = ${p.id}::uuid`);
        await new Promise((r) => setTimeout(r, 120));
        await tx.$executeRaw`UPDATE products SET stock = stock - 1 WHERE id = ${p.id}::uuid`;
        return label;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );

  const results = await Promise.allSettled([attempt('A'), attempt('B'), attempt('C')]);
  for (const r of results) {
    if (r.status === 'rejected') {
      const e = r.reason;
      console.log('--- rejection ---');
      console.log('constructor      :', e?.constructor?.name);
      console.log('is KnownRequest  :', e instanceof Prisma.PrismaClientKnownRequestError);
      console.log('is UnknownRequest:', e instanceof Prisma.PrismaClientUnknownRequestError);
      console.log('.code            :', (e as { code?: string }).code);
      console.log('msg has 40001    :', String(e?.message).includes('40001'));
      console.log('msg has serialize:', String(e?.message).includes('could not serialize'));
    }
  }
};
main().catch(console.error).finally(() => prisma.$disconnect());
