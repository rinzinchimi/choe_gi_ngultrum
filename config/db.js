require('dotenv').config({ quiet: true });
const pgp = require('pg-promise')();

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const databaseHost = String(process.env.DB_HOST || '').trim();

if (process.env.NODE_ENV === 'production' && !databaseUrl && !databaseHost) {
  throw new Error('Database configuration is missing. Set DATABASE_URL or DB_HOST in the production environment.');
}

const db = pgp(databaseUrl
  ? { connectionString: databaseUrl, max: 20 }
  : {
      host: databaseHost || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'choe_gi_ngultrum_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS,
      max: 20
    });

db.$pgp = pgp;

module.exports = db;

