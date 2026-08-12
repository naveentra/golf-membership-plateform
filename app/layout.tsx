import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FairChance | Play with purpose",
  description: "Golf scores, monthly rewards and real-world impact."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
