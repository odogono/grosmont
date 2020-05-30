import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';


import { BuildContext, Page, pageSrcPath, pageDstPath } from "./context";


export interface TransformCSSOptions {
    minify?: boolean;
}

export async function transformCSS( ctx: BuildContext, page:Page, options:TransformCSSOptions = {} ){
    const minify = options.minify ?? false;
    const from = pageSrcPath(ctx, page);
    const to = pageDstPath(ctx, page);
    const css = await Fs.readFile(from, 'utf8');

    const plugins = [
        PreCSS,
        GridKISS, 
        minify ? CSSNano : undefined
    ].filter(Boolean);

    // console.log('[transformCSS]', page.path, to );
    
    const result = await PostCSS(plugins).process(css, {from,to});

    page.content = result.css;

    // console.log('[transformCSS]', result);

    return page;
}