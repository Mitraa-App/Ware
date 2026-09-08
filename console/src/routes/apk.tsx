import { createFileRoute } from "@tanstack/react-router";
import { ApkPage } from "@/components/ware/apk";

export const Route = createFileRoute("/apk")({ component: ApkPage });
