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

async function checkNulls() {
    const pool = await sql.connect(dwConfig);

    // Get a record with NULLs
    const result = await pool.request().query(`
        SELECT TOP 5
            PK_BITaskID,
            FK_BICompanyID,
            FK_BIAlternativeID,
            TaskType,
            TaskStatus,
            TaskSubject
        FROM compusoft_tasks
        WHERE FK_BICompanyID = 0 OR FK_BICompanyID IS NULL
        ORDER BY PK_BITaskID DESC
    `);

    console.log('\nRecords with NULL or 0 values:\n');
    console.table(result.recordset);

    await pool.close();
}

checkNulls().catch(console.error);
