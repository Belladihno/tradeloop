import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pb-20 pt-16 md:pb-0 md:pt-[124px]">{children}</div>
      <div className="pb-20 md:pb-0">
        <Footer />
      </div>
      <MobileTabBar />
    </>
  );
}
