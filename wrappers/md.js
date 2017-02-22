import React from 'react';
import Fecha from 'fecha';
import Helmet from 'react-helmet';
import ReadNext from '../components/read_next';
import { rhythm } from 'utils/typography';
import { config } from 'config';
import Bio from 'components/bio';

import '../css/zenburn.css';

export default class MarkdownWrapper extends React.Component {
    render() {
        const { route } = this.props;
        const post = route.page.data;

        const date = post.date
            ? Fecha.parse(post.date, 'YYYY-MM-DDTHH:mm:ss.SSSZ')
            : new Date();

        const postDate = Fecha.format(date, 'MMMM D, YYYY');

        const postStyle = { display: 'block', marginBottom: rhythm(2) };

        return (
            <div className="markdown">
                <Helmet title={`${post.title} | ${config.blogTitle}`} />
                <h1 style={{ marginTop: 0 }}>{post.title}</h1>
                <div dangerouslySetInnerHTML={{ __html: post.body }} />
                <em style={postStyle}>Posted {postDate}</em>
                <hr style={{ marginBottom: rhythm(2) }} />
                <ReadNext post={post} pages={route.pages} />
                <Bio />
            </div>
        );
    }
}

MarkdownWrapper.propTypes = {
    route: React.PropTypes.object
};
