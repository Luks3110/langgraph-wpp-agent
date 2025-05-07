import { ReactNode } from "react";

export interface NodePropertyProps {
  label: string;
  value?: string | number | ReactNode;
  defaultValue?: string;
  status?: "success" | "warning" | "error" | "info" | "default";
}

export default function NodeProperty({
  label,
  value,
  defaultValue = "Not set",
  status,
}: NodePropertyProps) {
  const displayValue = value !== undefined ? value : defaultValue;

  let textColorClass = "font-medium";
  if (status) {
    switch (status) {
      case "success":
        textColorClass = "font-medium text-green-600";
        break;
      case "warning":
        textColorClass = "font-medium text-yellow-600";
        break;
      case "error":
        textColorClass = "font-medium text-red-600";
        break;
      case "info":
        textColorClass = "font-medium text-blue-600";
        break;
      default:
        textColorClass = "font-medium";
    }
  }

  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span className={textColorClass}>{displayValue}</span>
    </div>
  );
}
