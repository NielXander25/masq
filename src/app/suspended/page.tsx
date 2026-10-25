export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-semibold">Account suspended</h1>
      <p className="text-neutral-400">
        This account has been suspended and can&apos;t use Masq. If you think
        this is a mistake, contact support.
      </p>
    </main>
  );
}
