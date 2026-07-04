import { useEffect, useState } from 'react'

import { motion } from 'framer-motion'

const messages = [
  'Initializing JAOLA OS...',
  'Connecting AI Company...',
  'Loading Knowledge Base...',
  'Hiring AI Agents...',
  'Synchronizing Mission Control...',
  'Activating Digital Twin...',
  'Mission Control Ready.',
]

export default function BootSequence({ onDone = () => {} }) {
  
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActive(prev => prev >= messages.length - 1 ? prev : prev + 1)
    }, 550)
    const timeout = setTimeout(() => onDone(), 4600)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [])

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#05070f] text-white grid-bg">
      <div className="absolute inset-0 gradient-orb opacity-70" />
      <div className="relative z-10 w-full max-w-xl px-6">
        <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} className="rounded-3xl glass p-8">
          <div className="mx-auto mb-8 h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 pulse-node flex items-center justify-center text-3xl">⚡</div>
          <h1 className="text-center text-3xl font-semibold tracking-tight">JAOLA OS</h1>
          <p className="mt-3 text-center text-sm text-slate-400">Autonomous Software Engineering Company</p>
          <div className="mt-10 space-y-3 font-mono text-sm">
            {messages.map((msg, i) => (
              <motion.div key={msg} initial={{ opacity:0, x:-8 }} animate={{ opacity: i <= active ? 1 : 0.25, x: i <= active ? 0 : -8 }}
                className={i <= active ? 'text-blue-200' : 'text-slate-600'}>
                {i <= active ? '>' : ' '} {msg}
              </motion.div>
            ))}
          </div>
          <div className="mt-8 h-2 rounded-full bg-white/10">
            <motion.div className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400"
              animate={{ width: `${((active + 1) / messages.length) * 100}%` }} transition={{ duration: 0.4 }} />
          </div>
        </motion.div>
      </div>
    </main>
  )
}
