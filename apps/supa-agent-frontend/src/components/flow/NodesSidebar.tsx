"use client";

import { useFlowContext } from "@/contexts/FlowContext";
import { useRef, useState } from "react";
import CategorySection from "./CategorySection";

export default function NodesSidebar() {
  const { categories, addNode } = useFlowContext();

  // Local state for search and category selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categorySectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter categories based on search query
  const filteredCategories = searchQuery
    ? categories.filter(
        (category) =>
          category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          category.nodeTypes.some((type) =>
            type.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : categories;

  return (
    <div className="w-64 bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-medium text-lg">Flow Nodes</h2>
        <div className="mt-2">
          <input
            type="text"
            placeholder="Search nodes..."
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Quick navigation tabs - only show when not searching */}
        {!searchQuery && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-2 py-1 text-xs rounded-md whitespace-nowrap ${
                  selectedCategory === category.name
                    ? "bg-blue-100 text-blue-600 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-y-auto h-full">
        {filteredCategories.map((category, catIndex) => (
          <CategorySection
            key={catIndex}
            category={category}
            onAddNode={addNode}
            ref={(el) => {
              categorySectionRefs.current[category.name] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}
