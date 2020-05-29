

- [ ] allow output path to be set from page meta

- [ ] read page meta from directory config file - pages still override

- [ ] setup dev server with live reload for pages (sse)

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
