import { Activity, Globe, Layers, ShieldCheck } from "lucide-react"

export function FeatureSection() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">Architected for fast product launches</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground">Built for polished web experiences</h2>
          <p className="mx-auto mt-5 max-w-2xl text-zinc-500 text-balance">
            Lotus.build brings AI-generated layouts, responsive interactions, and deployment-ready pages together so your product looks premium from day one.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
          <article className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg lg:row-span-2">
            <div className="pointer-events-none absolute inset-0 opacity-[0.02]">
              <Layers className="absolute right-[-1rem] top-8 h-52 w-52 text-slate-900" />
            </div>
            <div className="relative z-10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-3xl font-semibold text-foreground">Generate polished product pages instantly</h3>
              <p className="mt-5 text-sm leading-7 text-zinc-600">
                AI-built front ends, layout systems, and responsive components combine into one streamlined workflow for founders and teams.
              </p>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg lg:col-span-2">
            <div className="pointer-events-none absolute bottom-0 right-0 opacity-[0.02]">
              <Activity className="h-48 w-48 text-slate-900" />
            </div>
            <div className="relative z-10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-3xl font-semibold text-foreground">Iterate with live previews and instant updates</h3>
              <p className="mt-5 text-sm leading-7 text-zinc-600">
                Tweak content, experiment with layouts, and see your changes immediately so you can ship faster without wasted build cycles.
              </p>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground">Production-ready reliability</h3>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Every page is built with accessible, modern styling and consistent spacing so your launch-ready site stays clean and dependable.
            </p>
            <button
              type="button"
              className="mt-8 inline-flex items-center rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-foreground transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              View docs
            </button>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
              <Globe className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground">Launch across every environment</h3>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Export clean code, deploy instantly, and keep your product ready for customers with a setup built for scale.
            </p>
            <div className="mt-8 flex items-center justify-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition duration-300 hover:scale-105">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-700">
                  <path d="M4 12h16M12 4l8 8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
