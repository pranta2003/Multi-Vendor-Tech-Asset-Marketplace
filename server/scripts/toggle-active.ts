import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const active = process.argv[2] === 'true';
  const u = await p.user.update({ where: { email: 'buyer2@test.com' }, data: { isActive: active } });
  console.log(`  buyer2@test.com isActive = ${u.isActive}`);
  await p.$disconnect();
})();
