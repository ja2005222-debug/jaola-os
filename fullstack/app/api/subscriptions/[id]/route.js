import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/subscriptions/[id]
export async function GET(_request, { params }) {
  const item = await prisma.subscription.findUnique({ where: { id: Number(params.id) } });
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

// PUT /api/subscriptions/[id]
export async function PUT(request, { params }) {
  const data = await request.json();
  const updated = await prisma.subscription.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json(updated);
}

// DELETE /api/subscriptions/[id]
export async function DELETE(_request, { params }) {
  await prisma.subscription.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ deleted: true });
}
