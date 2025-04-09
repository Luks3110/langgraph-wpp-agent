import { NodeCategory } from '@/utils/flow-types';
import { useMemo, useState } from 'react';

export function useSearchFilter(nodeCategories: NodeCategory[]) {
    const [searchQuery, setSearchQuery] = useState("");

    // Filter categories based on search query
    const filteredCategories = useMemo(() => {
        if (!searchQuery) return nodeCategories;

        return nodeCategories.map(category => ({
            ...category,
            nodes: category.nodes.filter(node =>
                node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })).filter(category => category.nodes.length > 0);
    }, [nodeCategories, searchQuery]);

    return {
        searchQuery,
        setSearchQuery,
        filteredCategories
    };
} 
