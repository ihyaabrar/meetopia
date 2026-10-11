import type { Metadata } from "next";
import WorldLab from "@/features/world3d/WorldLab";

export const metadata: Metadata = {
  title: "Spatial Lab 3D · Meetopia",
  robots: { index: false, follow: false },
};
export default function ThreeDLabPage() {
  return <WorldLab />;
}
