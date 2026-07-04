
import { motion } from 'framer-motion'
import { ArrowRight, Play, Code2, Shield, Cloud, BarChart3, Network, Cpu, Database } from 'lucide-react'

const agents = ['CEO','Planner','Architect','Designer','Frontend','Backend','Database','Security','QA','DevOps','Marketing','Cinema']
const capabilities = ['Generate SaaS','Travel Platforms','Ecommerce','Cinema','Marketing','Dashboards','Automation','APIs','Mobile Apps','CRM','ERP','Internal Tools']
const steps = ['Idea','CEO analyzes mission','Planner builds strategy','Architect designs system','Engineers write code','QA tests','Deploy publishes']

export default function LandingPage({ onStart = () => {} }) {
  
  return (
    <main className="min-h-screen overflow-hidden bg-[#05070f] text-white">
      {/* HERO */}
      <section className="relative min-h-screen px-6 py-8 grid-bg">
        <div className="absolute inset-0 gradient-orb opacity-70" />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between rounded-2xl glass px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 pulse-node flex items-center justify-center">⚡</div>
            <span className="text-lg font-semibold tracking-tight">JAOLA OS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#how" className="hover:text-white transition">Platform</a>
            <a href="#agents" className="hover:text-white transition">Agents</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>
          <button onClick={() => onStart()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 transition">
            Start Building
          </button>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 pt-28 lg:grid-cols-2">
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7 }}>
            <div className="mb-6 inline-flex rounded-full glass px-4 py-2 text-sm text-slate-300">
              ✦ Autonomous Software Engineering Company
            </div>
            <h1 className="text-5xl font-semibold tracking-tight md:text-7xl leading-tight">
              Build Software Like You Own an <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">AI Company.</span>
            </h1>
            <p className="mt-7 text-lg leading-8 text-slate-400">
              JAOLA OS transforms your idea into a complete software product using autonomous AI teams that plan, design, code, test, deploy, and optimize your business in real time.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button onClick={() => onStart()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-semibold text-black hover:bg-slate-200 transition">
                Start Building <ArrowRight size={18} />
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl glass px-6 py-4 font-semibold hover:bg-white/10 transition">
                <Play size={18} /> Watch Demo
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.8 }}>
            <div className="glass scanline rounded-3xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><p className="text-sm text-slate-400">Mission Control</p><h3 className="font-semibold">Building Travel SaaS</h3></div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">● Live</span>
              </div>
              <div className="space-y-3">
                {[['Planner','Strategy generated','100%'],['Architect','System design complete','92%'],['Frontend','Building interface','68%'],['Backend','Creating APIs','54%'],['QA','Waiting for build','18%']].map(([a,t,p]) => (
                  <div key={a} className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="mb-2 flex justify-between text-sm"><span>{a}</span><span className="text-slate-400">{p}</span></div>
                    <p className="mb-3 text-sm text-slate-400">{t}</p>
                    <div className="h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{width:p}} /></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">How It Works</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-16">From idea to deployed software.</h2>
          <div className="grid gap-4 md:grid-cols-7">
            {steps.map((step, i) => (
              <div key={step} className="rounded-3xl glass p-5">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 font-bold">{i+1}</div>
                <p className="text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section id="agents" className="px-6 py-28 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">Meet Your AI Company</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-16">AI employees with real responsibilities.</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent, i) => (
              <div key={agent} className="rounded-3xl glass p-5 hover:bg-white/10 transition">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/80 to-purple-500/80" />
                    <h3 className="font-semibold">{agent}</h3>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 pulse-node" />
                </div>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>Status: <span className="text-emerald-300">Online</span></p>
                  <p>Performance: <span className="text-white">{92 + (i % 7)}%</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">Capabilities</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-16">Build full software businesses.</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(item => (
              <div key={item} className="rounded-3xl glass p-6 hover:bg-white/[0.08] transition cursor-default">
                <Code2 className="mb-5 text-blue-300" />
                <h3 className="font-semibold">{item}</h3>
                <p className="mt-3 text-sm text-slate-400">Autonomous planning, design, engineering, QA, and deployment.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 py-28 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">Pricing</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-16">Choose your plan.</h2>
          <div className="grid gap-6 lg:grid-cols-3 max-w-4xl">
            {[['Starter','$49','For solo builders and startups'],['Professional','$149','For teams building real products'],['Enterprise','Custom','For companies scaling AI engineering']].map(([plan,price,desc],i) => (
              <div key={plan} className={`rounded-3xl p-7 ${i===1?'border border-blue-400/40 bg-blue-500/10':'glass'}`}>
                {i===1 && <div className="text-xs text-blue-300 font-bold mb-4 tracking-widest">RECOMMENDED</div>}
                <h3 className="text-xl font-semibold">{plan}</h3>
                <p className="mt-3 text-slate-400 text-sm">{desc}</p>
                <div className="mt-6 text-4xl font-bold">{price}</div>
                <button onClick={() => onStart()} className={`mt-8 w-full rounded-2xl px-5 py-3 font-semibold transition ${i===1?'bg-white text-black hover:bg-slate-200':'glass hover:bg-white/10 text-white'}`}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row">
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="text-xl">⚡</span><h3 className="font-semibold">JAOLA OS</h3></div>
            <p className="text-sm text-slate-500">Autonomous Software Engineering Company.</p>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <span>Product</span><span>Platform</span><span>Company</span>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 pulse-node" /><span className="text-emerald-400">All systems operational</span></div>
          </div>
        </div>
      </footer>
    </main>
  )
}
