const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function createTable() {
    console.log('Creating compusoft_tasks table...\n');

    let pool;
    try {
        pool = await sql.connect(dwConfig);
        console.log('✓ Connected to database\n');

        console.log('Executing CREATE TABLE...');
        await pool.request().query(`
            CREATE TABLE compusoft_tasks (
                PK_BITaskID INT PRIMARY KEY,
                FK_BICompanyID INT NULL,
                FK_BIAlternativeID INT NULL,
                ProjectID NVARCHAR(255) NULL,
                ProjectName NVARCHAR(500) NULL,
                DateStart DATETIME2 NULL,
                DateExpiration DATETIME2 NULL,
                TaskSubject NVARCHAR(1000) NULL,
                IsScheduled BIT NULL,
                TaskType INT NULL,
                TaskTypeName NVARCHAR(255) NULL,
                TaskStatus INT NULL,
                WithSales BIT NULL,
                NextSalesMeeting BIT NULL,
                SalespersonLoginName NVARCHAR(255) NULL,
                SalespersonLastname NVARCHAR(255) NULL,
                SalespersonFirstname NVARCHAR(255) NULL,
                DateUpdatedBISynchTasks DATETIME2 NULL,
                DateCreatedBISynchTasks DATETIME2 NULL,
                BIDeletedTasks BIT NULL,
                LoadedAt DATETIME2 DEFAULT GETDATE(),
                UpdatedAt DATETIME2 DEFAULT GETDATE()
            );
        `);
        console.log('✓ Table created successfully\n');

        console.log('Creating indexes...');
        await pool.request().query(`
            CREATE INDEX IX_compusoft_tasks_DateCreated ON compusoft_tasks(DateCreatedBISynchTasks);
        `);
        console.log('✓ Index on DateCreatedBISynchTasks created');

        await pool.request().query(`
            CREATE INDEX IX_compusoft_tasks_DateUpdated ON compusoft_tasks(DateUpdatedBISynchTasks);
        `);
        console.log('✓ Index on DateUpdatedBISynchTasks created\n');

        console.log('✓ All done! Table compusoft_tasks is ready.');

    } catch (error) {
        console.error('✗ Error:', error.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

createTable();
