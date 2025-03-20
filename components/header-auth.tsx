import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Badge } from "./ui/badge";

export default async function AuthButton() {
  if (!hasEnvVars) {
    return (
      <div className="row gap-4 items-center">
        <div>
          <Badge
            variant={"default"}
            className="font-normal pointer-events-none"
          >
            Please update .env.local file with anon key and url
          </Badge>
        </div>
      </div>
    );
  }

  // No authentication UI, just return empty to keep header clean
  return <div className="row"></div>;
}
