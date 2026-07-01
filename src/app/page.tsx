import Link from "next/link";

const simulationStatus = [
  {
    label: "World Foundation",
    status: "Active",
    description:
      "The canonical world, persistence rules, and foundational simulation boundaries are being established.",
  },
  {
    label: "Planet Systems",
    status: "Online",
    description:
      "Terrain, climate, hydrology, atmosphere, weather, and ecology systems are taking shape as a connected planet.",
  },
  {
    label: "Artificial Citizens",
    status: "Not Yet Active",
    description:
      "The inhabitants are not live; their memory, motivations, and social foundations remain under careful construction.",
  },
  {
    label: "Observer Platform",
    status: "In Development",
    description:
      "The public observatory is being prepared as a window into the world, not a control panel over it.",
  },
];

const worldSignals = [
  {
    label: "Planet Grid",
    value: "648 cells mapped",
  },
  {
    label: "Climate Systems",
    value: "deterministic cycles active",
  },
  {
    label: "Ecology Layer",
    value: "plants and animals forming the first web of life",
  },
  {
    label: "Human Layer",
    value: "awaiting first citizens",
  },
];

const foundationSystems = [
  { label: "Deterministic World Seed", status: "Complete" },
  { label: "Planet Grid", status: "Complete" },
  { label: "Climate Engine", status: "Complete" },
  { label: "Terrain Engine", status: "Complete" },
  { label: "Hydrology", status: "Complete" },
  { label: "Weather", status: "Complete" },
  { label: "Atmosphere", status: "Complete" },
  { label: "Biomes", status: "Complete" },
  { label: "Plant Ecology", status: "Complete" },
  { label: "Animal Ecology", status: "Complete" },
  { label: "Human Foundation", status: "In Progress" },
  { label: "Memory and Events", status: "In Progress" },
  { label: "Scheduler", status: "Complete" },
  { label: "Atlas Map", status: "In Progress" },
];

const milestones = [
  {
    number: "00",
    label: "Foundation",
    description:
      "Establish the deterministic world, physical systems, records, and simulation limits that make continuity possible.",
  },
  {
    number: "01",
    label: "The First Dawn",
    description:
      "Bring the initial world into public view with terrain, climate, ecology, and visible planetary structure.",
  },
  {
    number: "02",
    label: "The Awakening",
    description:
      "Introduce the first artificial citizens only when memory, needs, relationships, and agency can be treated seriously.",
  },
  {
    number: "03",
    label: "The First Family",
    description:
      "Observe the earliest human bonds, choices, routines, conflicts, and inherited histories inside the living world.",
  },
  {
    number: "04",
    label: "Observer Platform",
    description:
      "Open the public observatory for maps, timelines, chronicles, and careful long-term witnessing.",
  },
];

const observatoryCards = [
  {
    label: "Watch the world",
    description:
      "See the planet through atlas views as its systems become visible to observers.",
  },
  {
    label: "Follow the timeline",
    description:
      "Track milestones, events, and the slow formation of history across simulation time.",
  },
  {
    label: "Read the chronicles",
    description:
      "Return to records of what happened, what changed, and what the civilization remembers.",
  },
];

