// بيانات أولية — شغّلها بـ: node prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.account.createMany({ data: [
    {"email":"demo@jaola.io","name":"حساب تجريبي","plan":"pro"}
  ] });
  console.log('✅ Seed complete');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
