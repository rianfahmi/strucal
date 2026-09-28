import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { navigationItems } from "../../lib/navigation";
import { ProjectData } from "../../components/project-data";
import { GeometryWorkspace } from "../../components/geometry-workspace";
import { MaterialWorkspace } from "../../components/material-workspace";
import { LoadWorkspace } from "../../components/load-workspace";
import { SeismicWorkspace } from "../../components/seismic-workspace";
import { EtabsWorkspace } from "../../components/etabs-workspace";
import { ReportWorkspaceView } from "../../components/report-workspace";

type PageProps = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = navigationItems.find((entry) => entry.href === `/${slug.join("/")}`);
  return item ? { title: item.label } : {};
}

export default async function ModulePage({ params }: PageProps) {
  const { slug } = await params;
  const item = navigationItems.find((entry) => entry.href === `/${slug.join("/")}`);
  if (!item || !("number" in item)) notFound();

  if (item.href === "/data-proyek") {
    return <div className="page"><header className="page-heading"><div><p className="eyebrow">Workspace proyek</p><h1>Data Proyek</h1><p className="page-description">Data tersimpan otomatis dan dapat dibuka kembali pada sesi berikutnya.</p></div></header><ProjectData /></div>;
  }

  if (item.href === "/geometri-model") {
    return <div className="page geometry-page"><header className="page-heading"><div><p className="eyebrow">Tahap 1 · Parameter Awal</p><h1>Geometri &amp; Model</h1><p className="page-description">Susun grid dan story, lalu validasi geometri pada viewer terpadu.</p></div></header><GeometryWorkspace /></div>;
  }

  if (item.href === "/material") {
    return <div className="page material-page"><header className="page-heading"><div><p className="eyebrow">Tahap 1 · Parameter Awal</p><h1>Material</h1><p className="page-description">Kelola properti beton dan tulangan dengan unit serta sumber nilai yang eksplisit.</p></div></header><MaterialWorkspace /></div>;
  }

  if (item.href === "/pembebanan") {
    return <div className="page load-page"><header className="page-heading"><div><p className="eyebrow">Tahap 1 · Parameter Awal</p><h1>Pembebanan</h1><p className="page-description">Definisikan load, tetapkan ke geometri aktif, dan review berat seismik serta registry kombinasi.</p></div></header><LoadWorkspace /></div>;
  }

  if (item.href === "/analisa-gempa") {
    return <div className="page seismic-page"><header className="page-heading"><div><p className="eyebrow">Tahap 1 · Parameter Awal</p><h1>Analisa Gempa</h1><p className="page-description">Input mentah, review KDS dan sistem struktur, lalu hasil seismik dengan trace perhitungan.</p></div></header><SeismicWorkspace /></div>;
  }

  if (item.href === "/input-etabs") {
    return <div className="page etabs-page"><header className="page-heading"><div><p className="eyebrow">Tahap 1 · Handoff Manual</p><h1>Input ETABS</h1><p className="page-description">Ringkasan otomatis dari revisi proyek aktif. Koreksi data dilakukan di modul sumber.</p></div></header><EtabsWorkspace /></div>;
  }

  if (item.href === "/generate-1") {
    return <div className="page report-page"><header className="page-heading"><div><p className="eyebrow">Tahap 1 · Report Snapshot</p><h1>Generate #1</h1><p className="page-description">Review struktur, tabel, gambar, caption, dan revisi sebelum menghasilkan DOCX.</p></div></header><ReportWorkspaceView /></div>;
  }

  return (
    <div className="page">
      <header className="page-heading"><div><p className="eyebrow">Workspace proyek</p><h1>{item.label}</h1><p className="page-description">Halaman siap dalam shell aplikasi. Fitur modul mengikuti milestone terkait.</p></div></header>
      <section className="panel module-placeholder">
        <span className="placeholder-mark" aria-hidden="true">{item.number}</span>
        <div><h2>Belum ada data untuk ditampilkan</h2><p>Modul {item.label} belum diimplementasikan pada M1.</p><Link className="button button-secondary" href="/">Kembali ke Overview</Link></div>
      </section>
    </div>
  );
}
