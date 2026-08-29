import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fbfbfa] px-6 text-center">
      <p className="text-6xl font-black text-slate-200">404</p>
      <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
      <p className="max-w-md text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 transition-colors"
      >
        Back to home
      </Link>
    </div>
  )
}
