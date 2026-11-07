
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../utils/.env.aiven')
});

async function importSchema() {
  let connection;

  try {
    const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
    const caPath = path.resolve(__dirname, '../certs/ca.pem');

    const schema = fs.readFileSync(schemaPath, 'utf8');
    const ca = fs.readFileSync(caPath, 'utf8');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        ca,
        rejectUnauthorized: true
      },
      multipleStatements: true
    });

    console.log('Connected to Aiven MySQL.');

    await connection.query(schema);

    console.log('SUCCESS: Database schema imported!');
  } catch (error) {
    console.error('Schema import failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

importSchema();
