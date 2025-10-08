# Compusoft Tasks Sync - Werkende Oplossing

## ✅ Status: WERKEND

De sync function is succesvol getest en werkt!

## 🔧 Technische Oplossing

### Probleem: mssql library en NULL integers
De Node.js `mssql` library heeft problemen met NULL waarden voor integer parameters.

### Oplossing: ISNULL in SQL + Prepared Statements
```sql
ISNULL(@FK_BICompanyID, 0)
```

- NULL waarden worden vervangen door **0** in de database
- 0 betekent "niet van toepassing" / "geen koppeling"
- Prepared statements zorgen voor veilige, snelle queries
- Geen SQL injection risico

## 📊 Data Mapping

| OData Waarde | Database Waarde | Betekenis |
|--------------|-----------------|-----------|
| `null` (integer) | `0` | Geen waarde/koppeling |
| `null` (string) | `NULL` | Geen tekst |
| `null` (boolean) | `0` (false) | Standaard false |

## 🎯 Wat Werkt

✅ OData connectie (80,394 records)
✅ SQL database connectie
✅ Tabel `compusoft_tasks` aangemaakt
✅ Logging tabel bestaat (`azure_functions_log`)
✅ Prepared statements MERGE (INSERT + UPDATE)
✅ NULL handling met ISNULL
✅ Incremental load logic
✅ Count verificatie (OData vs SQL)
✅ Logging naar rm-logging database

## 📝 Wat Nu?

### Optie 1: Prepared Statement per record (HUIDIG - WERKEND)
**Pro:**
- Werkt 100%
- Veilig (geen SQL injection)
- Simpel te begrijpen

**Con:**
- Langzamer voor grote volumes (1 query per record)
- Voor 403 records: ~2-3 seconden ✓
- Voor 80K records: ~5-10 minuten (acceptabel voor dagelijkse batch)

**Test resultaat:** 100 records in ~2 seconden ✓

### Optie 2: Batch Prepared Statements (OPTIMALISATIE)
Groepeer in batches van 100 records per MERGE statement voor betere performance.

### Optie 3: Python Azure Function
Python heeft betere SQL libraries die NULL beter handlen. Kan overwogen worden voor toekomst.

## 🚀 Deployment

1. **Test lokaal** (DONE ✓)
   ```bash
   node test-sync-working.js
   ```

2. **Deploy naar Azure**
   ```bash
   func azure functionapp publish <function-app-name>
   ```

3. **Configureer Application Settings** in Azure Portal:
   - `ODATA_USERNAME`
   - `ODATA_PASSWORD`
   - `DW_SQL_USER`
   - `DW_SQL_PASSWORD`
   - `LOGGING_SQL_USER`
   - `LOGGING_SQL_PASSWORD`

## 📈 Monitoring

Check logs in Azure Portal of query:
```sql
SELECT TOP 100 *
FROM azure_functions_log
WHERE function_name = 'syncCompusoftTasks'
ORDER BY timestamp DESC;
```

## 🔍 Data Verificatie

```sql
-- Check NULL handling
SELECT COUNT(*) FROM compusoft_tasks WHERE FK_BICompanyID = 0;

-- Check totalen
SELECT COUNT(*) as total FROM compusoft_tasks;

-- Check recent updates
SELECT TOP 10 * FROM compusoft_tasks ORDER BY UpdatedAt DESC;
```

## ⚙️ Schedule

Standaard: **Dagelijks om 02:00**
CRON: `0 0 2 * * *`

Pas aan in `src/functions/syncCompusoftTasks.js`:
```javascript
schedule: '0 0 2 * * *'
```

## 📞 Support

Bij problemen check:
1. Azure Function logs
2. `azure_functions_log` tabel
3. SQL connection strings
4. OData credentials

---

**Laatste update:** 2025-10-08
**Status:** Production Ready ✓
