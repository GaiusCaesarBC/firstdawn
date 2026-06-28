const milestones = [
  "Foundation",
  "The First Dawn",
  "The Awakening",
  "The First Family",
  "Observer Platform",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-dawn-coal text-stone-100">
      <section className="relative flex min-h-[92vh] items-center border-b border-white/10">
        <div className="absolute inset-0 bg-[url('/first-dawn-observatory.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,8,0.92)_0%,rgba(6,7,8,0.72)_42%,rgba(6,7,8,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,7,8,0.15)_0%,rgba(6,7,8,0.2)_52%,rgba(6,7,8,0.94)_100%)]" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 py-24 sm:px-10 lg:px-12">
          <p className="mb-5 w-fit border border-dawn-gold/40 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.34em] text-dawn-amber shadow-ember backdrop-blur">
            Coming Soon
          </p>
          <h1 className="font-display text-5xl font-semibold uppercase leading-[0.9] tracking-normal text-white sm:text-7xl lg:text-8xl">
            First Dawn
          </h1>
          <p className="mt-5 font-display text-2xl text-dawn-amber sm:text-4xl">
            A Living Civilization
          </p>
          <div className="mt-10 max-w-2xl space-y-5 text-lg leading-8 text-stone-200 sm:text-xl">
            <p>Every civilization begins somewhere.</p>
            <p>This one begins with two people.</p>
            <p className="text-stone-100">
              We do not write history.
              <br />
              We write the laws that make history possible.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[linear-gradient(180deg,#060708_0%,#0d1117_100%)] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
              Vision
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
              The website is the observatory. The world is the work.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-stone-300 sm:text-lg">
            <p>
              First Dawn is an experiment in artificial civilization: a persistent
              world where inhabitants will one day live, learn, remember, form
              relationships, build cultures, and create their own history.
            </p>
            <p>
              Observers will one day watch a civilization unfold over time. They
              will witness history, not control it.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-dawn-ink px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
                Development Milestones
              </p>
              <h2 className="mt-4 font-display text-4xl text-white sm:text-5xl">
                The foundation comes first.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-stone-300">
              No artificial citizens are active yet. The current milestone is
              about building the laws, records, and world boundaries that make
              continuity possible.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-5">
            {milestones.map((milestone, index) => (
              <article
                className="min-h-44 bg-dawn-coal/95 p-6 transition duration-300 hover:bg-[#10161d]"
                key={milestone}
              >
                <p className="font-display text-3xl text-dawn-amber">
                  {String(index).padStart(2, "0")}
                </p>
                <h3 className="mt-8 text-lg font-semibold text-white">
                  {milestone}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/10 bg-[#07090b] px-6 py-20 sm:px-10 lg:px-12">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(216,173,95,0.9),transparent)]" />
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
              FirstDawn.life
            </p>
            <h2 className="mt-4 font-display text-4xl text-white sm:text-6xl">
              The world begins soon.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">
              The first public home is taking shape now. The civilization is not
              launched yet; the foundation is being laid with care.
            </p>
          </div>
          <div className="w-full max-w-sm border border-dawn-gold/40 bg-black/25 p-6 shadow-ember backdrop-blur">
            <p className="text-sm uppercase tracking-[0.26em] text-dawn-amber">
              Coming Soon
            </p>
            <p className="mt-4 text-2xl font-semibold text-white">
              A window into a living civilization.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
