import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';

import { addMdx, beforeEach, process } from '../../helpers';

const test = suite('/processor/js/use_se');
const log = (...args) => console.log(`[${suite.name}]`, ...args);


test.before.each(beforeEach);



test('use', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.jsx', `

    export const dst = 'main.html';
    
    import { useState } from 'react';
    import { useServerEffect } from '@site';

    export default () => {
        const [count, setCount] = useState(0);

        useServerEffect( async () => {
            await new Promise(res => setTimeout(res, 10));
            setCount(5);
            return 5;
        }, []);

        return <div>Count is {count}</div>
    }
    `);

    await process(site,options);
    

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.jsx');

    assert.equal(e.Output.data,
        `<div>Count is 5</div>`);
});




test.run();
