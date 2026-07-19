import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/orders — قائمة
export async function GET() {
  const items = await prisma.order.findMany({ orderBy: { id: 'desc' } });
  return NextResponse.json(items);
}

// POST /api/orders — إنشاء
export async function POST(request) {
  const data = await request.json();
  const created = await prisma.order.create({ data });
  return NextResponse.json(created, { status: 201 });
}
