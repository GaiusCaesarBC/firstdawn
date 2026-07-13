import Link from "next/link";

const coreSystems = [
  {
    label: "Planet",
    detail: "A deterministic sphere with persistent time, seed identity, and canonical physical constraints.",
  },
  {
    label: "Climate",
    detail: "Seasons, light, pressure, humidity, weather, and temperature change from world state.",
  },
  {
    label: "Terrain",
    detail: "Continents, oceans, coasts, watersheds, elevation, ruggedness, and starting regions.",
  },
  {
    label: "Plants",
    detail: "Plant suitability, biomass, edible growth, regrowth, stress, and biome support.",
  },
  {
    label: "Animals",
    detail: "Wildlife populations, habitat pressure, migration, predation, adaptation, and ecology.",
  },
  {
    label: "Humans",
    detail: "Needs, decisions, movement, emotion, goals, and daily life inside the same planet.",
  },
  {
    label: "Memory",
    detail: "Events become recollections, influence decisions, and accumulate into personal history.",
  },
  {
    label: "Families",
    detail: "Lineages, parents, children, homes, inheritance, and relationship continuity emerge.",
  },
  {
    label: "Discovery",
    detail: "Knowledge appears through exploration, observation, teaching, and repeated survival.",
  },
  {
    label: "Civilization",
    detail: "Early settlements, storage signals, families, and public histories exist; complex institutions remain future work.",
  },
];

const developmentStatus = [
  "deterministic planet",
  "ecology foundations",
  "human/family systems",
  "atlas observatory",
  "living dossier",
  "event timeline",
  "persistent survival systems coming next",
];

function PillLink({
  children,
  href,
  primary = false,
}: {
  children: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={
        primary
          ? "inline-flex w-fit rounded border border-dawn-gold/60 bg-dawn-gold/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-dawn-amber shadow-ember transition hover:border-dawn-gold hover:bg-dawn-gold/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-dawn-gold/70 focus:ring-offset-2 focus:ring-offset-dawn-coal"
          : "inline-flex w-fit rounded border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-200 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-dawn-coal"
      }
      href={href}
    >
      {children}
    </Link>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">{eyebrow}</p>
      <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">{title}</h2>
      {copy ? <p className="mt-5 text-base leading-7 text-stone-300 sm:text-lg">{copy}</p> : null}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-dawn-coal text-stone-100">
      <section className="relative flex min-h-[92vh] items-center border-b border-white/10">
        <div className="absolute inset-0 bg-[url('/first-dawn-observatory.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,8,0.96)_0%,rgba(5,6,8,0.74)_46%,rgba(5,6,8,0.22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,8,0.08)_0%,rgba(5,6,8,0.2)_55%,rgba(5,6,8,0.96)_100%)]" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-24 sm:px-10 lg:px-12">
          <p className="w-fit rounded border border-dawn-gold/40 bg-black/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-dawn-amber shadow-ember backdrop-blur">
            Public Living World
          </p>
          <h1 className="mt-7 font-display text-6xl font-semibold uppercase leading-[0.9] text-white sm:text-8xl lg:text-9xl">
            First Dawn
          </h1>
          <p className="mt-6 max-w-3xl font-display text-3xl leading-tight text-dawn-amber sm:text-5xl">
            A living world simulation from the first spark of life to civilization.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <PillLink href="/world" primary>
              View the Living World
            </PillLink>
            <PillLink href="#vision">Read the Vision</PillLink>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#08090b] px-6 py-20 sm:px-10 lg:px-12" id="vision">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionIntro eyebrow="What It Is" title="A planet where history is allowed to emerge." />
          <div className="space-y-5 text-base leading-8 text-stone-300 sm:text-lg">
            <p>
              First Dawn is a deterministic living planet simulation where climate, terrain, ecology, humans, memory,
              family, discovery, and civilization emerge over time.
            </p>
            <p>
              Its world is not a backdrop. The same seed produces the same terrain, the same pressures, the same
              ecological constraints, and the same long chain of consequences.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-dawn-ink px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <SectionIntro
            eyebrow="Live World Preview"
            title="The public window is read-only."
            copy="Open the current active world as a documentary broadcast: planet, time, people, settlements, story, and recent events without Atlas controls."
          />
          <Link
            className="group relative min-h-[360px] overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.45)] transition hover:border-dawn-gold/35"
            href="/world"
          >
            <div className="absolute inset-0 bg-[url('/first-dawn-observatory.png')] bg-cover bg-center opacity-80 transition duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,8,0.9),rgba(5,6,8,0.42)),radial-gradient(circle_at_68%_40%,rgba(216,173,95,0.24),transparent_38%)]" />
            <div className="relative flex min-h-[360px] flex-col justify-end p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-dawn-gold">Current Broadcast</p>
              <h3 className="mt-3 font-display text-4xl text-white sm:text-5xl">View the Living World</h3>
              <p className="mt-4 max-w-xl text-base leading-7 text-stone-300">
                The planet is observable, not editable. Watch the world wake up through public story and simulation state.
              </p>
            </div>
          </Link>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#07080a] px-6 py-20 sm:px-10 lg:px-12" id="systems">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Core Systems"
            title="Civilization is built from interacting causes."
            copy="Each layer is designed to feed the next, so the world can produce history without hand-authored outcomes."
          />
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {coreSystems.map((system, index) => (
              <article className="min-h-52 rounded-lg border border-white/10 bg-white/[0.035] p-5" key={system.label}>
                <p className="font-mono text-xs text-dawn-gold">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-6 font-display text-3xl text-white">{system.label}</h3>
                <p className="mt-4 text-sm leading-6 text-stone-400">{system.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0c0f] px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <SectionIntro eyebrow="Why It Matters" title="This is not a game map or a scripted story." />
          <div className="rounded-lg border border-white/10 bg-black/25 p-6">
            <p className="text-xl leading-9 text-stone-200">
              First Dawn is an observable synthetic world where history emerges from systems. A settlement matters
              because the terrain, weather, food, memory, family, and choices around it made it possible.
            </p>
            <p className="mt-5 text-base leading-8 text-stone-400">
              The project is designed for witnessing causality over time: what the world remembers, what people learn,
              where families remain, and how civilization becomes more than a label on a map.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-dawn-ink px-6 py-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Current Development Status"
            title="The foundation is alive, and the horizon is civilization."
            copy="First Dawn is actively evolving. The public viewer shows the world; internal Atlas tools remain available for development and observability."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {developmentStatus.map((item) => (
              <article className="bg-[#090b0f] p-5" key={item}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-dawn-gold">Active Track</p>
                <h3 className="mt-5 text-lg font-semibold capitalize text-white">{item}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#050608] px-6 py-20 sm:px-10 lg:px-12">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(216,173,95,0.9),transparent)]" />
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-dawn-gold">Watch the World Wake Up</p>
            <h2 className="mt-4 font-display text-5xl leading-tight text-white sm:text-6xl">Begin at the living world.</h2>
          </div>
          <PillLink href="/world" primary>
            Watch the World Wake Up
          </PillLink>
        </div>
      </section>
    </main>
  );
}
