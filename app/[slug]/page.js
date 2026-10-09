import { notFound } from 'next/navigation';
import AdminClient from './AdminClient';
export const dynamic = 'force-dynamic';

export default function Page({ params }) {
  if (!process.env.ADMIN_SLUG || params.slug !== process.env.ADMIN_SLUG) notFound();
  return <AdminClient />;
}
