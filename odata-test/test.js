const axios = require('axios');

const username = 'user';
const password = 'D0B7A09BC20076BA59FB9DAF706267EE79082925BD47D0E626857728BBDB1ECB9F4F245859F494FADDEC5D9A5B6EB8532A942AAF63C68292C265AFFD961FF24E';
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

async function test() {
    console.log('Testing OData API...\n');

    try {
        const response = await axios.get('https://winnerbizzwebapibidataaccess.azurewebsites.net/origin/BITasks', {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json;odata=verbose',
                'DataServiceVersion': '2.0',
            },
            timeout: 30000
        });
        console.log('SUCCESS!');
        const records = response.data?.value || response.data?.d?.results || [];
        console.log('Records:', records.length);
        console.log('\nFirst record (full structure):');
        console.log(JSON.stringify(records[0], null, 2));
        console.log('\nColumn names:');
        console.log(Object.keys(records[0]).join(', '));
    } catch (error) {
        console.log('FAILED:', error.message);
        console.log('Error code:', error.code);
    }
}

test();
