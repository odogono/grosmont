import React from 'react';
import { Link } from 'react-router';
import sortBy from 'lodash/sortBy';
import { prefixLink } from 'gatsby-helpers';
import { rhythm } from 'utils/typography';
import Helmet from 'react-helmet';
import Access from 'safe-access';
import { config } from 'config';
import include from 'underscore.string/include';
import Bio from 'components/bio';

class BlogIndex extends React.Component {
    render() {
        const pageLinks = [];
        
        // Sort pages.
        const sortedPages = sortBy(this.props.route.pages, page =>
            Access(page, 'data.date')).reverse();
        
        sortedPages.forEach(page => {
            if (
                Access(page, 'file.ext') === 'md' && !include(page.path, '/404')
            ) {
                const title = Access(page, 'data.title') || page.path;
                pageLinks.push(
                    <li
                        key={page.path}
                        style={{
                            marginBottom: rhythm(1 / 4)
                        }}
                    >
                        <Link
                            style={{ boxShadow: 'none' }}
                            to={prefixLink(page.path)}
                        >
                            {title}
                        </Link>
                    </li>
                );
            }
        });
        return (
            <div>
                <Helmet
                    title={config.blogTitle}
                    meta={[
                        { name: 'description', content: 'Sample blog' },
                        { name: 'keywords', content: 'blog, articles' }
                    ]}
                />
                <Bio />
                <ul>
                    {pageLinks}
                </ul>
            </div>
        );
    }
}

BlogIndex.propTypes = {
    route: React.PropTypes.object
};

export default BlogIndex;
