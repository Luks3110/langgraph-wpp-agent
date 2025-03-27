import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Upload,
  Wrench,
  Calendar,
  Settings,
  History,
  Share2,
} from "lucide-react";
import Link from "next/link";

export default function QuickActionPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/dashboard/agents/create" className="w-full">
            <Button
              variant="default"
              className="w-full h-auto py-4 px-3 flex flex-col items-center justify-center gap-2"
            >
              <Bot className="h-5 w-5" />
              <span className="text-xs font-medium">Create New Agent</span>
            </Button>
          </Link>

          <Link href="/dashboard/agents/create-flow" className="w-full">
            <Button
              variant="outline"
              className="w-full h-auto py-4 px-3 flex flex-col items-center justify-center gap-2"
            >
              <Share2 className="h-5 w-5" />
              <span className="text-xs font-medium">Create with Flowchart</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="w-full h-auto py-4 px-3 flex flex-col items-center justify-center gap-2"
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs font-medium">Import Config</span>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto py-4 px-3 flex flex-col items-center justify-center gap-2"
          >
            <Wrench className="h-5 w-5" />
            <span className="text-xs font-medium">Run Diagnostics</span>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto py-4 px-3 flex flex-col items-center justify-center gap-2"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-medium">Scheduled Tasks</span>
          </Button>
        </div>

        <h3 className="text-sm font-medium mb-3">Recently Accessed</h3>
        <div className="space-y-2">
          {[
            { name: "Customer Support Agent", time: "2 hours ago" },
            { name: "Sales Assistant", time: "Yesterday" },
            { name: "Technical Support Specialist", time: "2 days ago" },
          ].map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                <span className="text-sm">{item.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between">
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            <Settings className="h-3.5 w-3.5" />
            <span className="text-xs">Settings</span>
          </Button>

          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            <span className="text-xs">History</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
