"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save } from "lucide-react";

export interface MessageExample {
  role: "user" | "assistant";
  content: string;
}

export interface Character {
  name: string;
  system: string;
  bio: string[];
  messageExamples: MessageExample[][];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  topics: string[];
  adjectives: string[];
  lore: string[];
  postExamples: string[];
}

interface CharacterFormProps {
  initialCharacter?: Character;
  onSave: (character: Character) => void;
}

const defaultCharacter: Character = {
  name: "",
  system: "",
  bio: [""],
  messageExamples: [
    [
      { role: "user", content: "" },
      { role: "assistant", content: "" },
    ],
  ],
  style: {
    all: [""],
    chat: [""],
    post: [""],
  },
  topics: [""],
  adjectives: [""],
  lore: [""],
  postExamples: [""],
};

export default function CharacterForm({
  initialCharacter,
  onSave,
}: CharacterFormProps) {
  const [character, setCharacter] = useState<Character>(
    initialCharacter || defaultCharacter,
  );
  const [activeTab, setActiveTab] = useState("basic");

  const handleChange = (field: keyof Character, value: any) => {
    setCharacter((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleArrayChange = (
    field: keyof Character,
    index: number,
    value: string,
  ) => {
    setCharacter((prev) => {
      const newArray = [...(prev[field] as string[])];
      newArray[index] = value;
      return {
        ...prev,
        [field]: newArray,
      };
    });
  };

  const handleStyleChange = (
    styleType: keyof Character["style"],
    index: number,
    value: string,
  ) => {
    setCharacter((prev) => {
      const newStyle = {
        ...prev.style,
        [styleType]: [...prev.style[styleType]],
      };
      newStyle[styleType][index] = value;
      return {
        ...prev,
        style: newStyle,
      };
    });
  };

  const handleMessageExampleChange = (
    conversationIndex: number,
    messageIndex: number,
    field: keyof MessageExample,
    value: string,
  ) => {
    setCharacter((prev) => {
      const newMessageExamples = [...prev.messageExamples];
      newMessageExamples[conversationIndex] = [
        ...newMessageExamples[conversationIndex],
      ];
      newMessageExamples[conversationIndex][messageIndex] = {
        ...newMessageExamples[conversationIndex][messageIndex],
        [field]: value,
      };
      return {
        ...prev,
        messageExamples: newMessageExamples,
      };
    });
  };

  const addArrayItem = (field: keyof Character) => {
    setCharacter((prev) => {
      const newArray = [...(prev[field] as string[])];
      newArray.push("");
      return {
        ...prev,
        [field]: newArray,
      };
    });
  };

  const removeArrayItem = (field: keyof Character, index: number) => {
    setCharacter((prev) => {
      const newArray = [...(prev[field] as string[])];
      newArray.splice(index, 1);
      return {
        ...prev,
        [field]: newArray,
      };
    });
  };

  const addStyleItem = (styleType: keyof Character["style"]) => {
    setCharacter((prev) => {
      const newStyle = {
        ...prev.style,
        [styleType]: [...prev.style[styleType], ""],
      };
      return {
        ...prev,
        style: newStyle,
      };
    });
  };

  const removeStyleItem = (
    styleType: keyof Character["style"],
    index: number,
  ) => {
    setCharacter((prev) => {
      const newStyle = {
        ...prev.style,
        [styleType]: [...prev.style[styleType]],
      };
      newStyle[styleType].splice(index, 1);
      return {
        ...prev,
        style: newStyle,
      };
    });
  };

  const addConversation = () => {
    setCharacter((prev) => ({
      ...prev,
      messageExamples: [
        ...prev.messageExamples,
        [
          { role: "user", content: "" },
          { role: "assistant", content: "" },
        ],
      ],
    }));
  };

  const removeConversation = (index: number) => {
    setCharacter((prev) => {
      const newMessageExamples = [...prev.messageExamples];
      newMessageExamples.splice(index, 1);
      return {
        ...prev,
        messageExamples: newMessageExamples,
      };
    });
  };

  const addMessage = (conversationIndex: number) => {
    setCharacter((prev) => {
      const newMessageExamples = [...prev.messageExamples];
      const role =
        newMessageExamples[conversationIndex].length % 2 === 0
          ? "user"
          : "assistant";
      newMessageExamples[conversationIndex] = [
        ...newMessageExamples[conversationIndex],
        { role, content: "" },
      ];
      return {
        ...prev,
        messageExamples: newMessageExamples,
      };
    });
  };

  const removeMessage = (conversationIndex: number, messageIndex: number) => {
    setCharacter((prev) => {
      const newMessageExamples = [...prev.messageExamples];
      newMessageExamples[conversationIndex] = [
        ...newMessageExamples[conversationIndex],
      ];
      newMessageExamples[conversationIndex].splice(messageIndex, 1);
      return {
        ...prev,
        messageExamples: newMessageExamples,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(character);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-10">
      <Card>
        <CardHeader>
          <CardTitle>Agent Character Configuration</CardTitle>
          <CardDescription>
            Define your AI agent's personality, knowledge, and conversation
            style
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="style">Style & Tone</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium mb-1"
                  >
                    Agent Name
                  </label>
                  <Input
                    id="name"
                    value={character.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Enter agent name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="system"
                    className="block text-sm font-medium mb-1"
                  >
                    System Instructions
                  </label>
                  <Textarea
                    id="system"
                    value={character.system}
                    onChange={(e) => handleChange("system", e.target.value)}
                    placeholder="Enter system instructions for the agent"
                    className="min-h-32"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">Bio</label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addArrayItem("bio")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Bio Line
                    </Button>
                  </div>
                  {character.bio.map((item, index) => (
                    <div key={`bio-${index}`} className="flex gap-2 mb-2">
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleArrayChange("bio", index, e.target.value)
                        }
                        placeholder={`Bio line ${index + 1}`}
                      />
                      {character.bio.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeArrayItem("bio", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Style & Tone Tab */}
            <TabsContent value="style" className="space-y-6">
              <div className="space-y-6">
                {/* General Style */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      General Style
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addStyleItem("all")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Style
                    </Button>
                  </div>
                  {character.style.all.map((item, index) => (
                    <div key={`style-all-${index}`} className="flex gap-2 mb-2">
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleStyleChange("all", index, e.target.value)
                        }
                        placeholder="General style instruction"
                      />
                      {character.style.all.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeStyleItem("all", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Chat Style */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Chat Style
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addStyleItem("chat")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Chat Style
                    </Button>
                  </div>
                  {character.style.chat.map((item, index) => (
                    <div
                      key={`style-chat-${index}`}
                      className="flex gap-2 mb-2"
                    >
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleStyleChange("chat", index, e.target.value)
                        }
                        placeholder="Chat-specific style instruction"
                      />
                      {character.style.chat.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeStyleItem("chat", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Post Style */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Post Style
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addStyleItem("post")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Post Style
                    </Button>
                  </div>
                  {character.style.post.map((item, index) => (
                    <div
                      key={`style-post-${index}`}
                      className="flex gap-2 mb-2"
                    >
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleStyleChange("post", index, e.target.value)
                        }
                        placeholder="Post-specific style instruction"
                      />
                      {character.style.post.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeStyleItem("post", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Adjectives */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Character Adjectives
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addArrayItem("adjectives")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Adjective
                    </Button>
                  </div>
                  {character.adjectives.map((item, index) => (
                    <div key={`adjective-${index}`} className="flex gap-2 mb-2">
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleArrayChange("adjectives", index, e.target.value)
                        }
                        placeholder="Adjective describing the agent"
                      />
                      {character.adjectives.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeArrayItem("adjectives", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Knowledge Tab */}
            <TabsContent value="knowledge" className="space-y-6">
              <div className="space-y-6">
                {/* Topics */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Topics of Expertise
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addArrayItem("topics")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Topic
                    </Button>
                  </div>
                  {character.topics.map((item, index) => (
                    <div key={`topic-${index}`} className="flex gap-2 mb-2">
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleArrayChange("topics", index, e.target.value)
                        }
                        placeholder="Topic the agent is knowledgeable about"
                      />
                      {character.topics.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeArrayItem("topics", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Lore */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Background Lore
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addArrayItem("lore")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Lore
                    </Button>
                  </div>
                  {character.lore.map((item, index) => (
                    <div key={`lore-${index}`} className="flex gap-2 mb-2">
                      <Textarea
                        value={item}
                        onChange={(e) =>
                          handleArrayChange("lore", index, e.target.value)
                        }
                        placeholder="Background information or lore"
                        className="min-h-20"
                      />
                      {character.lore.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeArrayItem("lore", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Examples Tab */}
            <TabsContent value="examples" className="space-y-6">
              <div className="space-y-6">
                {/* Message Examples */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium">
                      Conversation Examples
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addConversation}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Conversation
                    </Button>
                  </div>

                  {character.messageExamples.map((conversation, convIndex) => (
                    <Card key={`conversation-${convIndex}`} className="mb-6">
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm">
                            Conversation {convIndex + 1}
                          </CardTitle>
                          {character.messageExamples.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeConversation(convIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 space-y-3">
                        {conversation.map((message, msgIndex) => (
                          <div
                            key={`message-${convIndex}-${msgIndex}`}
                            className="space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <span
                                className={`text-xs font-medium ${message.role === "user" ? "text-blue-600" : "text-green-600"}`}
                              >
                                {message.role === "user" ? "User" : "Assistant"}
                              </span>
                              {conversation.length > 2 && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    removeMessage(convIndex, msgIndex)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <Textarea
                              value={message.content}
                              onChange={(e) =>
                                handleMessageExampleChange(
                                  convIndex,
                                  msgIndex,
                                  "content",
                                  e.target.value,
                                )
                              }
                              placeholder={`${message.role === "user" ? "User" : "Assistant"} message`}
                              className={`min-h-20 ${message.role === "user" ? "bg-blue-50" : "bg-green-50"}`}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => addMessage(convIndex)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Message
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Post Examples */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Post Examples
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addArrayItem("postExamples")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Post Example
                    </Button>
                  </div>
                  {character.postExamples.map((item, index) => (
                    <div
                      key={`post-example-${index}`}
                      className="flex gap-2 mb-2"
                    >
                      <Textarea
                        value={item}
                        onChange={(e) =>
                          handleArrayChange(
                            "postExamples",
                            index,
                            e.target.value,
                          )
                        }
                        placeholder="Example of a post this agent would write"
                        className="min-h-24"
                      />
                      {character.postExamples.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeArrayItem("postExamples", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit">
            <Save className="h-4 w-4 mr-2" /> Save Character
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
