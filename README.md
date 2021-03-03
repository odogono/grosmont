# Grosmont SSG

Grosmont is a Static Site Generator written in nodejs.

- static site generation
- MDX pages
- straightforward mounting of preact components
- PostCSS, with possibly Tailwind


## How to Create a New Post

TODO

## Frontmatter Fields

TODO


## Refs

[I Built My Own Shitty Static Site Generator](https://news.ycombinator.com/item?id=25227181)

[GoatCounter - Easy web analytics](https://www.goatcounter.com)

[Tiny websites are great](https://news.ycombinator.com/item?id=23228904)

[Improving My Next.js MDX Blog](https://leerob.io/blog/mdx)

[Preact - Server-Side Rendering](https://preactjs.com/guide/v10/server-side-rendering)

[Tachyons CSS framework](https://tachyons.io)

[Devii - A developer blog starter](https://github.com/colinhacks/devii)

[Frog is a static web site generator written in Racket.](https://github.com/greghendershott/frog)


### Build Parent Dependencies
/processor/build_deps

Inserts 'dir' dependencies for all /component/src with a file:// url



### Site Entity

entity is defined with a source Dir, a Target directory, and optional patterns of files to include


### Source Dir Scan

entities for every applicable dir and file found in the Dir created along with timestamps


### Source Dir Dependencies

dependency entities are created for files and dirs using uri paths


### Dir Meta Read

dir.e.yaml is read inside directories


### Disabled Dirs/Files removed

dir meta may indicate paths that are disabled. entities falling within this rule are removed


### Assign Type Components

using file extensions, type Components are assigned


### Process SCSS

- scss processor is run to create Text component


### Process MDX

- process meta 
  - if the mdx has dir deps, then meta is inherited
- apply title
- resolve links to css
  - css can be included in one of several ways
    - another entity can be imported into the mdx using import statements
    - using the <InlineCSS /> tag - this inlines the css in the mdx page
    - a css link tag can be built and populated using the pages css deps
- resolve page links
- resolve layout
- render to html, creating a Text component

import statements can occur within.


### Generate Target Path

possibly a processor by itself? useful for a live server. 

/component/target is used to specify the target path, and is set already

result target path is generated on demand


### Clear target


### Output

runs over entities with Text, or Static components

- target path is determined
- files are copied to the Target





### Changes to an entity

- looks for entities with an updated mtime on Stat

- build list of entities to process using dependency tree
  
- runs processors on those entities


### Selecting Target Path

looks for Target uri on the entity and if not found looks up the directories.


### Live server

serves directly from entity tree by generating on demand without creating

BUT. how is a requested path known? It would have to be determined in advance by running through all the entities

### Meta

isEnabled

isRenderable - whether the content will be rendered to target

dstPath - specifies output path

inReview

layout - specifies path to layout


title - page title

description

tags - array of strings