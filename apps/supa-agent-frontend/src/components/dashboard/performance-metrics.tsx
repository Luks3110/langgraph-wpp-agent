"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  BarChart3,
  PieChart,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PerformanceMetrics() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Key metrics across all agents</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="satisfaction">Satisfaction</TabsTrigger>
            <TabsTrigger value="performance">Agent Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Conversations"
                value="3,427"
                change="+12.5%"
                trend="up"
                description="vs. previous period"
              />
              <MetricCard
                title="Avg. Satisfaction"
                value="89%"
                change="+2.3%"
                trend="up"
                description="vs. previous period"
              />
              <MetricCard
                title="Response Accuracy"
                value="94%"
                change="-1.2%"
                trend="down"
                description="vs. previous period"
              />
              <MetricCard
                title="Avg. Response Time"
                value="1.8s"
                change="-0.3s"
                trend="up"
                description="vs. previous period"
              />
            </div>

            {/* Conversation Trend Chart */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">
                  Conversation Volume Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-64 w-full flex items-center justify-center bg-gray-50 rounded-md">
                  <div className="text-center">
                    <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Conversation trend visualization
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Agents */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">
                    Top Performing Agents
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {[
                      {
                        name: "Customer Support Agent",
                        score: 96,
                        conversations: 1245,
                      },
                      {
                        name: "Sales Assistant",
                        score: 92,
                        conversations: 876,
                      },
                      {
                        name: "HR Onboarding Guide",
                        score: 90,
                        conversations: 324,
                      },
                    ].map((agent, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="bg-blue-100 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.conversations} conversations
                            </p>
                          </div>
                        </div>
                        <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          {agent.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">
                    Needs Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {[
                      {
                        name: "Technical Support Specialist",
                        score: 85,
                        issue: "Long response times",
                      },
                      {
                        name: "Billing Assistant",
                        score: 82,
                        issue: "Accuracy issues",
                      },
                      {
                        name: "Product Inquiry Bot",
                        score: 78,
                        issue: "Low satisfaction",
                      },
                    ].map((agent, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="bg-red-100 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-red-600">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.issue}
                            </p>
                          </div>
                        </div>
                        <div className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          {agent.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conversations" className="mt-0">
            <div className="h-80 w-full flex items-center justify-center bg-gray-50 rounded-md">
              <div className="text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Conversation analytics visualization
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shows conversation volume, duration, and outcomes
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="satisfaction" className="mt-0">
            <div className="h-80 w-full flex items-center justify-center bg-gray-50 rounded-md">
              <div className="text-center">
                <PieChart className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  User satisfaction visualization
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shows satisfaction scores, feedback trends, and sentiment
                  analysis
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="mt-0">
            <div className="h-80 w-full flex items-center justify-center bg-gray-50 rounded-md">
              <div className="text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Agent performance comparison
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shows relative performance across agents with key metrics
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  description: string;
}

function MetricCard({
  title,
  value,
  change,
  trend,
  description,
}: MetricCardProps) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="flex items-baseline mt-1">
        <h3 className="text-2xl font-bold">{value}</h3>
        <span
          className={`ml-2 text-xs font-medium flex items-center ${trend === "up" ? "text-green-600" : "text-red-600"}`}
        >
          {trend === "up" ? (
            <ArrowUpRight className="h-3 w-3 mr-0.5" />
          ) : (
            <ArrowDownRight className="h-3 w-3 mr-0.5" />
          )}
          {change}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
