const service = require('./src/services/salesOrderService');

async function test() {
    try {
        const res = await service.getSalesOrderById('49deaab5-9d7a-4112-b087-15f714643858');
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
