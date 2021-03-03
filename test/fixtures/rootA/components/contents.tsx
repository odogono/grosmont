import {site, log, useServerEffect} from '@site';
import { useState } from 'react';

export default () => {

    const [weeknoteEids, setWeeknoteEids] = useState([]);

    useServerEffect( async () => {
        const eids = await site.findByTags([ 'weeknotes'] );
        setWeeknoteEids(eids);
    }, []);

    return <div>
        <div>Contents {JSON.stringify(weeknoteEids)}</div>
    </div>
};