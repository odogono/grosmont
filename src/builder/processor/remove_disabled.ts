import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { selectDependencies, selectDirDependencies } from "./file_deps";
import { selectMetaDisabled } from "./read_dir_meta";


export async function process(es: EntitySet) {

    // select entities which have Meta with enabled set to false
    const disabled = await selectMetaDisabled( es );

    // using the disabled entities, select entities that belong underneath
    // in the file hierarchy
    let contents = await selectDirDependencies( es, disabled );


    let removeEids = Array.from(new Set([...disabled,...contents]));

    // select dependency entities which feature any of the removed entities
    const removeDepEids = await selectDependencies(es, removeEids);

    removeEids = Array.from(new Set([...removeEids,...removeDepEids]));

    // log('removing A', es.uuid, (es as EntitySetMem).entities ); //entChanges.removed );

    // remove all the entities
    es = await es.removeEntity( removeEids );

    // log('removing B', es.uuid, (es as EntitySetMem).entities ); //entChanges.removed );
    // log('  added', es.entChanges.added );

    return es;
}

const log = (...args) => console.log('[RemoveDisabledProc]', ...args);