const sql = require('mssql');

// Je moet deze credentials invullen
const loggingConfig = {
    server: 'rm-logging.database.windows.net',
    database: 'rm-logging-db',
    user: 'dwh01',
    password: 'HipALeV2AYEd^Wx3',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function testLoggingConnection() {
    console.log('Testing connection to logging database...\n');

    let pool;
    try {
        // Connect
        console.log('Connecting to rm-logging.database.windows.net...');
        pool = await sql.connect(loggingConfig);
        console.log('✓ Connected successfully\n');

        // Check if table exists
        console.log('Checking if azure_functions_log table exists...');
        const tableCheck = await pool.request().query(`
            SELECT COUNT(*) as tableExists
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'azure_functions_log'
        `);

        if (tableCheck.recordset[0].tableExists === 1) {
            console.log('✓ Table azure_functions_log exists\n');

            // Get table structure
            console.log('Table structure:');
            const columns = await pool.request().query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'azure_functions_log'
                ORDER BY ORDINAL_POSITION
            `);
            console.table(columns.recordset);

            // Get record count
            const countResult = await pool.request().query(`
                SELECT COUNT(*) as total FROM azure_functions_log
            `);
            console.log(`\nTotal records in table: ${countResult.recordset[0].total}`);

            // Get latest records
            const latestResult = await pool.request().query(`
                SELECT TOP 5
                    LogID, FunctionName, ExecutionTime, Status, RecordsProcessed
                FROM azure_functions_log
                ORDER BY ExecutionTime DESC
            `);

            if (latestResult.recordset.length > 0) {
                console.log('\nLatest 5 log entries:');
                console.table(latestResult.recordset);
            } else {
                console.log('\nNo records found in table yet');
            }

            // Test insert
            console.log('\nTesting INSERT...');
            await pool.request()
                .input('FunctionName', sql.NVarChar, 'TEST_CONNECTION')
                .input('Status', sql.NVarChar, 'SUCCESS')
                .input('RecordsProcessed', sql.Int, 0)
                .input('AdditionalInfo', sql.NVarChar, 'Connection test from local machine')
                .query(`
                    INSERT INTO azure_functions_log (
                        FunctionName, Status, RecordsProcessed, AdditionalInfo
                    )
                    VALUES (
                        @FunctionName, @Status, @RecordsProcessed, @AdditionalInfo
                    )
                `);
            console.log('✓ Test log entry inserted successfully');

        } else {
            console.log('✗ Table azure_functions_log does NOT exist');
            console.log('You may need to create it first using sql/create_logging_table.sql');
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

testLoggingConnection();
