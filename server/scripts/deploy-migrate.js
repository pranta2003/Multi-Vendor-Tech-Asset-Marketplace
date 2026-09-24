const { execSync } = require('child_process');

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
  console.log('DATABASE_URL detected; running prisma migrate deploy...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Prisma migration deployment completed successfully.');
  } catch (err) {
    console.error('Warning: prisma migrate deploy encountered an error:', err.message);
  }
} else {
  console.log('No DATABASE_URL detected in environment; skipping prisma migrate deploy.');
}
