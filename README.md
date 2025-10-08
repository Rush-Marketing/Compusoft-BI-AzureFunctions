# Compusoft Azure Functions

Azure Functions voor het synchroniseren van Compusoft OData data naar SQL Server.

## Functies

### syncCompusoftTasks
Synchroniseert BITasks data van Compusoft OData API naar SQL Server.

**Features:**
- Incremental load (alleen nieuwe/gewijzigde records van de laatste 24 uur)
- Automatische MERGE/UPSERT op basis van PK_BITaskID
- Totalen verificatie (OData count vs SQL count)
- Uitgebreide logging naar aparte logging database
- Timer trigger: dagelijks om 02:00

## Setup

### 1. Installeer dependencies
```bash
npm install
```

### 2. Maak SQL tabellen aan
Voer de volgende SQL scripts uit:

**Data warehouse database (sqldb-datawarehouse-stg):**
```bash
# Voer uit op sql-datawarehouse-stg01.database.windows.net
sql/create_compusoft_tasks_table.sql
```

**Logging database (rm-logging-db):**
```bash
# Voer uit op rm-logging.database.windows.net
sql/create_logging_table.sql
```

### 3. Configureer environment variabelen
Kopieer `local.settings.json.example` naar `local.settings.json` en vul de credentials in:

```json
{
  "Values": {
    "DW_SQL_USER": "jouw_datawarehouse_username",
    "DW_SQL_PASSWORD": "jouw_datawarehouse_password",
    "LOGGING_SQL_USER": "jouw_logging_username",
    "LOGGING_SQL_PASSWORD": "jouw_logging_password"
  }
}
```

### 4. Run lokaal
```bash
npm start
```

Of met Azure Functions Core Tools:
```bash
func start
```

## Database Schema

### compusoft_tasks (Data Warehouse)
Bevat alle BITasks data met de volgende kolommen:
- `PK_BITaskID` (Primary Key)
- `FK_BICompanyID`, `FK_BIAlternativeID`
- `ProjectID`, `ProjectName`
- `DateStart`, `DateExpiration`
- `TaskSubject`, `TaskType`, `TaskTypeName`, `TaskStatus`
- `IsScheduled`, `WithSales`, `NextSalesMeeting`
- `SalespersonLoginName`, `SalespersonLastname`, `SalespersonFirstname`
- `DateCreatedBISynchTasks`, `DateUpdatedBISynchTasks`
- `BIDeletedTasks`
- `LoadedAt`, `UpdatedAt` (audit columns)

### azure_functions_log (Logging Database)
Logging van alle function executions met:
- Execution time, status, duration
- Records processed, inserted, updated
- OData vs SQL totals check
- Error messages
- Additional info

## Incremental Load Strategie

De function haalt alleen records op die:
- **Aangemaakt** zijn in de laatste 24 uur (`DateCreatedBISynchTasks >= gisteren`)
- **Gewijzigd** zijn in de laatste 24 uur (`DateUpdatedBISynchTasks >= gisteren`)

Dit wordt gecombineerd met een MERGE statement dat:
- **INSERT** doet voor nieuwe records
- **UPDATE** doet voor bestaande records

## Verificatie

Na elke run wordt automatisch gecontroleerd of:
- OData totaal aantal records = SQL totaal aantal records
- Bij mismatch wordt dit gelogd als WARNING

## Monitoring

Check de logging database voor execution history:
```sql
SELECT TOP 100 *
FROM azure_functions_log
WHERE FunctionName = 'syncCompusoftTasks'
ORDER BY ExecutionTime DESC;
```

## Deployment naar Azure

1. Maak een Azure Function App aan
2. Configureer Application Settings met de environment variabelen
3. Deploy met:
```bash
func azure functionapp publish <function-app-name>
```

## Schedule

Standaard draait de function dagelijks om 02:00 (CRON: `0 0 2 * * *`).

Pas de schedule aan in `src/functions/syncCompusoftTasks.js`:
```javascript
schedule: '0 0 2 * * *', // Minuut Uur Dag Maand DagVanWeek
```
