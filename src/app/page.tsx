import Link from "next/link";

const stages = [
  { number: "01", title: "Parameter Awal", detail: "0 dari 7 bagian selesai", status: "Belum dimulai" },
  { number: "02", title: "Hasil Analisis", detail: "Menunggu parameter awal", status: "Menunggu" },
  { number: "03", title: "Desain", detail: "Menunggu hasil analisis", status: "Menunggu" },
];

export default function OverviewPage() {
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Overview proyek</p>
          <h1>Proyek Baru</h1>
          <p className="page-description">Ringkasan progres, status milestone, dan keluaran proyek.</p>
        </div>
        <Link className="button button-primary" href="/data-proyek">Mulai Data Proyek <span aria-hidden="true">›</span></Link>
      </header>

      <section className="summary-grid" aria-label="Ringkasan proyek">
        <article className="summary-card"><span>Kelengkapan proyek</span><strong>0%</strong><div className="progress" aria-label="Kelengkapan proyek 0 persen"><span /></div></article>
        <article className="summary-card"><span>Revisi terbaru</span><strong>Revisi 0</strong><small>Draft awal</small></article>
        <article className="summary-card"><span>Dependency stale</span><strong>0</strong><small>Belum ada perubahan downstream</small></article>
        <article className="summary-card"><span>Laporan terakhir</span><strong>—</strong><small>Belum ada laporan</small></article>
      </section>

      <div className="overview-grid">
        <section className="panel" aria-labelledby="milestone-title">
          <div className="panel-heading">
            <div><p className="eyebrow">Workflow</p><h2 id="milestone-title">Status milestone</h2></div>
            <span className="badge badge-review">Perlu input</span>
          </div>
          <ol className="stage-list">
            {stages.map((stage, index) => (
              <li key={stage.number}>
                <span className={`stage-number ${index === 0 ? "current" : ""}`}>{stage.number}</span>
                <div className="stage-copy"><strong>{stage.title}</strong><span>{stage.detail}</span></div>
                <span className="stage-status">{stage.status}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="panel next-step" aria-labelledby="next-step-title">
          <p className="eyebrow">Langkah berikutnya</p>
          <h2 id="next-step-title">Lengkapi identitas proyek</h2>
          <p>Mulai dari data bangunan, kriteria desain, dan standar aktif proyek.</p>
          <Link className="button button-secondary" href="/data-proyek">Buka Data Proyek</Link>
          <div className="standard-list" aria-label="Standar baseline"><span>SNI 1726:2019</span><span>SNI 1727:2020</span><span>SNI 2847:2019</span></div>
        </aside>
      </div>

      <section className="panel reports-panel" aria-labelledby="reports-title">
        <div className="panel-heading"><div><p className="eyebrow">Output</p><h2 id="reports-title">Laporan terbaru</h2></div></div>
        <div className="empty-state"><span aria-hidden="true">▤</span><div><strong>Belum ada laporan</strong><p>Generate #1 tersedia setelah parameter awal dan input ETABS lengkap.</p></div></div>
      </section>
    </div>
  );
}
