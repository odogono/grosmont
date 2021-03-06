import { buildSrcIndex } from "../query";
import { Site } from "../site";
import { ProcessOptions } from "../types";



export async function process(site:Site, options:ProcessOptions = {} ){
    return await buildSrcIndex(site);
}