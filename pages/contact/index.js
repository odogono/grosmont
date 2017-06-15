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

export default class ContactIndex extends React.Component {
    render() {
        return (
            <div>
                <Helmet
                    title="Contact"
                    meta={[
                        { name: 'description', content: 'Sample blog' },
                        { name: 'keywords', content: 'blog, articles' }
                    ]}
                />
                <p>Email hello@opendoorgonorth.com</p>
                <p>Follow on Twitter</p>
                <p>Like on Facebook</p>
                <p>Connect on Linkedin</p>
                <p>Follow on Pinterest</p>
            </div>
        );
    }
}
