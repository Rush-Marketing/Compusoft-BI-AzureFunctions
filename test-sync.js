const axios = require('axios');
const sql = require('mssql');

// Database configurations
const dwConfig = {
    server: 'sql-datawarehouse-stg01.database.windows.net',
    database: 'sqldb-datawarehouse-stg',
    user: 'dwh01',
    password: 'HipALeV2AYEd^Wx3',
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
    server: 'rm-logging.database.windows.net',
    database: 'rm-logging-db',
    user: 'dwh01',
    password: 'HipALeV2AYEd^Wx3',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// OData configuration
const odataConfig = {
    baseUrl: 'https://winnerbizzwebapibidataaccess.azurewebsites.net/origin',
    username: 'user',
    password: 'D0B7A09BC20076BA59FB9DAF706267EE79082925BD47D0E626857728BBDB1ECB9F4F245859F494FADDEC5D9A5B6EB8532A942AAF63C68292C265AFFD961FF24E',
    endpoint: 'BITasks'
};

// Mock context object
const context = {
    log: (...args) => console.log('[LOG]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

/**
 * Fetches incremental data from OData API
 */
async function fetchIncrementalData(sinceDate) {
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
async function getODataTotalCount() {
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
 * Upserts records into SQL Server using batched MERGE
 */
async function upsertRecords(pool, records) {
    context.log(`Starting MERGE for ${records.length} records...`);

    let inserted = 0;
    let updated = 0;
    const batchSize = 50;

    try {
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            // Build VALUES clause for batch
            const values = batch.map((_, idx) => {
                const params = [];
                const prefix = `r${idx}_`;
                for (let j = 0; j < 20; j++) {
                    params.push(`@${prefix}c${j}`);
                }
                return `(${params.join(', ')})`;
            }).join(',\n                ');

            // Build MERGE query
            const mergeQuery = `
                MERGE compusoft_tasks AS target
                USING (VALUES
                    ${values}
                ) AS source (
                    PK_BITaskID, FK_BICompanyID, FK_BIAlternativeID, ProjectID, ProjectName,
                    DateStart, DateExpiration, TaskSubject, IsScheduled, TaskType,
                    TaskTypeName, TaskStatus, WithSales, NextSalesMeeting,
                    SalespersonLoginName, SalespersonLastname, SalespersonFirstname,
                    DateUpdatedBISynchTasks, DateCreatedBISynchTasks, BIDeletedTasks
                )
                ON target.PK_BITaskID = source.PK_BITaskID
                WHEN MATCHED THEN
                    UPDATE SET
                        FK_BICompanyID = source.FK_BICompanyID,
                        FK_BIAlternativeID = source.FK_BIAlternativeID,
                        ProjectID = source.ProjectID,
                        ProjectName = source.ProjectName,
                        DateStart = source.DateStart,
                        DateExpiration = source.DateExpiration,
                        TaskSubject = source.TaskSubject,
                        IsScheduled = source.IsScheduled,
                        TaskType = source.TaskType,
                        TaskTypeName = source.TaskTypeName,
                        TaskStatus = source.TaskStatus,
                        WithSales = source.WithSales,
                        NextSalesMeeting = source.NextSalesMeeting,
                        SalespersonLoginName = source.SalespersonLoginName,
                        SalespersonLastname = source.SalespersonLastname,
                        SalespersonFirstname = source.SalespersonFirstname,
                        DateUpdatedBISynchTasks = source.DateUpdatedBISynchTasks,
                        DateCreatedBISynchTasks = source.DateCreatedBISynchTasks,
                        BIDeletedTasks = source.BIDeletedTasks,
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
                        source.PK_BITaskID, source.FK_BICompanyID, source.FK_BIAlternativeID,
                        source.ProjectID, source.ProjectName, source.DateStart, source.DateExpiration,
                        source.TaskSubject, source.IsScheduled, source.TaskType, source.TaskTypeName,
                        source.TaskStatus, source.WithSales, source.NextSalesMeeting,
                        source.SalespersonLoginName, source.SalespersonLastname, source.SalespersonFirstname,
                        source.DateUpdatedBISynchTasks, source.DateCreatedBISynchTasks, source.BIDeletedTasks
                    )
                OUTPUT $action;
            `;

            // Build request with parameters
            // Helper to handle null values - use undefined for mssql nullable types
            const safeInt = (val) => val === null || val === undefined ? undefined : val;
            const safeBit = (val) => val === null || val === undefined ? undefined : val;

            const request = pool.request();
            batch.forEach((record, idx) => {
                const prefix = `r${idx}_`;
                request.input(`${prefix}c0`, sql.Int, record.PK_BITaskID);
                request.input(`${prefix}c1`, sql.Int, safeInt(record.FK_BICompanyID));
                request.input(`${prefix}c2`, sql.Int, safeInt(record.FK_BIAlternativeID));
                request.input(`${prefix}c3`, sql.NVarChar, record.ProjectID);
                request.input(`${prefix}c4`, sql.NVarChar, record.ProjectName);
                request.input(`${prefix}c5`, sql.DateTime2, record.DateStart);
                request.input(`${prefix}c6`, sql.DateTime2, record.DateExpiration);
                request.input(`${prefix}c7`, sql.NVarChar, record.TaskSubject);
                request.input(`${prefix}c8`, sql.Bit, safeBit(record.IsScheduled));
                request.input(`${prefix}c9`, sql.Int, safeInt(record.TaskType));
                request.input(`${prefix}c10`, sql.NVarChar, record.TaskTypeName);
                request.input(`${prefix}c11`, sql.Int, safeInt(record.TaskStatus));
                request.input(`${prefix}c12`, sql.Bit, safeBit(record.WithSales));
                request.input(`${prefix}c13`, sql.Bit, safeBit(record.NextSalesMeeting));
                request.input(`${prefix}c14`, sql.NVarChar, record.SalespersonLoginName);
                request.input(`${prefix}c15`, sql.NVarChar, record.SalespersonLastname);
                request.input(`${prefix}c16`, sql.NVarChar, record.SalespersonFirstname);
                request.input(`${prefix}c17`, sql.DateTime2, record.DateUpdatedBISynchTasks);
                request.input(`${prefix}c18`, sql.DateTime2, record.DateCreatedBISynchTasks);
                request.input(`${prefix}c19`, sql.Bit, safeBit(record.BIDeletedTasks));
            });

            const result = await request.query(mergeQuery);
            const batchInserted = result.recordset.filter(r => r[''] === 'INSERT').length;
            const batchUpdated = result.recordset.filter(r => r[''] === 'UPDATE').length;

            inserted += batchInserted;
            updated += batchUpdated;

            if ((i + batchSize) % 200 === 0 || i + batchSize >= records.length) {
                context.log(`Progress: ${i + batch.length}/${records.length} - ${inserted} inserted, ${updated} updated`);
            }
        }

        context.log(`MERGE completed: ${inserted} inserted, ${updated} updated`);
        return { inserted, updated };
    } catch (error) {
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
 */
async function logExecution(logData) {
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
            .input('source', sql.NVarChar, 'Test Script')
            .input('operation', sql.NVarChar, 'OData Sync Test')
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
 * Main function
 */
async function main() {
    console.log('\n========================================');
    console.log('  COMPUSOFT TASKS SYNC TEST');
    console.log('========================================\n');

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
        context.log('Starting Compusoft Tasks sync TEST');

        // Calculate incremental date (yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        context.log(`Incremental load: fetching records since ${yesterday.toISOString()}`);

        // Fetch incremental data
        const records = await fetchIncrementalData(yesterday);
        logData.recordsProcessed = records.length;
        context.log(`Fetched ${records.length} records`);

        if (records.length > 0) {
            // Connect to data warehouse
            context.log('Connecting to data warehouse...');
            dwPool = await sql.connect(dwConfig);
            context.log('Connected!');

            // Upsert records
            const { inserted, updated } = await upsertRecords(dwPool, records);
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

        const odataTotal = await getODataTotalCount();
        const sqlTotal = await getSQLTotalCount(dwPool);

        logData.odataTotalCount = odataTotal;
        logData.sqlTotalCount = sqlTotal;
        logData.countMatch = odataTotal === sqlTotal;

        context.log(`OData total: ${odataTotal}`);
        context.log(`SQL total: ${sqlTotal}`);
        context.log(`Counts match: ${logData.countMatch ? 'YES ✓' : 'NO ✗'}`);

        if (!logData.countMatch) {
            context.warn(`WARNING: Count mismatch! OData: ${odataTotal}, SQL: ${sqlTotal}, Difference: ${odataTotal - sqlTotal}`);
            logData.status = 'WARNING';
            logData.additionalInfo = `Count mismatch detected. Difference: ${odataTotal - sqlTotal}`;
        } else {
            logData.status = 'SUCCESS';
        }

        console.log('\n========================================');
        console.log('  SUMMARY');
        console.log('========================================');
        console.log(`Status:           ${logData.status}`);
        console.log(`Records Fetched:  ${logData.recordsProcessed}`);
        console.log(`Records Inserted: ${logData.recordsInserted}`);
        console.log(`Records Updated:  ${logData.recordsUpdated}`);
        console.log(`OData Total:      ${logData.odataTotalCount}`);
        console.log(`SQL Total:        ${logData.sqlTotalCount}`);
        console.log(`Match:            ${logData.countMatch ? 'YES ✓' : 'NO ✗'}`);

    } catch (error) {
        context.error(`Function failed: ${error.message}`);
        context.error(error.stack);
        logData.status = 'FAILED';
        logData.errorMessage = error.message;
    } finally {
        logData.executionDurationMs = Date.now() - startTime;

        // Close data warehouse connection
        if (dwPool) {
            await dwPool.close();
        }

        // Log execution
        await logExecution(logData);

        console.log(`Duration:         ${logData.executionDurationMs}ms (${Math.round(logData.executionDurationMs / 1000)}s)`);
        console.log('========================================\n');

        context.log(`Function completed in ${logData.executionDurationMs}ms with status: ${logData.status}`);
    }
}

main().catch(console.error);
