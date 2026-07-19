import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/accounts — قائمة
export async function GET() {
  const items = await prisma.account.findMany({ orderBy: { id: 'desc' } });
  return NextResponse.json(items);
}

// POST /api/accounts — إنشاء
export async function POST(request) {
  const data = await request.json();
  const created = await prisma.account.create({ data });
  return NextResponse.json(created, { status: 201 });
}
