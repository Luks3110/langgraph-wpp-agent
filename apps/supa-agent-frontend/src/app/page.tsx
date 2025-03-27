import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import PricingCard from "@/components/pricing-card";
import Footer from "@/components/footer";
import { createClient } from "../../supabase/server";
import {
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Shield,
  Users,
  Bot,
  Brain,
  Gauge,
  Layers,
} from "lucide-react";

async function getPlans() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-plans`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch plans");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching plans:", error);
    return [];
  }
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch plans from API route
  const response = await fetch(
    new URL(
      "/api/get-plans",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ),
  );
  const plans = await response.json();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Navbar />
      <Hero />

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              AI Agent Management Platform
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Create, customize, and deploy AI agents with specific
              personalities and knowledge domains without any coding.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Bot className="w-6 h-6" />,
                title: "Agent Configuration",
                description:
                  "Easily configure character profiles, system instructions, and conversation styling",
              },
              {
                icon: <Brain className="w-6 h-6" />,
                title: "Testing Sandbox",
                description:
                  "Preview agent behavior in a conversation sandbox before deployment",
              },
              {
                icon: <Layers className="w-6 h-6" />,
                title: "Multi-tenant Architecture",
                description:
                  "Role-based access controls for team collaboration",
              },
              {
                icon: <Gauge className="w-6 h-6" />,
                title: "Analytics Dashboard",
                description:
                  "Monitor agent performance metrics and user satisfaction",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-blue-600 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Create industry-specific virtual assistants in just a few simple
              steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Configure Agent Profile
              </h3>
              <p className="text-gray-600">
                Define your agent's character, industry domain, and upload
                knowledge base materials.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3">Test in Sandbox</h3>
              <p className="text-gray-600">
                Preview your agent's behavior in a conversation sandbox and
                refine its responses.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3">Deploy & Monitor</h3>
              <p className="text-gray-600">
                Deploy your agent and track its performance through our
                comprehensive analytics dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">10x</div>
              <div className="text-blue-100">Faster Agent Creation</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">95%</div>
              <div className="text-blue-100">User Satisfaction</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-blue-100">Agent Availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Industry Use Cases</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our platform enables AI agents for various industries and use
              cases
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Customer Support",
                description:
                  "Create agents that handle customer inquiries 24/7 with consistent, accurate responses.",
              },
              {
                title: "Healthcare Assistance",
                description:
                  "Deploy agents that provide medical information and appointment scheduling.",
              },
              {
                title: "Financial Advisory",
                description:
                  "Build agents that offer financial guidance and answer investment questions.",
              },
              {
                title: "Educational Support",
                description:
                  "Develop tutoring agents that assist students with learning materials.",
              },
              {
                title: "HR & Recruitment",
                description:
                  "Implement agents that streamline candidate screening and employee onboarding.",
              },
              {
                title: "Legal Consultation",
                description:
                  "Create agents that provide preliminary legal information and document assistance.",
              },
            ].map((useCase, index) => (
              <div
                key={index}
                className="p-6 bg-gray-50 rounded-xl hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold mb-3">{useCase.title}</h3>
                <p className="text-gray-600">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gray-50" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the perfect plan for your needs. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans?.map((item: any) => (
              <PricingCard key={item.id} item={item} user={user} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Build Your AI Agents?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join innovative businesses that are transforming their customer
            interactions with AI agents.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started Now
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
