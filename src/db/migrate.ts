import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, poolConnection } from './index';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function runMigration() {
  console.log('⏳ Running database migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await poolConnection.end();
  }
}

runMigration();
