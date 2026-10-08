import Image from "next/image";
import type { ReactNode } from "react";

export function AuthLayout({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-theme min-h-dvh bg-[#f7faf9] text-[#18282b]">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[1.08fr_1fr]">
        <section className="relative flex flex-col overflow-hidden bg-[#e8f4f0] px-6 py-8 sm:px-12 lg:m-5 lg:rounded-[32px] lg:p-12">
          <Image src="/logo.png" alt="StockHome" width={2172} height={724} preload className="-ml-6 -my-5 h-auto w-64 mix-blend-multiply sm:w-72" />
          <div className="relative z-10 my-auto max-w-lg py-10 lg:py-16">
            <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-[#007b78] uppercase">A little order. A lot more home.</p>
            <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem]">Less to keep<br />in your head.<br /><span className="text-[#007b78]">More room to live.</span></h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-[#516b69]">Your pantry, your to-dos, your everyday essentials. All together in one happy home.</p>
            <div className="mt-10 hidden rounded-2xl border border-white/80 bg-white/80 p-6 shadow-[0_12px_40px_-24px_#367d70] sm:block">
              <p className="mb-5 text-sm font-semibold">A little more organized</p>
              <div className="space-y-4">
                {[['01', 'Know what’s in stock', 'Every essential, accounted for.'], ['02', 'Make space for what matters', 'Keep household to-dos in one place.'], ['03', 'Stay a step ahead', 'See what needs a restock.']].map(([number, heading, copy]) => (
                  <div key={number} className="flex items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf6f3] text-xs font-semibold text-[#007b78]">{number}</span><div><p className="text-sm font-medium">{heading}</p><p className="mt-0.5 text-xs leading-5 text-[#627673]">{copy}</p></div></div>
                ))}
              </div>
            </div>
          </div>
          <p className="hidden text-xs text-[#627673] lg:block">A calmer home starts here.</p>
        </section>
        <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:py-16">
          <div className="w-full max-w-[400px]">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-3 mb-8 text-sm leading-6 text-[#627673]">{description}</p>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
