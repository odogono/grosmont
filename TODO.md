

12 Jan 21

- move from the File component to the Url component. Its not Uri because it typically shows where the entity is located. The trick now of course is that the ability to quickly id files (when matching to dirs) is lost. Well not lost, but it becomes tricker because the component attribute needs to be looked at to check whether its a file. meh.








- [x] allow output path to be set from page meta

- [x] read page meta from directory config file - pages still override

- [x] cope with regular html - should just copy to dst

- [x] single file based update instead of dir scan - take single file and find its dependencies to include in page list

- [ ] setup dev server with live reload for pages (sse)
    this relies on tracking which files change

- [ ] create slug from page title

- [x] add css - processed with postcss

- [x] inline css - extract from the mdx and dump to local file

- [ ] inline svg

- [ ] rss

- [ ] [sitemap](https://en.wikipedia.org/wiki/Sitemaps)
 
- [ ] design main layout for blog

- [ ] date page meta read from file mtime if not defined

- [ ] introduce odgn-entity

    compile entities from the files and store in sql es

    interpret queries inline in pages

    /component/title
    /component/description
    /component/file - createdAt, modifiedAt, input path, output path, relative extension
    /component/content - page src
    /component/status - published/public/deleted/inactive
    /component/css - ref to css files?
    /component/link - url, description, createdAt (probably its own entity)
    /component/category - an array of tags/categories associated
    /component/dependencies - array of eid linking to pages which this is dependent on