const axios = require('axios');

const username = 'user';
const password = 'D0B7A09BC20076BA59FB9DAF706267EE79082925BD47D0E626857728BBDB1ECB9F4F245859F494FADDEC5D9A5B6EB8532A942AAF63C68292C265AFFD961FF24E';
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

async function testCount() {
    console.log('Testing OData $count functionality...\n');

    try {
        // Test 1: $count=true (inline count)
        console.log('Test 1: Using $count=true (inline)');
        const response1 = await axios.get('https://winnerbizzwebapibidataaccess.azurewebsites.net/origin/BITasks?$count=true&$top=1', {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
            },
            timeout: 30000
        });
        console.log('Response keys:', Object.keys(response1.data));
        console.log('Count from response:', response1.data['@odata.count']);
        console.log();

        // Test 2: /$count endpoint
        console.log('Test 2: Using /$count endpoint');
        const response2 = await axios.get('https://winnerbizzwebapibidataaccess.azurewebsites.net/origin/BITasks/$count', {
            headers: {
                'Authorization': authHeader,
                'Accept': 'text/plain',
            },
            timeout: 30000
        });
        console.log('Count:', response2.data);
        console.log('Type:', typeof response2.data);

    } catch (error) {
        console.log('FAILED:', error.message);
        console.log('Status:', error.response?.status);
        console.log('Data:', error.response?.data);
    }
}

testCount();