function statusTone(status: string) {
  if (status === "Complete" || status === "Active" || status === "Online") {
    return "border-dawn-gold/45 bg-dawn-gold/10 text-dawn-amber";
  }

  if (status === "In Progress" || status === "In Development") {
    return "border-stone-300/25 bg-stone-200/10 text-stone-200";
  }

  return "border-white/15 bg-black/30 text-stone-400";
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-dawn-coal text-stone-100">
      <section className="relative flex min-h-[94vh] items-center border-b border-white/10">
        <div className="absolute inset-0 bg-[url('/first-dawn-observatory.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,8,0.94)_0%,rgba(6,7,8,0.78)_43%,rgba(6,7,8,0.34)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,7,8,0.12)_0%,rgba(6,7,8,0.24)_54%,rgba(6,7,8,0.96)_100%)]" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 py-24 sm:px-10 lg:px-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="w-fit border border-dawn-gold/40 bg-black/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.34em] text-dawn-amber shadow-ember backdrop-blur">
              Coming Soon
            </p>
            <p className="text-sm uppercase tracking-[0.24em] text-stone-300">
              Public observatory in development.
            </p>
          </div>

          <h1 className="mt-7 font-display text-5xl font-semibold uppercase leading-[0.9] tracking-normal text-white sm:text-7xl lg:text-8xl">
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

      <section
        className="border-b border-white/10 bg-[linear-gradient(180deg,#060708_0%,#0a0d11_100%)] px-6 py-20 sm:px-10 lg:px-12"
        id="status"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
              Live Simulation Status
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
              The observatory opens before the civilization wakes.
            </h2>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
            {simulationStatus.map((item) => (
              <article
                className="min-h-64 bg-dawn-coal/95 p-6 transition duration-300 hover:bg-[#10151a]"
                key={item.label}
              >
                <div className="flex min-h-24 flex-col justify-between gap-4">
                  <h3 className="font-display text-3xl leading-none text-white">
                    {item.label}
                  </h3>
                  <p
                    className={`w-fit border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${statusTone(
                      item.status,
                    )}`}
                  >
                    {item.status}
                  </p>
                </div>
                <p className="mt-8 text-sm leading-7 text-stone-300">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#080a0d] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
                World Signal
              </p>
              <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
                The world is not awake yet, but its foundations are already
                measurable.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-300">
                These are foundation signals from the world-building layer, not
                claims of live consciousness or active citizen life.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
              {worldSignals.map((signal) => (
                <article
                  className="min-h-40 bg-black/35 p-6 transition duration-300 hover:bg-[#10151a]"
                  key={signal.label}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dawn-amber">
                    {signal.label}
                  </p>
                  <p className="mt-8 font-display text-2xl leading-tight text-white sm:text-3xl">
                    {signal.value}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-dawn-ink px-6 py-20 sm:px-10 lg:px-12">
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
              First Dawn is an experiment in artificial civilization: a
              persistent world where inhabitants will one day live, learn,
              remember, form relationships, build cultures, and create their own
              history.
            </p>
            <p>
              Observers will watch a civilization unfold over time. They will
              witness history, not control it.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#080a0d] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
                Foundation Progress
              </p>
              <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
                The laws are being written before the first history.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-stone-300">
              These are the visible foundation systems behind the world. Their
              labels reflect project state, not live simulation telemetry.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {foundationSystems.map((system) => (
              <article
                className="flex min-h-24 items-center justify-between gap-4 border border-white/10 bg-black/25 p-5 transition duration-300 hover:border-dawn-gold/35 hover:bg-black/35"
                key={system.label}
              >
                <h3 className="text-base font-semibold leading-6 text-white">
                  {system.label}
                </h3>
                <p
                  className={`shrink-0 border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${statusTone(
                    system.status,
                  )}`}
                >
                  {system.status}
                </p>
              </article>
            ))}
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
              No artificial citizens are active yet. The current work is about
              building the laws, records, and world boundaries that make
              continuity possible.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-5">
            {milestones.map((milestone) => (
              <article
                className="min-h-72 bg-dawn-coal/95 p-6 transition duration-300 hover:bg-[#10161d]"
                key={milestone.label}
              >
                <p className="font-display text-3xl text-dawn-amber">
                  {milestone.number}
                </p>
                <h3 className="mt-8 text-lg font-semibold text-white">
                  {milestone.label}
                </h3>
                <p className="mt-5 text-sm leading-7 text-stone-300">
                  {milestone.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[linear-gradient(180deg,#0d1117_0%,#07090b_100%)] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">
              Observatory
            </p>
            <h2 className="mt-4 font-display text-4xl text-white sm:text-5xl">
              The public site is not the simulation itself. It is the window
              into it.
            </h2>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
            {observatoryCards.map((card) => (
              <article
                className="min-h-56 bg-black/45 p-6 transition duration-300 hover:bg-[#10151a]"
                key={card.label}
              >
                <div className="mb-8 h-px w-16 bg-dawn-gold" />
                <h3 className="font-display text-3xl text-white">
                  {card.label}
                </h3>
                <p className="mt-5 text-sm leading-7 text-stone-300">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/10 bg-[#07090b] px-6 py-20 sm:px-10 lg:px-12">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(216,173,95,0.9),transparent)]" />
        <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
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
          <Link
            className="w-fit border border-dawn-gold/50 bg-dawn-gold/10 px-6 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-dawn-amber shadow-ember transition duration-300 hover:border-dawn-gold hover:bg-dawn-gold/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-dawn-gold/70 focus:ring-offset-2 focus:ring-offset-dawn-coal"
            href="/worlds/map"
          >
            Enter the Observatory
          </Link>
        </div>
      </section>
    </main>
  );
}