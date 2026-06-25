import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_USERNAME;

// إنشاء مستودع جديد
export async function createRepo(name, description = '', isPrivate = false) {
  const response = await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init: true
  });
  return response.data;
}

// رفع التغييرات (commit + push) إلى مستودع موجود
export async function commitAndPush(repoName, commitMessage, branch = 'main') {
  const repoPath = `${process.env.JAOLA_PATH}`; // مجلد المشروع الحالي
  // تأكد من ربط remote origin
  await execPromise(`cd ${repoPath} && git remote set-url origin https://${process.env.GITHUB_TOKEN}@github.com/${owner}/${repoName}.git`);
  await execPromise(`cd ${repoPath} && git add .`);
  await execPromise(`cd ${repoPath} && git commit -m "${commitMessage}"`);
  await execPromise(`cd ${repoPath} && git push origin ${branch}`);
  return { success: true, message: `Pushed to ${repoName}` };
}

// إنشاء Pull Request
export async function createPullRequest(repoName, title, body, headBranch, baseBranch = 'main') {
  const response = await octokit.pulls.create({
    owner,
    repo: repoName,
    title,
    body,
    head: headBranch,
    base: baseBranch
  });
  return response.data;
}

// إنشاء Issue
export async function createIssue(repoName, title, body, labels = []) {
  const response = await octokit.issues.create({
    owner,
    repo: repoName,
    title,
    body,
    labels
  });
  return response.data;
}

// جلب معلومات المستودع (stars, forks, last commit)
export async function getRepoInfo(repoName) {
  const response = await octokit.repos.get({ owner, repo: repoName });
  const commits = await octokit.repos.listCommits({ owner, repo: repoName, per_page: 1 });
  return {
    name: response.data.name,
    stars: response.data.stargazers_count,
    forks: response.data.forks_count,
    lastCommit: commits.data[0]?.commit.message || 'No commits',
    url: response.data.html_url
  };
}
