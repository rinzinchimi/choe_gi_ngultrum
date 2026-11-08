const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function migrate() {
  try {
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running migration from ${sqlPath}...`);
    await db.none(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  migrate().then(() => {
    if (db.$pgp) db.$pgp.end();
  });
}

module.exports = migrate;

