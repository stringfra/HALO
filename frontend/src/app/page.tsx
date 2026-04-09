export default function Home() {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--ui-border)] bg-white/80 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
        Area Contenuto
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        Layout base pronto
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-[var(--ui-muted)] sm:text-base">
        Questa sezione ospiterà i moduli applicativi. Nel prossimo passaggio
        verranno aggiunte le voci effettive della sidebar.
      </p>
    </section>
  );
}
