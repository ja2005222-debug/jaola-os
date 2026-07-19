import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const items = await prisma.account.findMany({ orderBy: { id: 'desc' } });
  return (
    <main className="container">
      <h1>delev</h1>
      <p className="subtitle">منصة SaaS — Next.js + API + Prisma</p>
      <div className="grid">
        {items.map((item) => (
          <article key={item.id} className="card">
            <h3>{item.name}</h3>
            <pre>{JSON.stringify(item, null, 2)}</pre>
          </article>
        ))}
      </div>
    </main>
  );
}
