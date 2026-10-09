// Two isolated localhost origins, shared synthetic chat server. Never calls a live API.
// Build first, then: node tests/staff-chat-preview.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve('dist/auspira-care360-web/browser');
const users = [
  { userId: '11111111-1111-4111-8111-111111111111', name: 'Alex Morgan', department: 'Ward coordination', role: 'Hospital administrator' },
  { userId: '22222222-2222-4222-8222-222222222222', name: 'Dr Maya Rao', department: 'General medicine', role: 'Doctor' },
  { userId: '33333333-3333-4333-8333-333333333333', name: 'Nurse Priya Shah', department: 'General ward', role: 'Nurse' },
  { userId: '44444444-4444-4444-8444-444444444444', name: 'Sam Wilson', department: 'Reception', role: 'Receptionist' }
];
const permissions = [...fs.readFileSync('src/app/app.routes.ts', 'utf8').matchAll(/permission: '([^']+)'/g)].map(match => match[1]);
const rooms = [], failures = new Map(), writes = [];
function room(kind, title, ids, creator = users[0].userId, requestId = randomUUID()) {
  const value = { id: randomUUID(), kind, title, branchCode: 'MAIN', createdBy: creator, requestId, updatedAt: new Date().toISOString(),
    members: ids.map(userId => ({ userId, role: kind === 'GROUP' && userId === creator ? 'ADMIN' : 'MEMBER', lastReadSequence: 0, active: true })), messages: [] };
  rooms.push(value); return value;
}
function message(room, actor, body, clientMessageId = randomUUID()) {
  const result = { id: randomUUID(), clientMessageId, conversationId: room.id, sequence: room.messages.length + 1, senderId: actor.userId, senderName: actor.name, body, createdAt: new Date().toISOString() };
  room.messages.push(result); room.updatedAt = result.createdAt; return result;
}
const direct = room('DIRECT', '', [users[0].userId, users[1].userId]);
message(direct, users[1], 'Good morning, Alex. Can we bring the ward team together for today’s handover?');
message(direct, users[0], 'Yes, I have created the ward coordination group.');
message(direct, users[1], 'Thank you. I will post the round updates there.');
const group = room('GROUP', 'General ward · Handover', users.slice(0, 3).map(user => user.userId));
message(group, users[2], 'Morning handover is ready. Please add any coordination updates here.');
message(group, users[1], 'Thanks, Priya. I am joining the ward round shortly.');
function member(room, actor) { return room.members.find(member => member.userId === actor.userId && member.active); }
function serialRoom(room, actor) {
  const mine = member(room, actor);
  return { id: room.id, branchCode: room.branchCode, kind: room.kind, title: room.kind === 'GROUP' ? room.title : users.find(user => room.members.some(member => member.userId === user.userId && user.userId !== actor.userId))?.name || 'Colleague', updatedAt: room.updatedAt, lastSequence: room.messages.length, lastReadSequence: mine.lastReadSequence, myRole: mine.role, memberCount: room.members.filter(member => member.active).length, unreadCount: room.messages.filter(message => message.senderId !== actor.userId && message.sequence > mine.lastReadSequence).length, lastMessage: room.messages.at(-1)?.body || '', lastSenderName: room.messages.at(-1)?.senderName || '' };
}
function serialMessage(room, value) { const recipients = room.members.filter(member => member.active && member.userId !== value.senderId); return { ...value, recipientCount: recipients.length, deliveredCount: 0, readCount: recipients.filter(member => member.lastReadSequence >= value.sequence).length }; }
const handler = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'");
  const portUser = req.socket.localPort === 4322 ? users[1] : users[0];
  const actor = users.find(user => req.headers.authorization === 'Bearer sample-' + user.userId) || portUser;
  const session = { userId: actor.userId, email: 'staff@example.test', fullName: actor.name, accessToken: 'sample-' + actor.userId, refreshToken: 'sample', accessTokenExpiresAt: '2099-01-01T00:00:00Z', permissions, roleCodes: ['HOSPITAL_ADMIN'], menuItems: [], hospitalName: 'Sample Hospital', tenantCode: 'chat-preview' };
  const reply = (data, status = 200, success = true, text = '') => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success, statusCode: status, message: text, data })); };
  if (url.pathname === '/fixture') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<script>localStorage.clear();localStorage.setItem('care360.auth.session',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('care360.selectedBranchCode','MAIN');location.replace('/chat');</script>`);
  }
  if (url.pathname === '/fixture/control' && req.method === 'POST') {
    failures.set(portUser.userId, url.searchParams.get('mode') || 'online'); return reply({ mode: failures.get(portUser.userId) });
  }
  if (url.pathname === '/fixture/state') return reply({ rooms, writes });
  if (url.pathname.includes('/api/v1/')) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {}, api = url.pathname.replace('/api/v1', '');
    if (req.method !== 'GET') writes.push({ actor: actor.userId, api, body });
    if (api === '/auth/me') return reply(session);
    if (api === '/administration/hospital') return reply({ hospitalName: 'Sample Hospital' });
    if (api === '/administration/branch-context') return reply({ organizationAccess: false, branches: [{ branchGuid: randomUUID(), hospitalGuid: randomUUID(), branchCode: 'MAIN', branchName: 'Central hospital', isDefault: true, isActive: true }] });
    if (api.includes('/localization/catalog')) return reply({ version: 1, effectiveCulture: 'en-US', languages: [], resources: {}, seedDataSets: [] });
    if (api.includes('/localization/version')) return reply({ version: 1 });
    if (api === '/notification-inbox') return reply({ items: [], unreadCount: 0, total: 0 });
    if (api === '/notification-inbox/refresh') return reply({ refreshed: true });
    if (api === '/chat/staff') return reply(users.filter(user => user.userId !== actor.userId && (user.name + user.department).toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase())));
    if (api === '/chat/conversations' && req.method === 'GET') return reply(rooms.filter(room => member(room, actor)).map(room => serialRoom(room, actor)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    if (api === '/chat/conversations' && req.method === 'POST') {
      const ids = [...new Set([actor.userId, ...body.memberIds])];
      const existing = rooms.find(value => value.createdBy === actor.userId && value.requestId === body.requestId || body.kind === 'DIRECT' && value.kind === 'DIRECT' && value.members.length === ids.length && value.members.every(member => ids.includes(member.userId)));
      return reply({ id: (existing || room(body.kind, body.title, ids, actor.userId, body.requestId)).id });
    }
    if (api.startsWith('/chat/conversations/')) {
      const id = api.split('/')[3], conversation = rooms.find(value => value.id === id);
      if (!conversation || !member(conversation, actor)) return reply(null, 404, false, 'Conversation unavailable');
      if (api.endsWith('/members')) return reply(conversation.members.filter(member => member.active).map(member => ({ ...users.find(user => user.userId === member.userId), role: member.role, lastReadSequence: member.lastReadSequence, available: true })));
      if (api.endsWith('/messages') && req.method === 'GET') {
        const after = url.searchParams.get('after'), before = url.searchParams.get('before');
        let values = conversation.messages.filter(message => after ? message.sequence > +after : before ? message.sequence < +before : true);
        const limit = after !== null ? 100 : 50, hasMore = values.length > limit;
        values = after !== null ? values.slice(0, limit) : values.slice(-limit);
        return reply({ items: values.map(value => serialMessage(conversation, value)), hasMore });
      }
      if (api.endsWith('/messages') && req.method === 'POST') {
        const mode = failures.get(actor.userId);
        if (mode === 'offline') return reply(null, 503, false, 'Synthetic connection interruption');
        const existing = rooms.flatMap(room => room.messages).find(value => value.senderId === actor.userId && value.clientMessageId === body.clientMessageId);
        if (existing && (existing.body !== body.body || existing.conversationId !== id)) return reply(null, 409, false, 'Message identity conflict');
        const value = existing || message(conversation, actor, body.body, body.clientMessageId);
        if (mode === 'lost-ack') { failures.set(actor.userId, 'online'); return reply(null, 503, false, 'Synthetic acknowledgement loss after commit'); }
        return reply(serialMessage(conversation, value));
      }
      if (api.endsWith('/read')) { member(conversation, actor).lastReadSequence = Math.max(member(conversation, actor).lastReadSequence, body.throughSequence); return reply({ read: true }); }
      if (api.endsWith('/manage')) {
        const mine = member(conversation, actor);
        if (body.action !== 'LEAVE' && mine.role !== 'ADMIN') return reply(null, 403, false, 'Administrator required');
        if (body.action === 'RENAME') conversation.title = body.title;
        if (body.action === 'ADD') { const existing = conversation.members.find(member => member.userId === body.userId); if (existing) existing.active = true; else conversation.members.push({ userId: body.userId, role: 'MEMBER', lastReadSequence: 0, active: true }); }
        if (body.action === 'PROMOTE') conversation.members.find(member => member.userId === body.userId).role = 'ADMIN';
        if (body.action === 'REMOVE') conversation.members.find(member => member.userId === body.userId).active = false;
        if (body.action === 'LEAVE') { if (mine.role === 'ADMIN' && !conversation.members.some(member => member.active && member.role === 'ADMIN' && member.userId !== actor.userId)) return reply(null, 400, false, 'Promote another administrator first.'); mine.active = false; }
        return reply({ saved: true });
      }
    }
    if (req.method !== 'GET') return reply(null, 400, false, 'Unsupported preview operation');
    return reply([]);
  }
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[ext] || 'application/octet-stream');
  if (ext === '.js') return res.end(fs.readFileSync(file, 'utf8').replaceAll('https://auspira-tech-360-product-api.onrender.com/api/v1', '/api/v1'));
  fs.createReadStream(file).pipe(res);
};
for (const port of [4321, 4322]) http.createServer(handler).listen(port, '127.0.0.1', () => console.log(`Sample ${port === 4321 ? 'Alex' : 'Maya'} chat: http://127.0.0.1:${port}/fixture`));
