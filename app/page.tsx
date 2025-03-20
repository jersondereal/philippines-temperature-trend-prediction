import SimulationWrapper from "@/components/simulation-wrapper";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  // Still create client for SSR but don't use it for auth checks
  const supabase = await createClient();

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto">
      <div className="mb-14">
        <h1 className="text-3xl font-bold text-center mb-4">
          Philippines Temperature Trend Analysis
        </h1>
        <p className="text-muted-foreground text-center">
          Explore historical temperature data and climate change predictions for
          the Philippines from 1901 to 2100
        </p>
      </div>

      <div className="w-full h-full">
        <SimulationWrapper />
      </div>
    </div>
  );
}
