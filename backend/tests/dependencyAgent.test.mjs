// 📦 كشف التبعيات — وحدات Node المدمجة (crypto/fs/path/node:*) كانت تُضاف
// كحزم npm فتُفشل "npm install" على Vercel (exit 1) → DEPLOYMENT_NOT_FOUND.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDependencies, generatePackageJson } from '../agents/dependencyAgent.js';

test('وحدات Node المدمجة والاستيرادات المحلية لا تُعدّ حزم npm', () => {
    const files = [{
        name: 'api/orders.js', content: `
        import crypto from 'crypto';
        import { readFile } from 'node:fs/promises';
        import path from 'path';
        import http from 'http';
        import mongoose from 'mongoose';
        import Order from '../models/Order.js';
        import { db } from './db.js';
        export default function handler(req, res) {}`,
    }];
    const { dependencies } = detectDependencies(files);
    assert.ok(dependencies.includes('mongoose'), 'mongoose حزمة حقيقية → مضمّنة');
    for (const builtin of ['crypto', 'fs', 'path', 'http', 'node:fs']) {
        assert.ok(!dependencies.includes(builtin), `${builtin} مدمجة → مستبعدة`);
    }
    assert.ok(!dependencies.some(d => d.includes('models') || d.includes('db')), 'الاستيراد المحلي مستبعد');
});

test('package.json الناتج لا يحوي وحدات مدمجة (npm install ينجح)', () => {
    const files = [{ name: 'api/auth.js', content: 'import crypto from "crypto"; import jwt from "jsonwebtoken";' }];
    const pkg = JSON.parse(generatePackageJson('app', files, 'web'));
    assert.ok(pkg.dependencies.jsonwebtoken, 'jsonwebtoken مضمّن');
    assert.equal(pkg.dependencies.crypto, undefined, 'crypto ليست تبعية');
    assert.equal(pkg.dependencies['node:fs'], undefined);
});

test('حزم native والمجهولة تُستبعد (خطأ .lzz/v8 + npm install exit 1)', () => {
    const files = [{ name: 'api/x.js', content: 'import bcrypt from "bcrypt"; import sharp from "sharp"; import mongoose from "mongoose"; import z from "totally-unknown-pkg-xyz";' }];
    const pkg = JSON.parse(generatePackageJson('app', files, 'web'));
    assert.equal(pkg.dependencies.bcrypt, undefined, 'bcrypt native → مستبعد');
    assert.equal(pkg.dependencies.sharp, undefined, 'sharp native → مستبعد');
    assert.equal(pkg.dependencies['totally-unknown-pkg-xyz'], undefined, 'مجهول → مستبعد لا latest');
    assert.ok(pkg.dependencies.mongoose, 'النقية المعروفة محفوظة');
    assert.ok(pkg.dependencies.bcryptjs, 'استخدام bcrypt → يُضاف البديل النقي bcryptjs');
});
