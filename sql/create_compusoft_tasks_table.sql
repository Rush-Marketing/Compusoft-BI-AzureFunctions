-- Create table for Compusoft Tasks
-- Target database: sqldb-datawarehouse-stg
-- Target server: sql-datawarehouse-stg01.database.windows.net

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'compusoft_tasks')
BEGIN
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

        -- Audit columns
        LoadedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );

    -- Create index on date columns for incremental load performance
    CREATE INDEX IX_compusoft_tasks_DateCreated ON compusoft_tasks(DateCreatedBISynchTasks);
    CREATE INDEX IX_compusoft_tasks_DateUpdated ON compusoft_tasks(DateUpdatedBISynchTasks);

    PRINT 'Table compusoft_tasks created successfully';
END
ELSE
BEGIN
    PRINT 'Table compusoft_tasks already exists';
END
GO
