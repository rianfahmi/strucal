import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { navigationItems } from "../../lib/navigation";

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
