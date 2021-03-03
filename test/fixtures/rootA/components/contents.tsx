import {site} from '@odgn/grosmont';



export default async () => {
    const eids = await site.findByTags([ 'weeknotes'] );

    <div>
        <div>Contents</div>
    </div>

};