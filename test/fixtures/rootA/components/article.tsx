import {site, log, useServerEffect, renderEntity} from '@site';
import { useState } from 'react';


export default () => {

    const [data, setData] = useState('');

    useServerEffect( async () => {        
        const e = await renderEntity( 'file:///weeknotes/2021-01-01.mdx', {applyLayout:false} );

        setData(e.Output.data);
    });

    return <div dangerouslySetInnerHTML={{__html: data}}></div>;
}