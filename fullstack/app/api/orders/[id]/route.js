import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/orders/[id]
export async function GET(_request, { params }) {
  const item = await prisma.order.findUnique({ where: { id: Number(params.id) } });
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

// PUT /api/orders/[id]
export async function PUT(request, { params }) {
  const data = await request.json();
  const updated = await prisma.order.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json(updated);
}

// DELETE /api/orders/[id]
export async function DELETE(_request, { params }) {
  await prisma.order.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ deleted: true });
}
