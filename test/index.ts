import { assert } from 'chai';
import Path from 'path';
// import {transpile} from '../src/transpile';
import {transpile as transpileP} from '../src/preact';

describe('Pipleline', () => {

    it('creates from values', async () => {
        const root = Path.resolve(__dirname, "../");
        const filename = 'pages/index.mdx';
        const path = Path.resolve(root, filename);

        const out = await transpileP(path);
        // const out = await transpileAlt(Path.resolve(root, 'usr/footer.mdx'));

        console.log("Transpiled:");
        console.log(out);

    });

});
