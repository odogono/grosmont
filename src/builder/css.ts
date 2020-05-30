import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import PostCSS from 'postcss';
import PreCSS from 'precss';


import { BuildContext, Page, pageSrcPath, pageDstPath } from "./context";




export async function transformCSS( ctx: BuildContext, page:Page ){
    const from = pageSrcPath(ctx, page);
    const to = pageDstPath(ctx, page);
    const css = await Fs.readFile(from, 'utf8');

    console.log('[transformCSS]', page.path, to );
    
    const result = await PostCSS([PreCSS]).process(css, {from,to});

    console.log('[transformCSS]', result);
}