import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/server/guards";

/** Keeps unknown deeper URLs inside the authenticated layout. */
export default function UnknownPath() {
  requirePageUser("/submissions");
  notFound();
}
