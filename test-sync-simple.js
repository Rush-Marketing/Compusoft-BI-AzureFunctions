const axios = require('axios');
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

const odataConfig = {
    baseUrl: 'https://winnerbizzwebapibidataaccess.azurewebsites.net/origin',
    username: 'user',
    password: 'D0B7A09BC20076BA59FB9DAF706267EE79082925BD47D0E626857728BBDB1ECB9F4F245859F494FADDEC5D9A5B6EB8532A942AAF63C68292C265AFFD961FF24E',
    endpoint: 'BITasks'
};

async function testFullLoad() {
    console.log('\n========== FULL LOAD TEST ==========\n');

    let pool;
    try {
        // Fetch first 5000 records (for testing)
        console.log('Fetching 5000 records from OData...');
        const authHeader = `Basic ${Buffer.from(`${odataConfig.username}:${odataConfig.password}`).toString('base64')}`;

        const response = await axios.get(
            `${odataConfig.baseUrl}/${odataConfig.endpoint}?$top=5000`,
            {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
                timeout: 120000
            }
        );

        const records = response.data.value || [];
        console.log(`Fetched ${records.length} records\n`);

        // Connect to database
        console.log('Connecting to database...');
        pool = await sql.connect(dwConfig);
        console.log('Connected!\n');

        // Truncate table
        console.log('Truncating table...');
        await pool.request().query('TRUNCATE TABLE compusoft_tasks');
        console.log('Table truncated\n');

        // Insert in batches
        console.log('Inserting records in batches of 100...');
        const batchSize = 100;
        let totalInserted = 0;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            const safe = (val) => {
                if (!val || typeof val !== 'string') return 'NULL';
                // Escape single quotes and handle SQL injection
                const escaped = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
                return `N'${escaped}'`;
            };
            const safeNum = (val) => val !== null && val !== undefined ? val : 0;  // Use 0 for NULL foreign keys

            const values = batch.map(r => `(
                ${r.PK_BITaskID},
                ${safeNum(r.FK_BICompanyID)},
                ${safeNum(r.FK_BIAlternativeID)},
                ${safe(r.ProjectID)},
                ${safe(r.ProjectName)},
                ${r.DateStart ? `'${r.DateStart}'` : 'NULL'},
                ${r.DateExpiration ? `'${r.DateExpiration}'` : 'NULL'},
                ${safe(r.TaskSubject)},
                ${r.IsScheduled ? 1 : 0},
                ${safeNum(r.TaskType)},
                ${safe(r.TaskTypeName)},
                ${safeNum(r.TaskStatus)},
                ${r.WithSales ? 1 : 0},
                ${r.NextSalesMeeting ? 1 : 0},
                ${safe(r.SalespersonLoginName)},
                ${safe(r.SalespersonLastname)},
                ${safe(r.SalespersonFirstname)},
                ${r.DateUpdatedBISynchTasks ? `'${r.DateUpdatedBISynchTasks}'` : 'NULL'},
                ${r.DateCreatedBISynchTasks ? `'${r.DateCreatedBISynchTasks}'` : 'NULL'},
                ${r.BIDeletedTasks ? 1 : 0}
            )`).join(',\n');

            const insertQuery = `
                INSERT INTO compusoft_tasks (
                    PK_BITaskID, FK_BICompanyID, FK_BIAlternativeID, ProjectID, ProjectName,
                    DateStart, DateExpiration, TaskSubject, IsScheduled, TaskType,
                    TaskTypeName, TaskStatus, WithSales, NextSalesMeeting,
                    SalespersonLoginName, SalespersonLastname, SalespersonFirstname,
                    DateUpdatedBISynchTasks, DateCreatedBISynchTasks, BIDeletedTasks
                )
                VALUES ${values};
            `;

            await pool.request().query(insertQuery);
            totalInserted += batch.length;
            console.log(`Progress: ${totalInserted}/${records.length}`);
        }

        console.log(`\n✓ Inserted ${totalInserted} records successfully!\n`);

        // Verify count
        const countResult = await pool.request().query('SELECT COUNT(*) as total FROM compusoft_tasks');
        console.log(`SQL Total: ${countResult.recordset[0].total}\n`);

        // Log to logging database
        const loggingPool = await sql.connect(loggingConfig);
        await loggingPool.request()
            .input('source', sql.NVarChar, 'Test Script')
            .input('operation', sql.NVarChar, 'Full Load Test')
            .input('function_name', sql.NVarChar, 'test-sync-simple')
            .input('status', sql.NVarChar, 'SUCCESS')
            .input('duration_seconds', sql.Int, 0)
            .input('records_processed', sql.Int, totalInserted)
            .input('error_message', sql.NVarChar, null)
            .input('metadata', sql.NVarChar, JSON.stringify({ test: true }))
            .input('notes', sql.NVarChar, 'Simple full load test')
            .query(`
                INSERT INTO azure_functions_log (
                    source, operation, function_name, status, duration_seconds,
                    records_processed, error_message, metadata, notes
                )
                VALUES (
                    @source, @operation, @function_name, @status, @duration_seconds,
                    @records_processed, @error_message, @metadata, @notes
                )
            `);
        await loggingPool.close();
        console.log('✓ Logged to azure_functions_log\n');

    } catch (error) {
        console.error('ERROR:', error.message);
        console.error(error.stack);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

testFullLoad();
