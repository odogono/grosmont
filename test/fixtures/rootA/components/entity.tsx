import {site, es, log, useServerEffect} from '@site';
import { Entity } from 'odgn-entity/src/entity';
import { useState } from 'react';

export default ({eid}) => {
    const [e, setE] = useState();
    // const [weeknoteEids, setWeeknoteEids] = useState([]);

    useServerEffect( async () => {
        const e = await es.getEntity(eid, true);
        // const eids = await site.findByTags([ 'weeknotes'] );
        // setWeeknoteEids(eids);
        setE( e );
    }, []);

    return <div>
        <div>Entity {eid} !!</div>
        
    </div>
};