import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonSecondary } from "@/components/ui/classes";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Link href="/forms" className={buttonSecondary}>
            Go to Forms
          </Link>
        }
      />
    </main>
  );
}
