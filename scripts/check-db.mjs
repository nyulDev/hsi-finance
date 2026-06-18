import { PrismaClient } from '../src/generated/prisma/index.js';
const p = new PrismaClient();
try {
  // Check enum values for status column
  const statusVals = await p.$queryRaw`
    SELECT DISTINCT status FROM mutasi_records LIMIT 20
  `;
  console.log('Status values in DB:', statusVals.map(r => r.status));

  const count = await p.$queryRaw`SELECT COUNT(*) as cnt FROM mutasi_records`;
  console.log('Total mutasi_records:', count[0].cnt);

  const investors = await p.$queryRaw`SELECT COUNT(*) as cnt FROM investors`;
  console.log('Total investors:', investors[0].cnt);

  const sample = await p.$queryRaw`SELECT id, kode, nama, status FROM mutasi_records LIMIT 3`;
  console.log('Sample records:', JSON.stringify(sample, null, 2));
} catch(e) {
  console.error('ERROR:', e.message);
} finally {
  await p.$disconnect();
}
