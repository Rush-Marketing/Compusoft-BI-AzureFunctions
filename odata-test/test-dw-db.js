const sql = require('mssql');

const dwConfig = {
    server: 'sql-datawarehouse-stg01.database.windows.net',
    database: 'sqldb-datawarehouse-stg',
    user: 'dwh01',
    password: 'HipALeV2AYEd^Wx3',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function testDWConnection() {
    console.log('Testing connection to data warehouse database...\n');

    let pool;
    try {
        // Connect
        console.log('Connecting to sql-datawarehouse-stg01.database.windows.net...');
        pool = await sql.connect(dwConfig);
        console.log('✓ Connected successfully\n');

        // Check if table exists
        console.log('Checking if compusoft_tasks table exists...');
        const tableCheck = await pool.request().query(`
            SELECT COUNT(*) as tableExists
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'compusoft_tasks'
        `);

        if (tableCheck.recordset[0].tableExists === 1) {
            console.log('✓ Table compusoft_tasks exists\n');

            // Get table structure
            console.log('Table structure:');
            const columns = await pool.request().query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'compusoft_tasks'
                ORDER BY ORDINAL_POSITION
            `);
            console.table(columns.recordset);

            // Get record count
            const countResult = await pool.request().query(`
                SELECT COUNT(*) as total FROM compusoft_tasks
            `);
            console.log(`\nTotal records in table: ${countResult.recordset[0].total}`);

            // Get latest records
            const latestResult = await pool.request().query(`
                SELECT TOP 5
                    PK_BITaskID, TaskSubject, DateCreatedBISynchTasks, DateUpdatedBISynchTasks
                FROM compusoft_tasks
                ORDER BY PK_BITaskID DESC
            `);

            if (latestResult.recordset.length > 0) {
                console.log('\nLatest 5 records:');
                console.table(latestResult.recordset);
            }

        } else {
            console.log('✗ Table compusoft_tasks does NOT exist');
            console.log('\nYou need to create it. Run the SQL script:');
            console.log('sql/create_compusoft_tasks_table.sql');
            console.log('\nOr I can create it now? (modify this script to execute the CREATE TABLE)');
        }

    } catch (error) {
        console.error('✗ Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
    } finally {
        if (pool) {
            await pool.close();
            console.log('\nConnection closed');
        }
    }
}

testDWConnection();
