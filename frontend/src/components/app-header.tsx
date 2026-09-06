import Image from "next/image";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur md:px-8">
      <Link className="flex items-center gap-3" href="/">
        <Image
          alt="Stream IO"
          className="size-10 object-contain"
          height={40}
          priority
          src="/stream-mark.png"
          width={40}
        />
        <span className="text-base font-semibold tracking-tight text-stream-navy">
          Stream IO : Patient Referral Intake
        </span>
      </Link>
    </header>
  );
}
