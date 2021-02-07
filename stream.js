const ws = require('ws');
const { URLS: { [process.env.NODE_ENV || 'test']: { WS: wsUrl } } } = require('./config');

class Stream {
    wsClient = null;
    events = [];
    onAccountUpdate = () => { };

    constructor(listenKey, symbols) {
        const wsClient = new ws(wsUrl + '/' + listenKey);

        wsClient.on('message', frame => {
            const message = JSON.parse(frame);
            switch (message.e) {
                case 'trade':
                    this.events.push(Date.now() - message.E);
                    break;
                case 'outboundAccountPosition':
                    this.onAccountUpdate(message.B.map(({ a, f, l }) => ({ asset: a, free: f, locked: l })));
                    break;
            }
        });

        wsClient.on('open', () => {
            wsClient.send(JSON.stringify({
                method: 'SUBSCRIBE',
                params: symbols.map(s => `${s.toLowerCase()}@trade`),
                id: 1
            }));
            wsClient.send(JSON.stringify({
                method: 'LIST_SUBSCRIPTIONS',
                params: [],
                id: 1
            }));
        });

        wsClient.on('ping', wsClient.pong);
        wsClient.on('error', e => console.log('ERROR: WS', e));
        wsClient.on('close', () => console.log('INFO: WS closed'));
    }

    logEvents() {
        this.events.sort((a, b) => a - b);
        const half = (this.events.length - 1) / 2;
        const median = (this.events[Math.floor(half)] + this.events[Math.ceil(half)]) / 2;
        console.log(
            `| ${this.events.length} \t\t|`,
            this.events.length ? `\t\t${Math.min(...this.events)}\t| ${median}\t| ${Math.max(...this.events)}\t|` : ''
        );
    }

    flushEvents() {
        this.events = [];
    }
}

module.exports = Stream;