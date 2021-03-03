import {site} from '@odgn-ssg';

export const mime = 'text/xml';
export const dst = '/sitemap.xml';

const url = site.getUrl();

export default () => (

    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
            <loc>{`${url}sitemap1.xml.gz`}</loc>
            <lastmod>2014-10-01T18:23:17+00:00</lastmod>
        </sitemap>
    </sitemapindex>
);
