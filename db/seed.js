const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function seed() {
  try {
    const sqlPath = path.join(__dirname, 'seed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running seed from ${sqlPath}...`);
    await db.none(sql);
    console.log('Database seeded successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  seed().then(() => {
    if (db.$pgp) db.$pgp.end();
  });
}

module.exports = seed;

