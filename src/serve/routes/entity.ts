import { toInteger } from "@odgn/utils";
import { Site } from "../../builder/site";
import { SiteProcessor } from "../../builder/types";
import { sseClientIdHeader, sseClientScript } from "./sse";
import { buildEntityDepsDisplay, buildEntityDepsOfDisplay, buildEntityDisplay } from "../util";
import { RoutesConfig } from "../index";


export default async function routes(app, { config: { site, process, processOutput } }: RoutesConfig) {

    app.get('/dst_index', async (req, reply) => {
        const idx = site.getDstIndex();

        return idx;
    });

    app.get('/_e/:eid', async (req, reply) => {
        const eid = toInteger(req.params.eid);

        const e = site.es.getEntity(eid, false);

        if (e === undefined) {
            return reply.code(404).send(`Entity ${eid} not found`);
        }

        let output = [];
        let outputEntry = await site.getEntityOutput(eid);
        let path = await site.getEntityDstUrl(eid);
        let type = 'text/html';

        if (outputEntry !== undefined) {
            let [data, mime] = outputEntry;
            // type = mime ?? type;
            output.push(data);
        }

        // console.info(`!!!! ${path} ${eid} ${type}`);

        output.push(await buildEntityDisplay(site, processOutput, eid));
        output.push(await buildEntityDepsDisplay(site, processOutput, eid));
        output.push(await buildEntityDepsOfDisplay(site, processOutput, eid));
        output.push(sseClientIdHeader(eid, path));
        output.push(sseClientScript);

        return reply.type(type).send(output.join('\n'));
    });

    app.get('*', async (req, reply) => {
        let path = req.url;

        let eid = site.getEntityIdByDst(path);

        if (eid === undefined && path.endsWith('/')) {
            path = path + 'index.html';
            eid = site.getEntityIdByDst(path);
        }

        if (eid === undefined) {
            return reply.code(404).send('not found');
        }

        let output = [];

        let outputEntry = await site.getEntityOutput(eid);

        if (outputEntry === undefined) {
            return reply.code(404).send(`/output not found for ${eid}`);
        }

        let [data, mime] = outputEntry;

        req.log.info(`${path} ${eid} ${mime}`);

        output.push(data);

        if (mime === 'text/html') {
            output.push(await buildEntityDisplay(site, processOutput, eid));
            output.push(await buildEntityDepsDisplay(site, processOutput, eid));
            output.push(await buildEntityDepsOfDisplay(site, processOutput, eid));
            output.push(sseClientIdHeader(eid, path));
            output.push(sseClientScript);
        }

        // console.log('output:', output);
        return reply.type(mime).send(output.join('\n'));

    })
}
