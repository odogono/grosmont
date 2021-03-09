import {site, log, useServerEffect, processEntity, processEntities, runQuery} from '@site';
import { useState } from 'react';


export default () => {

    const [data, setData] = useState([]);

    useServerEffect( async () => {        
        // const e = await processEntity( 'file:///weeknotes/2021-01-01.mdx', {applyLayout:false} );

        // select eids which are tagged weeknotes
        let eids = await site.findByTags([ 'weeknotes'] );
        const q = `
        [
            $eids
            /component/date#/date !ca desc order
            4 0 limit
            [/component/title /component/mdx] !bf
            @eid
        ] select`;

        // run a query to select a max of 4 eids in date descending order
        eids = await runQuery(q, {eids});

        // process the eids and capture their output
        const ents = await processEntities( eids, ['/component/output', '/component/title', '/component/date'], {applyLayout:false} );

        let result = [];
        for( const e of ents ){
            // log('e', e.Title.title );
            // result.push( <div key={e.id} dangerouslySetInnerHTML={{__html: e.Output.data}} /> );
            result.push(<div>
                <div>{e.Title.title}</div>
                <div>{e.Date.date}</div>
                <div>{e.Title.summary}</div>
            </div>)
        }
        // log('here are the coms', coms );
        // setData(e.Output.data);
        setData( result );
    });

    return <div>{data}</div>;
}