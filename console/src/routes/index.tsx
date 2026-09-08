import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/ware/dashboard";

export const Route = createFileRoute("/")({ component: Dashboard });
