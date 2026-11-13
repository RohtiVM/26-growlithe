import { requireVisitor } from "@/server/visitor";
import { ScannerFlow } from "./ScannerFlow";

export default async function ScannerPage() {
  await requireVisitor("/app/scanner");
  return <ScannerFlow />;
}
