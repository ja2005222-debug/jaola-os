import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../../frontend/src/hooks/useAuth.js', import.meta.url), 'utf8');
const socket = fs.readFileSync(new URL('../../frontend/src/hooks/useSocket.js', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../../frontend/src/pages/Dashboard.jsx', import.meta.url), 'utf8');

test('فحص الملكية لا ينشئ مشروعاً مفقوداً للحساب الطالب', () => {
  const block = server.slice(server.indexOf('async function validateProjectOwnership'), server.indexOf('// إنشاء نسخة احتياطية'));
  assert.match(block, /const projectRecord = await DB\.findProject\(safeProject, username\)/);
  assert.doesNotMatch(block, /DB\.createProject/);
  assert.match(block, /status\(403\)/);
});

test('الانضمام والتبديل لا يحوّلان اسم مشروع حساب آخر إلى مشروع جديد', () => {
  const join = server.slice(server.indexOf("socket.on('join_project'"), server.indexOf("socket.on('abort_mission'"));
  const change = server.slice(server.indexOf("app.post('/api/project-context/switch'"), server.indexOf('// 🗑️ منطق الحذف الكامل'));
  assert.doesNotMatch(join, /DB\.createProject/);
  assert.match(join, /project_access_denied/);
  assert.doesNotMatch(change, /DB\.createProject/);
  assert.match(change, /status\(403\)/);
});

test('حالة المشروع في المتصفح معزولة باسم المستخدم وتتغير مع هوية OAuth', () => {
  assert.match(socket, /activeProject:\$\{username/);
  assert.match(socket, /authUsername/);
  assert.match(socket, /authToken/);
  assert.match(socket, /socket\.disconnect\(\)/);
  assert.match(auth, /previousUser && previousUser !== u/);
});

test('اختيار موقع/سيستم محفوظ لكل حساب ومشروع ولا يعود افتراضياً عند تحديث الصفحة', () => {
  assert.match(dashboard, /jaola:buildTrack:\$\{owner\}:\$\{activeProject\}/);
  assert.match(dashboard, /saved === 'system' \? 'system' : 'site'/);
});
