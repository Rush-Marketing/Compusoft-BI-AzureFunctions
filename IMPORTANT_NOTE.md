# ✅ NULL INTEGER BUG IS OPGELOST

## Status: FIXED

De Azure Functions code is nu geüpdatet met de werkende NULL handling methode.

## Wat is gefixed?

De `upsertRecords()` functie in beide files:
- `src/functions/syncCompusoftTasks.js`
- `src/functions/syncCompusoftTasksHttp.js`

Gebruikt nu **ISNULL in SQL** voor alle nullable integer/bit columns:
- FK_BICompanyID
- FK_BIAlternativeID
- TaskType
- TaskStatus
- IsScheduled
- WithSales
- NextSalesMeeting
- BIDeletedTasks

## Hoe werkt het nu?

In plaats van:
```sql
FK_BICompanyID = @FK_BICompanyID  -- WERKT NIET met NULL
```

Gebruiken we nu:
```sql
FK_BICompanyID = ISNULL(@FK_BICompanyID, 0)  -- WERKT WEL met NULL
```

## Next Steps

1. ✅ Code is gefixed
2. ⏳ Push naar GitHub
3. ⏳ Deploy naar Azure via GitHub Actions (vereist publish profile secret)

## Test Lokaal (optioneel)

Je kunt nog steeds `test-sync-working.js` gebruiken om lokaal te testen:
```bash
node test-sync-working.js
```
