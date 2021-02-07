const Api = require('./api');
const Stream = require('./stream');
const { API_KEY, SECRET_KEY, NODE_ENV = 'test' } = process.env;
const { LOG_INTERVAL, URLS } = require('./config');

if (!API_KEY || !SECRET_KEY) {
    console.log("API_KEY and SECRET_KEY must be set as environment vars");
    console.log("Example: API_KEY=AAA SECRET_KEY=BBB npm start");
    process.exit();
}

const printBalances = balances => {
    console.log("Balances:");
    for ([asset, { free, locked }] of balances) {
        if (free * 1 + locked * 1) console.log(`${asset}: ${free}/${locked}`);
    }
    console.log('\n');
};

(async () => {
    const api = new Api(URLS, API_KEY, SECRET_KEY, NODE_ENV);
    const symbols = await api.topVolumeSymbols();
    const listenKey = await api.initListenKey();
    console.log(`Going to subscribe to the following symbols: ${symbols.join(', ')}.\n`);
    const balances = await api.getBalances();
    printBalances(balances);
    const stream = await new Stream(listenKey, symbols);
    console.log('| events count\t| latency \t min\t| mean\t| max \t|');
    stream.onAccountUpdate = (updatedBalancies) => {
        updatedBalancies.map(({ asset, free, locked }) => balances.set(asset, { free, locked }))
        printBalances(balances);
    }
    setInterval(() => {
        stream.logEvents();
        stream.flushEvents();
    }, LOG_INTERVAL);

})();

