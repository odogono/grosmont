import { QueryableEntitySet } from "../../es";
import { selectMetaDisabled } from "../query";
// import { selectDependencies, selectDirDependencies } from "./file_deps";


export async function process(es: QueryableEntitySet) {

    // select entities which have Meta with enabled set to false
    const disabled = await selectMetaDisabled( es );

    // using the disabled entities, select entities that belong underneath
    // in the file hierarchy
    let contents = undefined; //await selectDirDependencies( es, disabled );


    let removeEids = Array.from(new Set([...disabled, ...contents]));

    // select dependency entities which feature any of the removed entities
    const removeDepEids = undefined; //await selectDependencies(es, removeEids);

    removeEids = Array.from(new Set([...removeEids,...removeDepEids]));


    // remove all the entities
    es = await es.removeEntity( removeEids ) as QueryableEntitySet;

    // log('removing B', es.uuid, (es as EntitySetMem).entities ); //entChanges.removed );
    // log('  added', es.entChanges.added );

    return es;
}

const log = (...args) => console.log('[RemoveDisabledProc]', ...args);