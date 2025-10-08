# GitHub Secret Setup - Stap voor Stap

## Waarom faalt deployment?

GitHub Actions kan niet deployen zonder Azure credentials. Je moet het **publish profile** als secret toevoegen.

## Stappen:

### 1. Download Publish Profile

1. Ga naar [Azure Portal](https://portal.azure.com)
2. Zoek je Function App
3. Klik **"Download publish profile"** (bovenaan, tussen de buttons)
4. Je krijgt een `.PublishSettings` XML bestand

### 2. Open het bestand

Open het `.PublishSettings` bestand met Notepad. Het ziet er zo uit:

```xml
<publishData>
  <publishProfile profileName="..." publishMethod="MSDeploy" publishUrl="..."
    msdeploySite="..." userName="..." userPWD="..." destinationAppUrl="..." ... />
</publishData>
```

**Kopieer de HELE inhoud** (alle regels, van `<publishData>` tot `</publishData>`)

### 3. Voeg toe als GitHub Secret

1. Ga naar: https://github.com/Rush-Marketing/Compusoft-BI-AzureFunctions/settings/secrets/actions

2. Klik **"New repository secret"**

3. Vul in:
   - **Name:** `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
   - **Secret:** Plak de hele inhoud van het `.PublishSettings` bestand

4. Klik **"Add secret"**

### 4. Update Function App Name

Edit het bestand `.github/workflows/azure-functions-deploy.yml`:

Verander regel 8:
```yaml
AZURE_FUNCTIONAPP_NAME: 'your-function-app-name'  # TODO: Update this!
```

Naar (vervang met jouw echte naam):
```yaml
AZURE_FUNCTIONAPP_NAME: 'mijn-compusoft-function'  # Je Azure Function App naam
```

Commit en push.

### 5. Trigger Deployment

**Automatisch:** Push naar master branch
```bash
git push
```

**Handmatig:**
1. Ga naar: https://github.com/Rush-Marketing/Compusoft-BI-AzureFunctions/actions
2. Selecteer "Deploy to Azure Functions"
3. Klik "Run workflow" → "Run workflow"

### 6. Check Deployment Status

- Ga naar Actions tab op GitHub
- Klik op de lopende workflow
- Bekijk de logs

Als het lukt zie je: ✅ **"Successfully deployed"**

## Troubleshooting

**Error: "No credentials found"**
→ Je hebt stap 3 (GitHub Secret) nog niet gedaan

**Error: "App name not found"**
→ Je hebt de verkeerde function app naam in stap 4

**Success maar function niet zichtbaar?**
→ Wacht 2-3 minuten en refresh Azure Portal
