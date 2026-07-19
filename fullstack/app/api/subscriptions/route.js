import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/subscriptions — قائمة
export async function GET() {
  const items = await prisma.subscription.findMany({ orderBy: { id: 'desc' } });
  return NextResponse.json(items);
}

// POST /api/subscriptions — إنشاء
export async function POST(request) {
  const data = await request.json();
  const created = await prisma.subscription.create({ data });
  return NextResponse.json(created, { status: 201 });
}
