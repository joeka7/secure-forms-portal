import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonSecondary } from "@/components/ui/classes";
import { EmptyState } from "@/components/ui/States";

export default function AppNotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="The form or page you're looking for doesn't exist or is no longer available."
      action={
        <Link href="/forms" className={buttonSecondary}>
          Back to Forms
        </Link>
      }
      className="mt-4 sm:mt-10"
    />
  );
}
