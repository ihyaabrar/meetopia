import type { Metadata } from "next";
import AssetLab from "@/components/AssetLab";

export const metadata: Metadata = { title: "Lab Aset · Meetopia", robots: { index: false, follow: false } };
export default function AssetLabPage() {
  return <AssetLab />;
}
