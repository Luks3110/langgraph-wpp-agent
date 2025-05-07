# Workflow Node Component System

This directory contains components for rendering workflow nodes in the agent workflow builder UI.

## Component Architecture

The node component system is built with reusability and maintainability in mind, using a layered approach:

1. **BaseNode**: Core container component providing standard layout and handle positioning
2. **NodeProperty**: Reusable component for displaying property key-value pairs
3. **Specific Node Components**: Specialized components for different node types

## BaseNode

The `BaseNode` component provides a standardized layout and styling for all node types. It handles:

- Consistent styling and dimensions
- Handle positions for connections
- Node header with icon and title
- Description section
- Content container for node-specific information

### Props

```typescript
export interface BaseNodeProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  children: ReactNode;
}
```

## NodeProperty

The `NodeProperty` component standardizes the display of property key-value pairs within nodes.

### Props

```typescript
export interface NodePropertyProps {
  label: string;
  value?: string | number | ReactNode;
  defaultValue?: string;
  status?: "success" | "warning" | "error" | "info" | "default";
}
```

## Creating New Node Types

To create a new node type:

1. Define a typed interface for the node's data
2. Create a new component that uses `BaseNode`
3. Use `NodeProperty` components for displaying properties

### Example

```tsx
import { Bot } from "lucide-react";
import BaseNode from "./BaseNode.js";
import NodeProperty from "./NodeProperty.js";

export interface MyNodeData {
  propertyA?: string;
  propertyB?: string;
  [key: string]: any;
}

export default function MyNode({ data }: { data: MyNodeData }) {
  return (
    <BaseNode
      title="My Node Type"
      description="Description of what this node does"
      icon={Bot}
      iconBgColor="bg-purple-100"
      iconColor="text-purple-600"
    >
      <NodeProperty 
        label="Property A" 
        value={data.propertyA} 
      />
      <NodeProperty 
        label="Property B" 
        value={data.propertyB} 
        status="success" 
      />
    </BaseNode>
  );
}
``` 
