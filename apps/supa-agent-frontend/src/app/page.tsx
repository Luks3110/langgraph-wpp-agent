import Footer from "@/components/footer";
import PricingSection from "@/components/home/pricing-section";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bot,
  Brain,
  Gauge,
  Globe,
  Headset,
  Heart,
  Layers,
  MessageSquare,
  ShoppingCart,
  UserCheck,
} from "lucide-react";
import Stripe from "stripe";
import { createClient } from "../../supabase/server";

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
      }
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
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    )
  );
  const plans: Stripe.Plan[] = await response.json();

  console.log(plans);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-24 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-12">
            <div className="text-center md:text-left max-w-xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 mb-6">
                Unleash the power
                <br />
                of AI agents
              </h1>
              <p className="text-lg md:text-xl text-gray-700 mb-8">
                Create, customize, and deploy AI agents with specific
                personalities and knowledge domains without any coding.
              </p>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md text-base font-medium">
                Get Started For Free
              </Button>
            </div>
            <div className="relative max-w-sm mx-auto md:mr-0">
              {/* Chat interface mockup */}
              <div className="bg-indigo-50 p-4 rounded-xl shadow-sm">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-start mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                      <Bot size={16} />
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3 max-w-[220px]">
                      <p className="text-sm">
                        Hello! I'm your AI assistant. How can I help you today?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start justify-end mb-4">
                    <div className="bg-indigo-600 rounded-lg p-3 max-w-[220px] text-white">
                      <p className="text-sm">
                        I need information about your product pricing.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                      <Bot size={16} />
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3 max-w-[220px]">
                      <p className="text-sm">
                        We offer three plans: Starter ($149/mo), Scaling
                        ($229/mo), and Business ($349/mo). Would you like to
                        know more about each plan?
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between mt-4">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      className="w-full p-2 border border-gray-200 rounded-md mr-2 text-sm"
                    />
                    <Button
                      size="sm"
                      className="bg-indigo-600 px-2 py-1 rounded-md"
                    >
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-8 pb-16 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-500 mb-6">
              Trusted by innovative businesses
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
              <div className="text-gray-400 font-medium text-sm">ACME CORP</div>
              <div className="text-gray-400 font-medium text-sm">TECHWAVE</div>
              <div className="text-gray-400 font-medium text-sm">INNOSYS</div>
              <div className="text-gray-400 font-medium text-sm">GLOBEX</div>
              <div className="text-gray-400 font-medium text-sm">QUANTUM</div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Cards */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Instagram DMs */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-pink-500"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="20"
                      height="20"
                      rx="5"
                      ry="5"
                    ></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2 text-center">
                Instagram DMs
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Answer every single question, comment, and story reply 24/7, to
                attract more leads, increase sales, and drive higher conversions
                on IG
              </p>
              <a
                href="#"
                className="text-indigo-600 font-medium inline-flex items-center text-sm"
              >
                LEARN MORE <ArrowRight className="ml-2" size={14} />
              </a>
            </div>

            {/* WhatsApp */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2 text-center">WhatsApp</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Use WhatsApp Automation to help customers discover products,
                retrieve order information and deliver customer support — all on
                autopilot
              </p>
              <a
                href="#"
                className="text-indigo-600 font-medium inline-flex items-center text-sm"
              >
                LEARN MORE <ArrowRight className="ml-2" size={14} />
              </a>
            </div>

            {/* Facebook Messenger */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-500"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2 text-center">
                Facebook Messenger
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Automates conversations to fuel more sales, generate leads,
                automate FAQs and run marketing campaigns
              </p>
              <a
                href="#"
                className="text-indigo-600 font-medium inline-flex items-center text-sm"
              >
                LEARN MORE <ArrowRight className="ml-2" size={14} />
              </a>
            </div>

            {/* E-commerce Support */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-pink-500" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-2 text-center">
                E-commerce Support
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Help customers discover products, retrieve order information and
                deliver customer support — all on autopilot
              </p>
              <a
                href="#"
                className="text-indigo-600 font-medium inline-flex items-center text-sm"
              >
                LEARN MORE <ArrowRight className="ml-2" size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Stats Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Discover why 1M+ brands
              <br />
              trust our platform
            </h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-8 mb-20">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">1M+</div>
              <div className="text-xs text-gray-500 uppercase">Businesses</div>
              <div className="text-sm text-gray-600">
                using our platform to grow
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">4B+</div>
              <div className="text-xs text-gray-500 uppercase">
                Conversations
              </div>
              <div className="text-sm text-gray-600">powered by our AI</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">
                170+
              </div>
              <div className="text-xs text-gray-500 uppercase">Countries</div>
              <div className="text-sm text-gray-600">
                use our platform globally
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">#1</div>
              <div className="text-xs text-gray-500 uppercase">Platform</div>
              <div className="text-sm text-gray-600">
                Leading AI agent solution
              </div>
            </div>
          </div>

          {/* Case Study */}
          <div className="flex mb-16">
            <div className="w-1/2 p-4">
              <div className="bg-yellow-50 p-8 flex items-center justify-center h-full">
                <div className="bg-white p-8 text-center w-full">
                  <div className="flex justify-center mb-4">
                    <div className="flex items-center">
                      <div className="font-bold text-xl">FC</div>
                    </div>
                  </div>
                  <div className="font-bold mb-1">TechCorp Inc.</div>
                  <div className="text-gray-600 mb-2">Global Enterprise</div>
                  <div className="text-gray-500">$2.5B annual revenue</div>
                </div>
              </div>
            </div>

            <div className="w-1/2 p-4">
              <div className="relative">
                <div className="text-5xl text-gray-200 absolute top-0 left-0">
                  "
                </div>
                <div className="pt-8 pl-8">
                  <p className="mb-4">
                    We've seen a 78% improvement in customer response time and a
                    45% increase in customer satisfaction scores after
                    implementing the AI agent platform. The team was
                    exceptionally helpful in customizing the solution for our
                    specific needs.
                  </p>
                  <div className="text-xs text-gray-500 uppercase">
                    DAVID CHEN, CUSTOMER SUCCESS DIRECTOR
                    <br />
                    TECHCORP INC.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Case Studies Navigation */}
          <div className="flex justify-center mb-16">
            <button className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center mx-2">
              <ArrowRight size={14} className="transform rotate-180" />
            </button>
            <button className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center mx-2">
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Case Studies Cards */}
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="border border-gray-200">
              <div className="h-40 bg-green-100 flex items-center justify-center p-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <Bot size={20} />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-2">
                  How TechCorp improved customer satisfaction by 45% with
                  AI-powered support
                </h3>
              </div>
            </div>

            <div className="border border-gray-200">
              <div className="h-40 bg-purple-100 flex items-center justify-center p-4">
                <div className="bg-indigo-600 p-4 w-20">
                  <div className="text-white text-2xl">V</div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-2">
                  How ValueStream achieved a 63% increase in lead conversion
                  with AI agents
                </h3>
              </div>
            </div>

            <div className="border border-gray-200">
              <div className="h-40 bg-yellow-100 flex items-center justify-center p-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-yellow-500 transform rotate-45"></div>
                  <div className="absolute top-0 right-0 text-purple-600 text-2xl">
                    ↗
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-2">
                  How GlobalRetail reduced support costs by 35% while improving
                  quality
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white" id="features">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything you need to automate customer interactions
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform provides all the tools to create, deploy, and manage
              AI agents across multiple channels.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Bot className="w-5 h-5" />,
                title: "Agent Configuration",
                description:
                  "Easily configure character profiles, system instructions, and conversation styling",
              },
              {
                icon: <Brain className="w-5 h-5" />,
                title: "Testing Sandbox",
                description:
                  "Preview agent behavior in a conversation sandbox before deployment",
              },
              {
                icon: <Layers className="w-5 h-5" />,
                title: "Multi-tenant Architecture",
                description:
                  "Role-based access controls for team collaboration",
              },
              {
                icon: <Gauge className="w-5 h-5" />,
                title: "Analytics Dashboard",
                description:
                  "Monitor agent performance metrics and user satisfaction",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center p-6"
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-md flex items-center justify-center text-indigo-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="md:w-1/2 order-2 md:order-1">
              <div className="bg-white p-6 rounded-xl shadow-sm max-w-sm">
                <h4 className="text-lg font-bold mb-4">Agent Configuration</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value="Support Assistant"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personality
                    </label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option>Friendly and Helpful</option>
                      <option>Professional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Knowledge Base
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-l-md"
                        placeholder="Upload PDF, DOC, TXT..."
                        readOnly
                      />
                      <Button className="bg-indigo-600 p-2 rounded-r-md">
                        Upload
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 order-1 md:order-2">
              <h2 className="text-3xl font-bold mb-4">
                Transform your customer service
                <br />
                with AI agents
              </h2>
              <p className="text-gray-700 mb-6">
                Define your agent's personality, knowledge domain, and upload
                custom data. Configure responses, conversation flows, and
                integration channels all without writing a single line of code.
              </p>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md">
                GET STARTED
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Steps */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Get started with our platform
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gray-50 p-8 text-center">
              <h3 className="text-xl font-bold mb-6">Step 1.</h3>
              <div className="flex justify-center mb-8">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 bg-pink-200 rounded-full transform -rotate-45"></div>
                  <div className="absolute inset-3 bg-white rounded-full"></div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Sign up for a risk-free trial and get access to all features for
                14 days
              </p>
            </div>

            <div className="bg-gray-50 p-8 text-center">
              <h3 className="text-xl font-bold mb-6">Step 2.</h3>
              <div className="flex justify-center mb-8">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 bg-blue-200 transform rotate-45"></div>
                  <div className="absolute inset-3 bg-white rounded-lg"></div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Use our template gallery to create customized AI agents in as
                little as 15 minutes
              </p>
            </div>

            <div className="bg-gray-50 p-8 text-center">
              <h3 className="text-xl font-bold mb-6">Step 3.</h3>
              <div className="flex justify-center mb-8">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 bg-purple-300 rounded-lg transform rotate-45"></div>
                  <div className="absolute inset-3 bg-white"></div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Deploy your AI agents across multiple channels to generate more
                conversations and revenue 24/7
              </p>
            </div>
          </div>

          <div className="flex justify-center mt-12">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md">
              Get Started Free
            </Button>
          </div>
        </div>
      </section>

      {/* Integration Channels */}
      <section id="integrations" className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Connect with your customers everywhere
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Deploy your AI agents across multiple channels to reach customers
              wherever they are.
            </p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-8 md:p-12">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {[
                {
                  icon: <MessageSquare className="w-6 h-6" />,
                  name: "WhatsApp",
                  color: "text-green-500",
                },
                {
                  icon: <Bot className="w-6 h-6" />,
                  name: "Instagram",
                  color: "text-pink-500",
                },
                {
                  icon: <ShoppingCart className="w-6 h-6" />,
                  name: "MercadoLivre",
                  color: "text-yellow-500",
                },
                {
                  icon: <MessageSquare className="w-6 h-6" />,
                  name: "Messenger",
                  color: "text-blue-500",
                },
                {
                  icon: <MessageSquare className="w-6 h-6" />,
                  name: "Telegram",
                  color: "text-blue-400",
                },
                {
                  icon: <Globe className="w-6 h-6" />,
                  name: "Website",
                  color: "text-gray-700",
                },
              ].map((channel, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center bg-white p-4 rounded-lg shadow-sm"
                >
                  <span className={`${channel.color} mb-2`}>
                    {channel.icon}
                  </span>
                  <span className="font-medium text-sm">{channel.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md">
                Connect Your Channels
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Perfect for every customer-facing team
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our AI agents can handle a wide range of customer interactions
              across different departments.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Headset className="w-5 h-5" />,
                title: "Customer Support",
                description:
                  "Handle common inquiries, troubleshoot issues, and escalate to human agents when needed.",
              },
              {
                icon: <UserCheck className="w-5 h-5" />,
                title: "Sales Development",
                description:
                  "Qualify leads, answer product questions, and schedule meetings with sales representatives.",
              },
              {
                icon: <Heart className="w-5 h-5" />,
                title: "Customer Success",
                description:
                  "Proactively engage customers, collect feedback, and identify upsell opportunities.",
              },
            ].map((useCase, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mr-3">
                    {useCase.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{useCase.title}</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  {useCase.description}
                </p>
                <a
                  href="#"
                  className="text-indigo-600 text-sm font-medium inline-flex items-center"
                >
                  Learn more <ArrowRight className="ml-1" size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-indigo-600 text-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold">10x</div>
              <div className="text-indigo-100 text-sm">
                Faster Agent Creation
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold">95%</div>
              <div className="text-indigo-100 text-sm">User Satisfaction</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-indigo-100 text-sm">Agent Availability</div>
            </div>
          </div>
        </div>
      </section>

      <PricingSection plans={plans} user={user} />

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Ready to transform your customer service?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses using our platform to create
            intelligent AI agents.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md">
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-6 py-2 rounded-md"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
