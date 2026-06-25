async function refreshDashboard() {
  try {

    loadKPIs();
    loadProjects();
    loadAgents();
    loadArchitecture();
    loadDecisions();
    loadHealth();

  } catch (err) {
    console.error(err);
  }
}

async function loadKPIs() {

  try {

    const kpis = await API.getKPIs();

    document.getElementById('kpiProjects').textContent =
      kpis.projects ?? 0;

    document.getElementById('kpiTasks').textContent =
      kpis.tasks ?? 0;

    document.getElementById('kpiDeployments').textContent =
      kpis.deployments ?? 0;

    document.getElementById('kpiSuccess').textContent =
      `${kpis.successRate ?? 0}%`;

  } catch (err) {
    console.error(err);
  }

}

async function loadProjects() {

  try {

    const projects = await API.getProjects();

    const container =
      document.getElementById('projectList');

    container.innerHTML = '';

    projects.forEach(project => {

      const div = document.createElement('div');

      div.className =
        'glass rounded-xl p-3 cursor-pointer hover:bg-zinc-800';

      div.innerHTML = `
        <div class="font-medium">
          ${project.name}
        </div>
        <div class="text-xs text-zinc-400">
          ${project.status || 'Active'}
        </div>
      `;

      container.appendChild(div);

    });

  } catch (err) {
    console.error(err);
  }

}

async function loadAgents() {

  try {

    const agents = await API.getAgents();

    const grid =
      document.getElementById('agentsGrid');

    grid.innerHTML = '';

    agents.forEach(agent => {

      const card =
        document.createElement('div');

      const online =
        agent.status === 'online';

      card.className =
        'glass rounded-2xl p-4';

      card.innerHTML = `

      <div class="flex items-center justify-between">

        <div class="font-semibold">
          ${agent.name}
        </div>

        <span class="
          status-dot
          ${online
            ? 'status-online'
            : 'status-error'}
        ">
        </span>

      </div>

      <div class="text-sm text-zinc-400 mt-3">
        ${agent.task || 'Idle'}
      </div>

      <div class="mt-4">

        <div class="text-xs text-zinc-500">
          Success Rate
        </div>

        <div class="mt-1 font-bold">
          ${agent.successRate || 100}%
        </div>

      </div>

      `;

      grid.appendChild(card);

    });

  } catch (err) {
    console.error(err);
  }

}

async function loadArchitecture() {

  try {

    const tree =
      await API.getArchitecture();

    document.getElementById(
      'architectureTree'
    ).textContent =
      JSON.stringify(tree, null, 2);

  } catch (err) {
    console.error(err);
  }

}

async function loadDecisions() {

  try {

    const decisions =
      await API.getDecisions();

    const panel =
      document.getElementById(
        'decisionPanel'
      );

    panel.innerHTML = '';

    decisions
      .slice(0, 5)
      .forEach(item => {

        const div =
          document.createElement('div');

        div.className =
          'border-b border-zinc-800 py-2';

        div.innerHTML = `
          <div class="font-medium">
            ${item.title || 'Decision'}
          </div>

          <div class="text-xs text-zinc-400">
            ${item.summary || ''}
          </div>
        `;

        panel.appendChild(div);

      });

  } catch (err) {
    console.error(err);
  }

}

async function loadHealth() {

  try {

    const health =
      await API.getHealth();

    const git =
      await API.getGit();

    const qa =
      await API.getQA();

    document.getElementById(
      'healthPanel'
    ).innerHTML = `

      <div class="space-y-3">

        <div>
          Build:
          <b>${health.build || 'Unknown'}</b>
        </div>

        <div>
          Git:
          <b>${git.status || 'Unknown'}</b>
        </div>

        <div>
          QA:
          <b>
            ${
              qa.passed
                ? 'Passed'
                : 'Pending'
            }
          </b>
        </div>

      </div>

    `;

  } catch (err) {
    console.error(err);
  }

}

function appendActivity(message) {

  const feed =
    document.getElementById(
      'activityFeed'
    );

  const item =
    document.createElement('div');

  item.className =
    'border-b border-zinc-800 pb-2';

  item.innerHTML = `
    <div class="text-zinc-300">
      ${message.text || ''}
    </div>
  `;

  feed.prepend(item);

}

function updateAgentCard(data) {

  console.log(
    'Agent Update',
    data
  );

  loadAgents();

}

document
  .getElementById(
    'executeMission'
  )
  .addEventListener(
    'click',
    async () => {

      const prompt =
        document.getElementById(
          'commandInput'
        ).value;

      if (!prompt.trim()) return;

      try {

        await fetch(
          '/api/chat',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              message: prompt
            })
          }
        );

      } catch (err) {
        console.error(err);
      }

    }
  );

refreshDashboard();

setInterval(
  refreshDashboard,
  15000
);
