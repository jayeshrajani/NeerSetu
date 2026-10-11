import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="num text-sm text-tide-300">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Not in the source data</h1>
      <p className="mt-3 text-fog-500">That ghat or page does not exist. GhatWatch only covers the seven Bhopal sites in the supplied MPPCB pack.</p>
      <Link href="/" className="mt-6 inline-flex rounded-lg bg-tide-400 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-tide-300">
        Back to the ranking
      </Link>
    </div>
  );
}
