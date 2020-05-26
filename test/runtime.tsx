import { assert } from 'chai';
import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import React from 'react'
import MDX from '@mdx-js/runtime'
import ReactDOMServer from 'react-dom/server';



describe('Runtime', () => {

    it('creates from values', async () => {

        const components = {
            h1: props => <h1 style={{ color: 'tomato'}} { ...props } />,
            Demo: props => <h1>This is a demo component </h1>
            }


// Provide variables that might be referenced by JSX
const scope = {
    some: 'value'
}

const mdx = `
# Hello, world!

<Demo />
`

    const runit = () => (
        <MDX components= { components } scope = { scope } >
        { mdx }
        </MDX>
    );

    const html = ReactDOMServer.renderToStaticMarkup( 
        <MDX components= { components } scope = { scope } >
        { mdx }
        </MDX>
     );

    console.log( html );

    });

});