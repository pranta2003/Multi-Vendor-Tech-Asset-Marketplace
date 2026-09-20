import dotenv from 'dotenv';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { seedMarketplaceData } from '../src/modules/catalog/seed.data';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('[INFO] DATABASE_URL is not set in the current environment.');
    console.log('To seed against your database, run:');
    console.log('  $env:DATABASE_URL="your-connection-string"; npm run seed:marketplace');
    process.exit(0);
  }

  console.log('--- Starting safe marketplace demo data seeding ---');
  const count = await seedMarketplaceData(prisma);
  console.log(`--- Marketplace demo seeding complete. ${count} items verified safely. ---`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
