import { Entity } from 'odgn-entity/src/entity';
import { EntitySet } from 'odgn-entity/src/entity_set';
import './styles';


export default ({ InlineCSS, e, deps, es, site, ...args }) => {

    return <>
        <InlineCSS />
        {processDeps(es, e, deps)}
    </>;
}


function processDeps(es: EntitySet, e: Entity, deps:Entity[]) {
    return <details className="deps" open={true}>
        <summary>Dependencies Of {e.id}</summary>
        { deps !== undefined ?
            deps.map( dep => depToElement(es, e, dep))
            : null
        }
    </details>
}

function depToElement( es:EntitySet, e:Entity, dep:Entity ){
    const com = dep.Dep;
    if( com === undefined ){
        return null;
    }
    const { '@d': did, '@e': eid, src, type } = com;

    let dstSrc = dep.Meta?.meta.dstSrc ?? '';

    return <div key={dep.id} className="dep">
        <div className="e"><a href={`/_e/${src}`}>{src}</a></div>
        <div>←</div>
        <div className="type">{type}</div>
        <div className="url">{dstSrc}</div>
    </div>

}