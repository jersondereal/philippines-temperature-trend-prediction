"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const SimulationInterface = dynamic(() => import("./simulation-interface"), {
  ssr: false,
  loading: () => <FallbackLoading />,
});

function FallbackLoading() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-96 border rounded-lg bg-muted/20 p-6">
      <div className="animate-pulse h-6 w-40 bg-muted rounded-md mb-4"></div>
      <div className="animate-pulse h-4 w-60 bg-muted rounded-md mb-8"></div>
      <div className="animate-pulse h-64 w-full bg-muted rounded-md"></div>
    </div>
  );
}

export default function SimulationWrapper() {
  const [isLoaded, setIsLoaded] = useState(false);

  // Simply render the component directly without the error detection logic
  return <SimulationInterface />;
}
