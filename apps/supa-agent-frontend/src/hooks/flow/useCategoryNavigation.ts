import { useEffect, useRef, useState } from 'react';

export function useCategoryNavigation() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const categorySectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Scroll to selected category
    useEffect(() => {
        if (selectedCategory && categorySectionRefs.current[selectedCategory]) {
            categorySectionRefs.current[selectedCategory]?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [selectedCategory]);

    // Handle category selection and scrolling
    const handleCategorySelect = (categoryTitle: string) => {
        setSelectedCategory(categoryTitle);
        if (categorySectionRefs.current[categoryTitle]) {
            categorySectionRefs.current[categoryTitle]?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    };

    return {
        selectedCategory,
        setSelectedCategory: handleCategorySelect,
        categorySectionRefs
    };
} 
