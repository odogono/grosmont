import './styles';
import { exportEntity } from 'odgn-entity/src/util/export/json';
import { Entity } from 'odgn-entity/src/entity';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { stringify, truncate } from '@odgn/utils';

// export const dst = 'entity.html';

export default ({ InlineCSS, e, es, site, ...args }) => {

    return <>
        <InlineCSS />
        {entityTo(es, e)}
    </>;
}


function entityTo(es: EntitySet, e: Entity) {

    const json = exportEntity(es, e, { comName: true });
    // let result = [];
    let coms = [];
    for (const com of json.components) {
        const { '@d': did, '@dn': name, ...attrs } = com;
        coms.push({ name, did, attrs });
    }

    return <details className="entity" open={true}>
        <summary>e{json.id}</summary>
        {coms.map( ({did,name,attrs}, idx ) => 
            <div key={did} className="component" style={{backgroundColor: (idx%2) === 0 ? '#CCC':'#DDD'}}>
            <div className="name">{name}</div>
            {Object.entries(attrs).map( ([attr,val]) => (
                <>
                <div className="attr">{attr}</div>
                <div className="val">{ stringify(val) }</div>
                </>
            ))}
        </div>
        )}
    </details>;
}
