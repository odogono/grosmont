import Util from 'util';
import Path from 'path';
import Fs from 'fs-extra';
import Day from 'dayjs';
import parseUrl from 'parseurl';

import { parseUri, toInteger } from "@odgn/utils";
import { EntityId } from 'odgn-entity/src/entity';
import { RoutesConfig } from '../index';



const clientHandlerPath = Path.join(__dirname, '../client.js');
// const debugHTMLPath = Path.join(__dirname, 'debug.html');

export const sseClientScript = '<script>' + Fs.readFileSync(clientHandlerPath, 'utf-8') + '</script>';


export function sseClientIdHeader(eid: EntityId, path: string) {
    return `
    <script>window.odgnServe = { eid: ${eid}, path:'${path}' };</script>
    `;
}


export default async function routes(app, { config: { emitter, site, process } }: RoutesConfig) {

    // https://stackoverflow.com/a/50594265/2377677
    app.get('/sse', async (req, res) => {
        
        let path = parseUrl(req).pathname;
        let query = parseUri(req.url).queryKey;

        let { e: rEid, path: rPath } = query;
        rEid = toInteger(rEid);

        req.log.info(`path ${Util.format(path)}` );
        req.log.info(`query ${Util.format(query)}`);

        
        const headers = {
            'Content-Type': 'text/event-stream',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache,no-transform',
            'x-no-compression': 1
          };
        res.raw.writeHead(200, headers);

        res.raw.on('close', () => {
            req.log.info('client closed');
        })

        emitter.on('sse', e => {
            const { event, ...rest } = e;
            res.raw.write(`event: ${event}\n`);
            res.raw.write("data: " + JSON.stringify(rest) + "\n\n")
            // setLocation(reporter, '/serve/sse');
            // info(reporter, `[/sse] ${e}`);
        });

        emitter.on('/serve/e/update', (updates) => {
            // setLocation(reporter, '/serve/e/update');
            // info(reporter, `${updates}`);
            const update = updates.find(([url, srcUrl, eid]) => eid === rEid);
            if (update !== undefined) {
                res.raw.write(`event: reload\n`);
                res.raw.write("data: " + JSON.stringify(update) + "\n\n");
            }
        });

        setTimeout(() => {
            res.raw.write(`event: initial\n`)
            res.raw.write('data: ' + JSON.stringify({ evt: 'connected' }) + '\n\n');
        }, 1000);

        heartbeat( res.raw );

        return res;
    })
}


function heartbeat(res) {
    // log('[heartbeat]');
    res.write("event: ping\n");
    res.write(`data: ${Day().toISOString()}\n\n`);
    setTimeout(() => heartbeat(res), 10000);
}