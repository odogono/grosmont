import unistRemove from 'unist-util-remove';

export function removeCommentPlugin() {
    return (tree, file) => {
        unistRemove(tree, { cascade: false }, (node, idx, parent) => {
            if (node.type === 'paragraph') {
                const exists = node.children.filter(node => node.type === 'text' && node.value.trim().startsWith('//'));
                if (exists.length > 0) {
                    // console.log('[removeCommentPlugin]', node);
                    return true;
                }
            }
            return false;
        });
    }
};
