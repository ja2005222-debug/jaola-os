import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/menu — قائمة
export async function GET() {
  const items = await prisma.menuItem.findMany({ orderBy: { id: 'desc' } });
  return NextResponse.json(items);
}

// POST /api/menu — إنشاء
export async function POST(request) {
  const data = await request.json();
  const created = await prisma.menuItem.create({ data });
  return NextResponse.json(created, { status: 201 });
}
