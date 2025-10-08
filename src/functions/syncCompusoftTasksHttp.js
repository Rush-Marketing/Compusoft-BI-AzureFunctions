const { app } = require('@azure/functions');
const axios = require('axios');
const sql = require('mssql');

// Database configurations
const dwConfig = {
    server: process.env.DW_SQL_SERVER || 'sql-datawarehouse-stg01.database.windows.net',
    database: process.env.DW_SQL_DATABASE || 'sqldb-datawarehouse-stg',
    user: process.env.DW_SQL_USER,
    password: process.env.DW_SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const loggingConfig = {
    server: process.env.LOGGING_SQL_SERVER || 'rm-logging.database.windows.net',
    database: process.env.LOGGING_SQL_DATABASE || 'rm-logging-db',
    user: process.env.LOGGING_SQL_USER,
    password: process.env.LOGGING_SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// OData configuration
const odataConfig = {
    baseUrl: 'https://winnerbizzwebapibidataaccess.azurewebsites.net/origin',
    username: process.env.ODATA_USERNAME || 'user',
    password: process.env.ODATA_PASSWORD,
    endpoint: 'BITasks'
};

/**
 * Fetches incremental data from OData API
 */
async function fetchIncrementalData(context, sinceDate) {
    const authHeader = `Basic ${Buffer.from(`${odataConfig.username}:${odataConfig.password}`).toString('base64')}`;
    let allRecords = [];
    let skip = 0;
    const top = 1000; // Batch size

    // Build filter for incremental load
    const dateFilter = sinceDate
        ? `DateCreatedBISynchTasks ge ${sinceDate.toISOString()} or DateUpdatedBISynchTasks ge ${sinceDate.toISOString()}`
        : null;

    context.log(`Fetching data with filter: ${dateFilter || 'FULL LOAD'}`);

    while (true) {
        try {
            let url = `${odataConfig.baseUrl}/${odataConfig.endpoint}?$count=true&$top=${top}&$skip=${skip}`;
            if (dateFilter) {
                url += `&$filter=${encodeURIComponent(dateFilter)}`;
            }

            const response = await axios.get(url, {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
                timeout: 60000
            });

            const data = response.data.value || [];
            const totalCount = response.data['@odata.count'];

            if (skip === 0) {
                context.log(`Total records to fetch: ${totalCount}`);
            }

            allRecords = allRecords.concat(data);
            context.log(`Fetched ${allRecords.length} of ${totalCount} records`);

            if (data.length < top) {
                break; // No more records
            }

            skip += top;
        } catch (error) {
            context.error(`Error fetching OData: ${error.message}`);
            throw error;
        }
    }

    return allRecords;
}

/**
 * Gets total count from OData without fetching all data
 */
async function getODataTotalCount(context) {
    const authHeader = `Basic ${Buffer.from(`${odataConfig.username}:${odataConfig.password}`).toString('base64')}`;

    try {
        const url = `${odataConfig.baseUrl}/${odataConfig.endpoint}?$count=true&$top=0`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
            },
            timeout: 30000
        });

        return response.data['@odata.count'];
    } catch (error) {
        context.error(`Error getting OData count: ${error.message}`);
        return null;
    }
}

/**
 * Upserts records into SQL Server using MERGE
 */
