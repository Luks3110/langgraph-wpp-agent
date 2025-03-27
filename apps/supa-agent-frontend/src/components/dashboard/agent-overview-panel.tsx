"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Bot,
  Edit,
  MoreHorizontal,
  Pause,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Mock data for agents
const mockAgents = [
  {
    id: "1",
    name: "Customer Support Agent",
    status: "active",
    type: "support",
    department: "Customer Service",
    lastModified: "2023-10-15T14:30:00Z",
    conversations: 1245,
    satisfaction: 92,
    needsAttention: false,
  },
  {
    id: "2",
    name: "Sales Assistant",
    status: "active",
    type: "sales",
    department: "Sales",
    lastModified: "2023-10-12T09:15:00Z",
    conversations: 876,
    satisfaction: 88,
    needsAttention: false,
  },
  {
    id: "3",
    name: "HR Onboarding Guide",
    status: "inactive",
    type: "hr",
    department: "Human Resources",
    lastModified: "2023-09-28T11:45:00Z",
    conversations: 324,
    satisfaction: 90,
    needsAttention: false,
  },
  {
    id: "4",
    name: "Technical Support Specialist",
    status: "maintenance",
    type: "support",
    department: "IT Support",
    lastModified: "2023-10-10T16:20:00Z",
    conversations: 932,
    satisfaction: 85,
    needsAttention: true,
  },
  {
    id: "5",
    name: "Product Recommendation Bot",
    status: "development",
    type: "marketing",
    department: "Marketing",
    lastModified: "2023-10-14T13:10:00Z",
    conversations: 0,
    satisfaction: 0,
    needsAttention: false,
  },
];

export default function AgentOverviewPanel() {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  // Filter and sort agents
  const filteredAgents = mockAgents.filter((agent) => {
    if (filter === "all") return true;
    return agent.status === filter;
  });

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "modified")
      return (
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
    if (sortBy === "performance") return b.satisfaction - a.satisfaction;
    return 0;
  });

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive" },
      development: {
        color: "bg-blue-100 text-blue-800",
        label: "In Development",
      },
      maintenance: {
        color: "bg-yellow-100 text-yellow-800",
        label: "Maintenance",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] ||
      statusConfig.inactive;

    return (
      <span
        className={`${config.color} text-xs font-medium px-2.5 py-0.5 rounded-full`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Agent Overview</CardTitle>
            <CardDescription>Manage and monitor your AI agents</CardDescription>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Sort:{" "}
                  {sortBy === "name"
                    ? "Name"
                    : sortBy === "modified"
                      ? "Recently Modified"
                      : "Performance"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy("name")}>
                  Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("modified")}>
                  Recently Modified
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("performance")}>
                  Performance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/dashboard/agents/create" passHref>
              <Button variant="default" size="sm">
                <Bot className="h-4 w-4 mr-1" /> New Agent
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full" onValueChange={setFilter}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Agents</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="development">In Development</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="active" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="development" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="inactive" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    status: string;
    type: string;
    department: string;
    lastModified: string;
    conversations: number;
    satisfaction: number;
    needsAttention: boolean;
  };
}

function AgentCard({ agent }: AgentCardProps) {
  const statusConfig = {
    active: { color: "bg-green-100 text-green-800", label: "Active" },
    inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive" },
    development: {
      color: "bg-blue-100 text-blue-800",
      label: "In Development",
    },
    maintenance: {
      color: "bg-yellow-100 text-yellow-800",
      label: "Maintenance",
    },
  };

  const config =
    statusConfig[agent.status as keyof typeof statusConfig] ||
    statusConfig.inactive;

  return (
    <div className="bg-white border rounded-lg p-4 relative">
      {agent.needsAttention && (
        <div className="absolute top-2 right-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 h-10 w-10 rounded-full flex items-center justify-center">
            <Bot className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.department}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <span
          className={`${config.color} text-xs font-medium px-2.5 py-0.5 rounded-full`}
        >
          {config.label}
        </span>

        <div className="text-xs text-muted-foreground">
          {agent.conversations > 0
            ? `${agent.conversations.toLocaleString("pt-BR")} conversations`
            : "No conversations yet"}
        </div>
      </div>

      {agent.satisfaction > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span>Satisfaction</span>
            <span className="font-medium">{agent.satisfaction}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{ width: `${agent.satisfaction}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-4">
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            {agent.status === "active" ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Test Agent</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
