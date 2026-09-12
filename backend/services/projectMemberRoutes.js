/** Team management requires the project administrator. Login never accepts client grants. */
export function registerProjectMemberRoutes(app, { adminGuard, limit, verifyProjectToken, cloneId, store, roles, bindings }) {
    const identity = req => verifyProjectToken(req.body?.token || req.query?.token);
    const unavailable = (res, error) => res.status(error.status || 503).json({ error: error.code || 'TEAM_UNAVAILABLE' });
    app.post('/api/public/auth/member-login', limit, async (req, res) => {
        const project = identity(req);
        if (!project?.u || !project?.p) return res.status(401).json({ ok: false });
        try {
            const result = await store().login(project.u, project.p, cloneId(project.u, project.p), req.body);
            res.set('Cache-Control', 'no-store');
            return result ? res.json(result) : res.status(401).json({ ok: false });
        } catch (error) { return unavailable(res, error); }
    });
    app.get('/api/public/team', limit, adminGuard, async (req, res) => {
        if (req.projectSession.role !== 'project-admin') return res.status(403).json({ error: 'ADMIN_REQUIRED' });
        const { user, project } = req.projectSession;
        try {
            res.set('Cache-Control', 'no-store').json({ accounts: await store().list(user, project),
                roles: roles(cloneId(user, project)), bindings: await bindings(user, project) });
        } catch (error) { unavailable(res, error); }
    });
    app.post('/api/public/team', limit, adminGuard, async (req, res) => {
        if (req.projectSession.role !== 'project-admin') return res.status(403).json({ error: 'ADMIN_REQUIRED' });
        const { user, project } = req.projectSession;
        try {
            const id = cloneId(user, project);
            const role = roles(id).find(item => item.id === req.body?.role);
            if (!role) return res.status(400).json({ error: 'ROLE_NOT_AVAILABLE' });
            if (role.requiresRecord && !(await bindings(user, project)).some(row => row.id === req.body.recordId)) {
                return res.status(400).json({ error: 'أضف السجل أولاً ثم اختره لهذا الحساب.' });
            }
            res.json({ account: await store().save(user, project, id, req.body) });
        } catch (error) { unavailable(res, error); }
    });
    app.delete('/api/public/team/:account', limit, adminGuard, async (req, res) => {
        if (req.projectSession.role !== 'project-admin') return res.status(403).json({ error: 'ADMIN_REQUIRED' });
        const { user, project } = req.projectSession;
        try { res.json(await store().revoke(user, project, req.params.account)); }
        catch (error) { unavailable(res, error); }
    });
}
