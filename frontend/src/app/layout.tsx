import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stream · Referral Intake",
  description: "Provider referral intake workspace",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <AppHeader />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
