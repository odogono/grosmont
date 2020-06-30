import unistRemove from 'unist-util-remove';

export function removeCommentPlugin() {
    return (tree, file) => {
        unistRemove(tree, { cascade: false }, (node, idx, parent) => {
            // console.log('[removeCommentPlugin]', node);
            if( node.type === 'html' ){
                if( /<!--(.*?)-->/.test(node.value) ){
                    // console.log('[removeCommentPlugin]', node);
                    return true;
                }
            }
            else if (node.type === 'paragraph') {
                const exists = node.children.filter(node => node.type === 'text' && node.value.trim().startsWith('//'));
                if (exists.length > 0) {
                    return true;
                }
            }
            return false;
        });
    }
};
