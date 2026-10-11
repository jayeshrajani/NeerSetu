"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-fog-500">The page could not be rendered. The source data is unchanged.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-lg border keyline px-4 py-2 text-sm text-fog-300 hover:text-tide-200">
          Try again
        </button>
        <Link href="/" className="rounded-lg bg-tide-400 px-4 py-2 text-sm font-medium text-ink-950">
          Back to the ranking
        </Link>
      </div>
    </div>
  );
}