async function upsertRecords(context, pool, records) {
    let inserted = 0;
    let updated = 0;

    const transaction = pool.transaction();
    await transaction.begin();

    try {
        for (const record of records) {
            const result = await transaction.request()
                .input('PK_BITaskID', sql.Int, record.PK_BITaskID)
                .input('FK_BICompanyID', sql.Int, record.FK_BICompanyID ?? null)
                .input('FK_BIAlternativeID', sql.Int, record.FK_BIAlternativeID ?? null)
                .input('ProjectID', sql.NVarChar, record.ProjectID ?? null)
                .input('ProjectName', sql.NVarChar, record.ProjectName ?? null)
                .input('DateStart', sql.DateTime2, record.DateStart ?? null)
                .input('DateExpiration', sql.DateTime2, record.DateExpiration ?? null)
                .input('TaskSubject', sql.NVarChar, record.TaskSubject ?? null)
                .input('IsScheduled', sql.Bit, record.IsScheduled ?? null)
                .input('TaskType', sql.Int, record.TaskType ?? null)
                .input('TaskTypeName', sql.NVarChar, record.TaskTypeName ?? null)
                .input('TaskStatus', sql.Int, record.TaskStatus ?? null)
                .input('WithSales', sql.Bit, record.WithSales ?? null)
                .input('NextSalesMeeting', sql.Bit, record.NextSalesMeeting ?? null)
                .input('SalespersonLoginName', sql.NVarChar, record.SalespersonLoginName ?? null)
                .input('SalespersonLastname', sql.NVarChar, record.SalespersonLastname ?? null)
                .input('SalespersonFirstname', sql.NVarChar, record.SalespersonFirstname ?? null)
                .input('DateUpdatedBISynchTasks', sql.DateTime2, record.DateUpdatedBISynchTasks ?? null)
                .input('DateCreatedBISynchTasks', sql.DateTime2, record.DateCreatedBISynchTasks ?? null)
                .input('BIDeletedTasks', sql.Bit, record.BIDeletedTasks ?? null)
                .query(`
                    MERGE compusoft_tasks AS target
                    USING (SELECT @PK_BITaskID AS PK_BITaskID) AS source
                    ON target.PK_BITaskID = source.PK_BITaskID
                    WHEN MATCHED THEN
                        UPDATE SET
                            FK_BICompanyID = @FK_BICompanyID,
                            FK_BIAlternativeID = @FK_BIAlternativeID,
                            ProjectID = @ProjectID,
                            ProjectName = @ProjectName,
                            DateStart = @DateStart,
                            DateExpiration = @DateExpiration,
                            TaskSubject = @TaskSubject,
                            IsScheduled = @IsScheduled,
                            TaskType = @TaskType,
                            TaskTypeName = @TaskTypeName,
                            TaskStatus = @TaskStatus,
                            WithSales = @WithSales,
                            NextSalesMeeting = @NextSalesMeeting,
                            SalespersonLoginName = @SalespersonLoginName,
                            SalespersonLastname = @SalespersonLastname,
                            SalespersonFirstname = @SalespersonFirstname,
                            DateUpdatedBISynchTasks = @DateUpdatedBISynchTasks,
                            DateCreatedBISynchTasks = @DateCreatedBISynchTasks,
                            BIDeletedTasks = @BIDeletedTasks,
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
                            @PK_BITaskID, @FK_BICompanyID, @FK_BIAlternativeID, @ProjectID, @ProjectName,
                            @DateStart, @DateExpiration, @TaskSubject, @IsScheduled, @TaskType,
                            @TaskTypeName, @TaskStatus, @WithSales, @NextSalesMeeting,
                            @SalespersonLoginName, @SalespersonLastname, @SalespersonFirstname,
                            @DateUpdatedBISynchTasks, @DateCreatedBISynchTasks, @BIDeletedTasks
                        )
                    OUTPUT $action;
                `);

            if (result.recordset[0][''] === 'INSERT') {
                inserted++;
            } else {
                updated++;
            }

            // Progress logging every 100 records
            if ((inserted + updated) % 100 === 0) {
                context.log(`Progress: ${inserted} inserted, ${updated} updated`);
            }
        }

        await transaction.commit();
        context.log(`MERGE completed: ${inserted} inserted, ${updated} updated`);

        return { inserted, updated };
    } catch (error) {
        await transaction.rollback();
        context.error(`Error during MERGE: ${error.message}`);
        throw error;
    }
}

/**
 * Gets total count from SQL Server
 */
async function getSQLTotalCount(pool) {
    const result = await pool.request()
        .query('SELECT COUNT(*) as total FROM compusoft_tasks');
    return result.recordset[0].total;
}

/**
 * Logs execution to logging database
 * Uses existing azure_functions_log table structure
 */
