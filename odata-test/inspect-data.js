const axios = require('axios');

const odataConfig = {
    baseUrl: 'https://winnerbizzwebapibidataaccess.azurewebsites.net/origin',
    username: 'user',
    password: 'D0B7A09BC20076BA59FB9DAF706267EE79082925BD47D0E626857728BBDB1ECB9F4F245859F494FADDEC5D9A5B6EB8532A942AAF63C68292C265AFFD961FF24E',
    endpoint: 'BITasks'
};

async function inspectData() {
    const authHeader = `Basic ${Buffer.from(`${odataConfig.username}:${odataConfig.password}`).toString('base64')}`;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const dateFilter = `DateCreatedBISynchTasks ge ${yesterday.toISOString()} or DateUpdatedBISynchTasks ge ${yesterday.toISOString()}`;
    let url = `${odataConfig.baseUrl}/${odataConfig.endpoint}?$count=true&$top=5&$filter=${encodeURIComponent(dateFilter)}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
        },
        timeout: 60000
    });

    const data = response.data.value || [];

    console.log('First 5 records:');
    data.forEach((record, i) => {
        console.log(`\n=== Record ${i + 1} ===`);
        console.log('PK_BITaskID:', record.PK_BITaskID, typeof record.PK_BITaskID);
        console.log('FK_BICompanyID:', record.FK_BICompanyID, typeof record.FK_BICompanyID);
        console.log('FK_BIAlternativeID:', record.FK_BIAlternativeID, typeof record.FK_BIAlternativeID);
        console.log('TaskType:', record.TaskType, typeof record.TaskType);
        console.log('TaskStatus:', record.TaskStatus, typeof record.TaskStatus);
        console.log('Full record:');
        console.log(JSON.stringify(record, null, 2));
    });
}

inspectData().catch(console.error);
