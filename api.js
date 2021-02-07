const crypto = require('crypto');
const querystring = require('querystring');
const https = require('https');
const url = require('url');

class Api {
    ENV = null;
    URLS = null;
    #API_KEY = null;
    #SECRET_KEY = null;
    listenKey = null;

    constructor(URLS, API_KEY, SECRET_KEY, ENV) {
        if (!API_KEY || !SECRET_KEY) {
            throw new Error("API_KEY and SECRET_KEY must be defined");
        }
        if (!URLS) {
            throw new Error("URLS must be defined");
        }
        if (!ENV) {
            throw new Error("ENV must be defined");
        }
        this.URLS = URLS;
        this.#SECRET_KEY = SECRET_KEY;
        this.#API_KEY = API_KEY;
        this.ENV = ENV;
    }

    sign(data) {
        const h = crypto.createHmac('sha256', this.#SECRET_KEY);
        h.update(data);
        return h.digest('hex');
    }

    request({ method = 'POST', scope = this.ENV, url: fn, params = {}, json = true, signed = true }) {
        if (signed) {
            params.timestamp = Date.now();
            params.signature = this.sign(querystring.encode(params));
        }
        const query = querystring.encode(params);
        return new Promise((r, rj) => {
            let data = '';
            const { pathname: path, hostname } = new url.URL(this.URLS[scope].API);
            const opts = {
                protocol: 'https:',
                path: `${path}/${fn}${method !== 'POST' && query ? `?${query}` : ''}`,
                hostname,
                port: 443,
                method,
                headers: {
                    'X-MBX-APIKEY': this.#API_KEY
                }
            };
            const req = https.request(opts, res => {
                let out = '';
                res.on('data', c => out += c);
                res.on('end', () => r(json ? JSON.parse(out) : out));
            }).on('error', rj);
            req.write(data);
            req.end();
        });
    }

    ticker = () => this.request({ url: 'v3/ticker/24hr', env: 'main', method: 'GET', signed: false });

    topVolumeSymbols = async (limit = 10) => {
        const rows = await this.ticker();
        return rows
            .sort((a, b) => b.volume * 1 - a.volume * 1)
            .slice(0, limit).map(one => one.symbol);
    }

    initListenKey = async () => {
        const data = await this.request({ url: 'v3/userDataStream', method: 'POST' });
        this.listenKey = data.listenKey;
        setInterval(() => this.request({ url: 'v3/userDataStream', method: 'PUT', signed: false, params: { listenKey } }), 59 * 60 * 1000);
        return this.listenKey;
    }

    userData = () => this.request({ url: 'v3/account', method: 'GET' });

    getBalances = async () => {
        const { balances } = await this.userData();
        return balances.reduce(
            (all, { asset, free, locked }) => ((all.set(asset, { free, locked }), all), all),
            new Map()
        );
    };
}

module.exports = Api;
