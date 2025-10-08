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

async function testSync() {
    console.log('\n========== SYNC TEST (First 100 records) ==========\n');

    let pool;
    try {
        // Fetch first 100 records
        console.log('Fetching 100 records from OData...');
        const authHeader = `Basic ${Buffer.from(`user:D0B7A09BC20076BA59FB9DAF706267EE79082925BD47D0E626857728BBDB1ECB9F4F245859F494FADDEC5D9A5B6EB8532A942AAF63C68292C265AFFD961FF24E`).toString('base64')}`;

        const response = await axios.get(
            `https://winnerbizzwebapibidataaccess.azurewebsites.net/origin/BITasks?$top=100`,
            {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
                timeout: 60000
            }
        );

        const records = response.data.value || [];
        console.log(`Fetched ${records.length} records\n`);

        // Connect to database
        console.log('Connecting to database...');
        pool = await sql.connect(dwConfig);
        console.log('Connected!\n');

        // Prepare statement for MERGE
        const ps = new sql.PreparedStatement(pool);
        ps.input('PK_BITaskID', sql.Int);
        ps.input('FK_BICompanyID', sql.Int);
        ps.input('FK_BIAlternativeID', sql.Int);
        ps.input('ProjectID', sql.NVarChar(255));
        ps.input('ProjectName', sql.NVarChar(500));
        ps.input('DateStart', sql.DateTime2);
        ps.input('DateExpiration', sql.DateTime2);
        ps.input('TaskSubject', sql.NVarChar(1000));
        ps.input('IsScheduled', sql.Bit);
        ps.input('TaskType', sql.Int);
        ps.input('TaskTypeName', sql.NVarChar(255));
        ps.input('TaskStatus', sql.Int);
        ps.input('WithSales', sql.Bit);
        ps.input('NextSalesMeeting', sql.Bit);
        ps.input('SalespersonLoginName', sql.NVarChar(255));
        ps.input('SalespersonLastname', sql.NVarChar(255));
        ps.input('SalespersonFirstname', sql.NVarChar(255));
        ps.input('DateUpdatedBISynchTasks', sql.DateTime2);
        ps.input('DateCreatedBISynchTasks', sql.DateTime2);
        ps.input('BIDeletedTasks', sql.Bit);

        await ps.prepare(`
            MERGE compusoft_tasks AS target
            USING (SELECT @PK_BITaskID AS PK_BITaskID) AS source
            ON target.PK_BITaskID = source.PK_BITaskID
            WHEN MATCHED THEN
                UPDATE SET
                    FK_BICompanyID = ISNULL(@FK_BICompanyID, 0),
                    FK_BIAlternativeID = ISNULL(@FK_BIAlternativeID, 0),
                    ProjectID = @ProjectID,
                    ProjectName = @ProjectName,
                    DateStart = @DateStart,
                    DateExpiration = @DateExpiration,
                    TaskSubject = @TaskSubject,
                    IsScheduled = ISNULL(@IsScheduled, 0),
                    TaskType = ISNULL(@TaskType, 0),
                    TaskTypeName = @TaskTypeName,
                    TaskStatus = ISNULL(@TaskStatus, 0),
                    WithSales = ISNULL(@WithSales, 0),
                    NextSalesMeeting = ISNULL(@NextSalesMeeting, 0),
                    SalespersonLoginName = @SalespersonLoginName,
                    SalespersonLastname = @SalespersonLastname,
                    SalespersonFirstname = @SalespersonFirstname,
                    DateUpdatedBISynchTasks = @DateUpdatedBISynchTasks,
                    DateCreatedBISynchTasks = @DateCreatedBISynchTasks,
                    BIDeletedTasks = ISNULL(@BIDeletedTasks, 0),
                    UpdatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (
                    PK_BITaskID, FK_BICompanyID, FK_BIAlternativeID, ProjectID, ProjectName,
                    DateStart, DateExpiration, TaskSubject, IsScheduled, TaskType,
                    TaskTypeName, TaskStatus, WithSales, NextSalesMeeting,
                    SalespersonLoginName, SalespersonLastname, SalespersonFirstname,
                    DateUpdatedBISynchTasks, DateCreatedBISynchTasks, BIDeletedTasks
                )
                VALUES (
                    @PK_BITaskID,
                    ISNULL(@FK_BICompanyID, 0),
                    ISNULL(@FK_BIAlternativeID, 0),
                    @ProjectID, @ProjectName, @DateStart, @DateExpiration,
                    @TaskSubject,
                    ISNULL(@IsScheduled, 0),
                    ISNULL(@TaskType, 0),
                    @TaskTypeName,
                    ISNULL(@TaskStatus, 0),
                    ISNULL(@WithSales, 0),
                    ISNULL(@NextSalesMeeting, 0),
                    @SalespersonLoginName, @SalespersonLastname, @SalespersonFirstname,
                    @DateUpdatedBISynchTasks, @DateCreatedBISynchTasks,
                    ISNULL(@BIDeletedTasks, 0)
                );
        `);

        console.log('Processing records...');
        let inserted = 0;
        let updated = 0;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];

            await ps.execute({
                PK_BITaskID: r.PK_BITaskID,
                FK_BICompanyID: r.FK_BICompanyID,
                FK_BIAlternativeID: r.FK_BIAlternativeID,
                ProjectID: r.ProjectID,
                ProjectName: r.ProjectName,
                DateStart: r.DateStart,
                DateExpiration: r.DateExpiration,
                TaskSubject: r.TaskSubject,
                IsScheduled: r.IsScheduled,
                TaskType: r.TaskType,
                TaskTypeName: r.TaskTypeName,
                TaskStatus: r.TaskStatus,
                WithSales: r.WithSales,
                NextSalesMeeting: r.NextSalesMeeting,
                SalespersonLoginName: r.SalespersonLoginName,
                SalespersonLastname: r.SalespersonLastname,
                SalespersonFirstname: r.SalespersonFirstname,
                DateUpdatedBISynchTasks: r.DateUpdatedBISynchTasks,
                DateCreatedBISynchTasks: r.DateCreatedBISynchTasks,
                BIDeletedTasks: r.BIDeletedTasks
            });

            // We can't easily track INSERT vs UPDATE with prepared statements,
            // so just count processed
            if ((i + 1) % 10 === 0) {
                console.log(`Progress: ${i + 1}/${records.length}`);
            }
        }

        await ps.unprepare();

        console.log(`\n✓ Processed ${records.length} records!\n`);

        // Verify count
        const countResult = await pool.request().query('SELECT COUNT(*) as total FROM compusoft_tasks');
        console.log(`SQL Total: ${countResult.recordset[0].total}\n`);

        console.log('✓ SUCCESS!\n');

    } catch (error) {
        console.error('ERROR:', error.message);
        console.error(error.stack);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

testSync();
