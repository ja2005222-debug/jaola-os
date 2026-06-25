import express from 'express';
import { createRepo, commitAndPush, createPullRequest, createIssue, getRepoInfo } from '../agents/github.agent.js';

const router = express.Router();

router.post('/repo', async (req, res) => {
    try { res.json(await createRepo(req.body.name, req.body.description, req.body.private)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/commit', async (req, res) => {
    try { res.json(await commitAndPush(req.body.repoName, req.body.message, req.body.branch)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pr', async (req, res) => {
    try { res.json(await createPullRequest(req.body.repoName, req.body.title, req.body.body, req.body.headBranch, req.body.baseBranch)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/issue', async (req, res) => {
    try { res.json(await createIssue(req.body.repoName, req.body.title, req.body.body, req.body.labels)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/repo/:name', async (req, res) => {
    try { res.json(await getRepoInfo(req.params.name)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
