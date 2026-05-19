import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="space-y-10">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-stone-900">
          Cook this <span className="text-impulse-600">impulsively.</span>
        </h1>
        <p className="text-lg text-stone-600 max-w-2xl mx-auto">
          Paste any recipe URL. We&rsquo;ll generate an Impulse cooktop-friendly
          cooking card &mdash; mode, temperature, timing, and sensory cues
          tuned to your pan and experience level.
        </p>
        <div className="pt-4">
          <Link
            href="/new"
            className="inline-block bg-impulse-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-impulse-700"
          >
            Cook This Impulsively
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Step
          n={1}
          title="Paste a recipe URL"
          body="We extract the title, ingredients, yield, and instructions. If extraction fails, paste them in manually."
        />
        <Step
          n={2}
          title="Tell us about your setup"
          body="Pan type, experience level, and what you're trying to do — sear, simmer, fry, reduce."
        />
        <Step
          n={3}
          title="Get your adaptation card"
          body="Impulse mode, temperature range, timing tweaks, and what to look, listen, and smell for. Original recipe stays where it is."
        />
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="text-impulse-600 font-bold text-sm">STEP {n}</div>
      <div className="mt-1 font-semibold">{title}</div>
      <p className="mt-2 text-sm text-stone-600">{body}</p>
    </div>
  );
}
