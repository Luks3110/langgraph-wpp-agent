import Navbar from "@/components/navbar";
import PricingCard from "@/components/pricing-card";
import { createClient } from "../../../supabase/server";

export default async function Pricing() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let plans = [];
    let error = null;

    try {
        const { data, error: funcError } = await supabase.functions.invoke('supabase-functions-get-plans');
        plans = data || [];
        error = funcError;
    } catch (err) {
        console.error('Failed to fetch plans:', err);
        error = err;
    }

    // Fallback plan if API fails
    const fallbackPlan = {
        id: 'fallback_plan',
        amount: 30000, // $300 in cents
        interval: 'month',
        nickname: 'Premium Plan'
    };

    // Use fallback if no plans or error occurred
    const displayPlans = plans.length > 0 ? plans : [fallbackPlan];

    return (
        <>
            <Navbar />
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
                    <p className="text-xl text-muted-foreground">
                        Choose the perfect plan for your needs
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {displayPlans.map((item: any) => (
                        <PricingCard key={item.id} item={item} user={user} />
                    ))}
                </div>

                {error && (
                    <div className="text-center mt-8 text-muted-foreground">
                        <p>Note: Using fallback pricing. Please contact support for the latest plans.</p>
                    </div>
                )}
            </div>
        </>
    );
}
