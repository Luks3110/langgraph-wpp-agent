"use client";

import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

export default function PricingCard({
  item,
  user,
}: {
  item: any; // Stripe plan object
  user: User | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure consistent rendering between server and client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle checkout process
  const handleCheckout = async (priceId: string) => {
    if (!user) {
      // Redirect to login if user is not authenticated
      window.location.href = "/sign-in?redirect=pricing";
      return;
    }

    setIsLoading(true);

    try {
      console.log("Starting checkout process for user:", user.id);
      console.log("Price ID:", priceId);
      
      // Call the checkout API
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        console.log("Redirecting to checkout:", data.url);
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent hydration mismatch by ensuring consistent rendering
  if (!isClient) {
    return (
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            $300
            <span className="text-sm font-normal text-muted-foreground">
              /month
            </span>
          </CardTitle>
          <CardDescription className="text-lg">
            Loading...
          </CardDescription>
        </CardHeader>
        
        <CardFooter>
          <Button
            disabled={true}
            className="w-full"
          >
            Loading...
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Extract price information from Stripe plan object
  const price = item?.amount ? (item.amount / 100).toFixed(0) : "300";
  const interval = item?.interval || "month";
  const priceId = item?.id || "";

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          ${price}
          <span className="text-sm font-normal text-muted-foreground">
            /{interval}
          </span>
        </CardTitle>
        <CardDescription className="text-lg">
          {item?.nickname || `${price} per ${interval}`}
        </CardDescription>
      </CardHeader>
      
      <CardFooter>
        <Button
          onClick={() => handleCheckout(priceId)}
          disabled={isLoading || !priceId}
          className="w-full"
        >
          {isLoading ? "Processing..." : "Get Started"}
        </Button>
      </CardFooter>
    </Card>
  );
}
