"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { User } from "@supabase/supabase-js";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import Stripe from "stripe";

interface PricingSectionProps {
  plans: Stripe.Plan[];
  user: User | null;
}

function PricingSection({ plans, user }: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );

  // Sample pricing data
  const pricingPlans = {
    monthly: [
      {
        id: plans && plans.length > 0 ? plans[0]?.id : "starter-monthly",
        name: "Starter",
        price: 149,
        interval: "month",
        description:
          "Perfect for small businesses just getting started with AI agents.",
        features: [
          "1 AI agent",
          "2 channels",
          "Up to 1,000 conversations/month",
          "Basic analytics",
          "Email support",
          "Standard templates",
        ],
        cta: "Get Started",
        popular: false,
      },
      {
        id: plans && plans.length > 1 ? plans[1]?.id : "scaling-monthly",
        name: "Scaling",
        price: 229,
        interval: "month",
        description:
          "Ideal for growing businesses with increasing customer service needs.",
        features: [
          "3 AI agents",
          "5 channels",
          "Up to 5,000 conversations/month",
          "Advanced analytics",
          "Priority support",
          "Custom templates",
          "Team collaboration",
        ],
        cta: "Get Started",
        popular: true,
      },
      {
        id: plans && plans.length > 2 ? plans[2]?.id : "business-monthly",
        name: "Business",
        price: 349,
        interval: "month",
        description:
          "For established businesses with complex customer service operations.",
        features: [
          "Unlimited AI agents",
          "All channels",
          "Up to 20,000 conversations/month",
          "Enterprise analytics",
          "24/7 support",
          "Custom integrations",
          "Advanced AI capabilities",
          "Dedicated account manager",
        ],
        cta: "Get Started",
        popular: false,
      },
    ],
    yearly: [
      {
        id: plans && plans.length > 3 ? plans[3]?.id : "starter-yearly",
        name: "Starter",
        price: 119,
        interval: "month",
        description:
          "Perfect for small businesses just getting started with AI agents.",
        features: [
          "1 AI agent",
          "2 channels",
          "Up to 1,000 conversations/month",
          "Basic analytics",
          "Email support",
          "Standard templates",
        ],
        cta: "Get Started",
        popular: false,
      },
      {
        id: plans && plans.length > 4 ? plans[4]?.id : "scaling-yearly",
        name: "Scaling",
        price: 183,
        interval: "month",
        description:
          "Ideal for growing businesses with increasing customer service needs.",
        features: [
          "3 AI agents",
          "5 channels",
          "Up to 5,000 conversations/month",
          "Advanced analytics",
          "Priority support",
          "Custom templates",
          "Team collaboration",
        ],
        cta: "Get Started",
        popular: true,
      },
      {
        id: plans && plans.length > 5 ? plans[5]?.id : "business-yearly",
        name: "Business",
        price: 279,
        interval: "month",
        description:
          "For established businesses with complex customer service operations.",
        features: [
          "Unlimited AI agents",
          "All channels",
          "Up to 20,000 conversations/month",
          "Enterprise analytics",
          "24/7 support",
          "Custom integrations",
          "Advanced AI capabilities",
          "Dedicated account manager",
        ],
        cta: "Get Started",
        popular: false,
      },
    ],
  };

  // Function to handle checkout
  const handleCheckout = async (planId: string) => {
    if (!user) {
      // Redirect to login if user is not authenticated
      window.location.href = "/sign-in?redirect=pricing";
      return;
    }

    try {
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Customer-Email": user.email || "",
        },
        body: JSON.stringify({
          price_id: planId,
          user_id: user.id,
          return_url: `${window.location.origin}/dashboard`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error creating checkout session");
      }

      // Redirect to Stripe checkout
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    }
  };

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Choose the plan that's right for your business.
          </p>
          <div className="flex items-center justify-center">
            <span
              className={`mr-3 text-sm ${
                billingCycle === "monthly" ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Monthly
            </span>
            <Switch
              checked={billingCycle === "yearly"}
              onCheckedChange={(checked) =>
                setBillingCycle(checked ? "yearly" : "monthly")
              }
              className="cursor-pointer"
            />
            <span
              className={`ml-3 text-sm ${
                billingCycle === "yearly" ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Yearly{" "}
              <Badge
                variant="outline"
                className="ml-2 bg-green-50 text-green-600 border-green-200"
              >
                Save 20%
              </Badge>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {billingCycle === "monthly"
            ? pricingPlans.monthly.map((plan, index) => (
                <Card
                  key={index}
                  className={`border ${
                    plan.popular
                      ? "border-indigo-200 shadow-md ring-1 ring-indigo-200"
                      : "border-gray-200 shadow-sm"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-bl-lg rounded-tr-lg">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-gray-500 ml-2">
                        /{plan.interval}
                      </span>
                    </div>
                    <CardDescription className="mt-2 text-sm">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-green-500 mr-2 mt-0.5">
                            <CheckIcon size={16} />
                          </span>
                          <span className="text-sm text-gray-600">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => handleCheckout(plan.id)}
                      className={`w-full ${
                        plan.popular
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      } rounded-md py-2`}
                    >
                      {plan.cta}
                    </Button>
                  </CardFooter>
                </Card>
              ))
            : pricingPlans.yearly.map((plan, index) => (
                <Card
                  key={index}
                  className={`border ${
                    plan.popular
                      ? "border-indigo-200 shadow-md ring-1 ring-indigo-200"
                      : "border-gray-200 shadow-sm"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-bl-lg rounded-tr-lg">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-gray-500 ml-2">
                        /{plan.interval}
                      </span>
                    </div>
                    <CardDescription className="mt-2 text-sm">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-green-500 mr-2 mt-0.5">
                            <CheckIcon size={16} />
                          </span>
                          <span className="text-sm text-gray-600">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => handleCheckout(plan.id)}
                      className={`w-full ${
                        plan.popular
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      } rounded-md py-2`}
                    >
                      {plan.cta}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-gray-600 mb-4 text-sm">
            Need a custom plan for your enterprise? We've got you covered.
          </p>
          <Button
            variant="outline"
            className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-md px-6 py-2"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  );
}

export default PricingSection;