async function logExecution(context, logData) {
    let loggingPool;
    try {
        loggingPool = await sql.connect(loggingConfig);

        // Build metadata JSON
        const metadata = JSON.stringify({
            recordsInserted: logData.recordsInserted,
            recordsUpdated: logData.recordsUpdated,
            odataTotalCount: logData.odataTotalCount,
            sqlTotalCount: logData.sqlTotalCount,
            countMatch: logData.countMatch
        });

        // Build notes
        let notes = logData.additionalInfo || '';
        if (!logData.countMatch && logData.odataTotalCount && logData.sqlTotalCount) {
            notes += ` | Count mismatch: OData=${logData.odataTotalCount}, SQL=${logData.sqlTotalCount}`;
        }

        await loggingPool.request()
            .input('source', sql.NVarChar, 'Azure Functions')
            .input('operation', sql.NVarChar, 'OData Sync')
            .input('function_name', sql.NVarChar, logData.functionName)
            .input('status', sql.NVarChar, logData.status)
            .input('duration_seconds', sql.Int, Math.round(logData.executionDurationMs / 1000))
            .input('records_processed', sql.Int, logData.recordsProcessed)
            .input('error_message', sql.NVarChar, logData.errorMessage)
            .input('metadata', sql.NVarChar, metadata)
            .input('notes', sql.NVarChar, notes)
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

        context.log('Execution logged successfully');
    } catch (error) {
        context.error(`Error logging to database: ${error.message}`);
    } finally {
        if (loggingPool) {
            await loggingPool.close();
        }
    }
}

/**
 * Main sync logic
 */
async function syncTasks(context) {
    const startTime = Date.now();
    let dwPool;

    const logData = {
        functionName: 'syncCompusoftTasks',
        status: 'RUNNING',
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        odataTotalCount: null,
        sqlTotalCount: null,
        countMatch: null,
        errorMessage: null,
        executionDurationMs: 0,
        additionalInfo: null
    };

    try {
        context.log('Starting Compusoft Tasks sync');

        // Calculate incremental date (yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        context.log(`Incremental load: fetching records since ${yesterday.toISOString()}`);

        // Fetch incremental data
        const records = await fetchIncrementalData(context, yesterday);
        logData.recordsProcessed = records.length;
        context.log(`Fetched ${records.length} records`);

        if (records.length > 0) {
            // Connect to data warehouse
            dwPool = await sql.connect(dwConfig);

            // Upsert records
            const { inserted, updated } = await upsertRecords(context, dwPool, records);
            logData.recordsInserted = inserted;
            logData.recordsUpdated = updated;

            context.log(`Data loaded: ${inserted} inserted, ${updated} updated`);
        } else {
            context.log('No new or updated records to process');
        }

        // Verify totals
        context.log('Verifying total counts...');
        if (!dwPool) {
            dwPool = await sql.connect(dwConfig);
        }

        const odataTotal = await getODataTotalCount(context);
        const sqlTotal = await getSQLTotalCount(dwPool);

        logData.odataTotalCount = odataTotal;
        logData.sqlTotalCount = sqlTotal;
        logData.countMatch = odataTotal === sqlTotal;

        context.log(`OData total: ${odataTotal}`);
        context.log(`SQL total: ${sqlTotal}`);
        context.log(`Counts match: ${logData.countMatch ? 'YES' : 'NO'}`);

        if (!logData.countMatch) {
            context.warn(`WARNING: Count mismatch! OData: ${odataTotal}, SQL: ${sqlTotal}, Difference: ${odataTotal - sqlTotal}`);
            logData.status = 'WARNING';
            logData.additionalInfo = `Count mismatch detected. Difference: ${odataTotal - sqlTotal}`;
        } else {
            logData.status = 'SUCCESS';
        }

        return logData;

    } catch (error) {
        context.error(`Function failed: ${error.message}`);
        context.error(error.stack);
        logData.status = 'FAILED';
        logData.errorMessage = error.message;
        throw error;
    } finally {
        logData.executionDurationMs = Date.now() - startTime;

        // Close data warehouse connection
        if (dwPool) {
            await dwPool.close();
        }

        // Log execution
        await logExecution(context, logData);

        context.log(`Function completed in ${logData.executionDurationMs}ms with status: ${logData.status}`);
    }
}

/**
 * HTTP trigger for testing
 */
app.http('syncCompusoftTasksHttp', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const result = await syncTasks(context);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    status: result.status,
                    recordsProcessed: result.recordsProcessed,
                    recordsInserted: result.recordsInserted,
                    recordsUpdated: result.recordsUpdated,
                    odataTotalCount: result.odataTotalCount,
                    sqlTotalCount: result.sqlTotalCount,
                    countMatch: result.countMatch,
                    executionDurationMs: result.executionDurationMs,
                    message: 'Sync completed successfully'
                }
            };
        } catch (error) {
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error.message,
                    message: 'Sync failed'
                }
            };
        }
    }
});
