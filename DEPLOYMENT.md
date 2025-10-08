# Deployment naar Azure

## GitHub Actions Setup

Deze repository is geconfigureerd voor automatische deployment naar Azure Functions via GitHub Actions.

### Stappen:

#### 1. Download Publish Profile van Azure

1. Ga naar [Azure Portal](https://portal.azure.com)
2. Navigeer naar je Function App
3. Klik op **"Download publish profile"** (bovenaan)
4. Sla het bestand op (bijvoorbeeld `yourapp.PublishSettings`)

#### 2. Voeg Publish Profile toe als GitHub Secret

1. Ga naar je GitHub repository: https://github.com/Rush-Marketing/Compusoft-BI-AzureFunctions
2. Klik op **Settings** → **Secrets and variables** → **Actions**
3. Klik **"New repository secret"**
4. Naam: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
5. Waarde: Open het `.PublishSettings` bestand en kopieer **HELE INHOUD**
6. Klik **"Add secret"**

#### 3. Update Function App Name

Edit `.github/workflows/azure-functions-deploy.yml`:

```yaml
env:
  AZURE_FUNCTIONAPP_NAME: 'your-actual-function-app-name'  # Update deze!
```

Commit en push:
```bash
git add .github/workflows/azure-functions-deploy.yml
git commit -m "Update function app name"
git push
```

#### 4. Deployment

**Automatisch:**
- Elke push naar `master` branch triggert automatisch deployment

**Handmatig:**
1. Ga naar GitHub → Actions tab
2. Selecteer "Deploy to Azure Functions"
3. Klik "Run workflow"

## Verificatie

Na deployment:
1. Check Azure Portal → Function App → Functions
2. Check logs in Azure Portal
3. Test de function:
   ```bash
   curl https://your-function-app.azurewebsites.net/api/syncCompusoftTasksHttp
   ```

## Troubleshooting

**Deployment fails:**
- Check dat `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` secret correct is
- Check dat function app name correct is in workflow
- Check GitHub Actions logs voor details

**Function niet zichtbaar:**
- Wacht 2-3 minuten na deployment
- Restart function app in Azure Portal
- Check Application Insights logs

## Environment Variables in Azure

Na deployment, configureer in Azure Portal → Function App → Configuration:

```
ODATA_USERNAME=user
ODATA_PASSWORD=<your-password>
DW_SQL_SERVER=sql-datawarehouse-stg01.database.windows.net
DW_SQL_DATABASE=sqldb-datawarehouse-stg
DW_SQL_USER=dwh01
DW_SQL_PASSWORD=<your-password>
LOGGING_SQL_SERVER=rm-logging.database.windows.net
LOGGING_SQL_DATABASE=rm-logging-db
LOGGING_SQL_USER=dwh01
LOGGING_SQL_PASSWORD=<your-password>
```

Klik **Save** en function app herstart automatisch.
