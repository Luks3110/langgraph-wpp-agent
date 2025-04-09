"use client";

import { useNodeCategories } from "@/hooks/flow/useNodeCategories";
import NodeItem from "./NodeItem";

interface CategorySectionProps {
  category: { id: string; name: string; nodeTypes: string[] };
  onAddNode: (nodeType: string, position?: { x: number; y: number }) => void;
  ref: React.RefObject<HTMLDivElement>;
}

const CategorySection = ({
  category,
  onAddNode,
  ref,
}: CategorySectionProps) => {
  const { nodeCategories } = useNodeCategories();

  // Find the original category data
  const originalCategory = nodeCategories.find(
    (cat) => cat.title === category.name
  );

  if (!originalCategory) return null;

  return (
    <div ref={ref} className="p-4 border-b last:border-0">
      <h3 className="text-xs font-medium text-gray-500 mb-3">
        {category.name}
      </h3>
      <div className="space-y-2">
        {originalCategory.nodes.map((node, nodeIndex) => (
          <NodeItem
            key={nodeIndex}
            node={node}
            onAdd={() => onAddNode(node.type)}
          />
        ))}
      </div>
    </div>
  );
};

CategorySection.displayName = "CategorySection";
export default CategorySection;
