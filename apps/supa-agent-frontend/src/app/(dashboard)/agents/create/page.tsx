"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNavbar from "@/components/dashboard-navbar";
import CharacterForm, { Character } from "@/components/agent/character-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateAgentPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveCharacter = async (character: Character) => {
    setIsSaving(true);
    try {
      // Here you would save the character to your database
      console.log("Saving character:", character);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to dashboard or agent list
      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving character:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-full">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold">Create New Agent</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Agent Creation Process</CardTitle>
              <CardDescription>
                Follow these steps to create your AI agent with a unique
                personality and knowledge domain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li className="text-blue-600 font-medium">
                  Define your agent's character and personality (Current step)
                </li>
                <li className="text-muted-foreground">
                  Configure knowledge base and domain expertise
                </li>
                <li className="text-muted-foreground">
                  Test your agent in the sandbox
                </li>
                <li className="text-muted-foreground">Deploy your agent</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <CharacterForm onSave={handleSaveCharacter} />
      </main>
    </div>
  );
}
