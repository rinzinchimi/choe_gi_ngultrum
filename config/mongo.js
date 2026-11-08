const { MongoClient } = require('mongodb');
require('dotenv').config();

let client = null;
let mongoDb = null;

async function connectMongo() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  if (mongoDb) {
    return mongoDb;
  }
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
  const dbName = process.env.MONGO_DB_NAME || 'choe_gi_ngultrum_db';

  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    mongoDb = client.db(dbName);
    console.log(`Connected to MongoDB (${dbName})`);
    return mongoDb;
  } catch (err) {
    console.warn(`MongoDB connection skipped / failed (${err.message}). Using PostgreSQL for questions.`);
    return null;
  }
}

function getMongoDb() {
  return mongoDb;
}

async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    mongoDb = null;
  }
}

module.exports = {
  connectMongo,
  getMongoDb,
  closeMongo
};

