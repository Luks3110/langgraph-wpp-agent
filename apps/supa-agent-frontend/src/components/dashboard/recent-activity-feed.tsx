import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, UserCircle, Settings, RefreshCw, Play, Edit } from "lucide-react";

// Mock data for recent activities
const recentActivities = [
  {
    id: "1",
    type: "agent_created",
    agent: "Product Recommendation Bot",
    user: "John Smith",
    timestamp: "2023-10-15T14:30:00Z",
  },
  {
    id: "2",
    type: "agent_modified",
    agent: "Customer Support Agent",
    user: "Emily Johnson",
    timestamp: "2023-10-15T13:15:00Z",
  },
  {
    id: "3",
    type: "agent_deployed",
    agent: "Sales Assistant",
    user: "Michael Brown",
    timestamp: "2023-10-15T11:45:00Z",
  },
  {
    id: "4",
    type: "settings_changed",
    agent: null,
    user: "Sarah Wilson",
    timestamp: "2023-10-15T10:20:00Z",
  },
  {
    id: "5",
    type: "agent_paused",
    agent: "Technical Support Specialist",
    user: "David Lee",
    timestamp: "2023-10-14T16:50:00Z",
  },
];

export default function RecentActivityFeed() {
  // Function to format timestamp to relative time
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  // Function to get icon based on activity type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "agent_created":
        return <Bot className="h-4 w-4 text-blue-600" />;
      case "agent_modified":
        return <Edit className="h-4 w-4 text-yellow-600" />;
      case "agent_deployed":
        return <Play className="h-4 w-4 text-green-600" />;
      case "settings_changed":
        return <Settings className="h-4 w-4 text-purple-600" />;
      case "agent_paused":
        return <RefreshCw className="h-4 w-4 text-red-600" />;
      default:
        return <UserCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  // Function to get activity description
  const getActivityDescription = (activity: (typeof recentActivities)[0]) => {
    switch (activity.type) {
      case "agent_created":
        return `created a new agent "${activity.agent}"`;
      case "agent_modified":
        return `modified the agent "${activity.agent}"`;
      case "agent_deployed":
        return `deployed the agent "${activity.agent}"`;
      case "settings_changed":
        return `changed platform settings`;
      case "agent_paused":
        return `paused the agent "${activity.agent}"`;
      default:
        return "performed an action";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest actions in your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="flex gap-3">
              <div className="mt-0.5">
                <div className="bg-gray-100 h-8 w-8 rounded-full flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-medium text-sm">{activity.user}</span>
                  <span className="text-sm text-muted-foreground">
                    {getActivityDescription(activity)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t text-center">
          <a href="#" className="text-sm text-primary hover:underline">
            View all activity
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
