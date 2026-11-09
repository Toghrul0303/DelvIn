import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  Clock3,
  GraduationCap,
  Lightbulb,
  ListChecks,
  MousePointer2,
  NotebookTabs,
  PanelTop,
  Sparkles,
  Target,
} from 'lucide-react'
import { PricingPlanButton } from '@/components/pricing-plan-button'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const features = [
  {
    title: 'Smart Board & AI Tutor',
    description: 'Work in parallel with your AI tutor while solving problems. Get clear, step-by-step explanations.',
    icon: Sparkles,
    className: 'md:col-span-2 md:row-span-2',
    tone: 'bg-card',
  },
  {
    title: 'Explain Tool',
    description: 'Select any confusing part and get an instant, targeted explanation.',
    icon: Lightbulb,
    className: 'md:col-span-1',
    tone: 'bg-card',
  },
  {
    title: 'Memory Box',
    description: 'Save golden rules and solutions with one tap, and retrieve them instantly when needed.',
    icon: NotebookTabs,
    className: 'md:col-span-1',
    tone: 'bg-card',
  },
  {
    title: 'Smart Task Tracker',
    description: 'Set up your problem list, track your progress, and strengthen your weak points.',
    icon: ListChecks,
    className: 'md:col-span-2',
    tone: 'bg-card',
  },
  {
    title: 'Focus Toolkit',
    description: 'No distractions. Expand the whiteboard to full screen, and manage your time with the built-in calculator and Pomodoro timer.',
    icon: Target,
    className: 'md:col-span-2',
    tone: 'bg-card',
  },
]

const plans = [
  { name: 'Free', price: '$0', detail: 'For getting started', features: ['10 vision queries / month', '20 text queries / day'] },
  { name: 'Pro', price: '$4.99', detail: 'For focused learners', features: ['100 vision queries / month', 'Unlimited text queries'], featured: true },
  { name: 'Premium', price: '$9.99', detail: 'For serious STEM study', features: ['250 vision queries / month', 'Unlimited text queries', 'More advanced features coming soon'] },
]

export default function Page() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <SiteHeader />

      <section id="top" className="relative px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[440px] w-[760px] -translate-x-1/2 rounded-full bg-primary/15 opacity-70 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-7xl">YOUR INTERACTIVE <span className="text-primary">STEM</span> WORKSPACE</h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">You don&apos;t need any other app. Grasp complex problems with a smart whiteboard and step-by-step AI guidance. Say goodbye to opening 10 different tabs.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><a href="/workspace" className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:-translate-y-1 hover:bg-primary/90">Start Learning <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></a><a href="#features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-1 hover:border-primary hover:text-primary">How it works</a></div>
        </div>
      </section>

      <section id="workspace" className="px-5 pb-24 sm:px-8 lg:px-10 lg:pb-32">
        <div className="mx-auto max-w-6xl rounded-[22px] border border-border bg-card p-2 shadow-xl sm:p-3">
          <div className="flex h-9 items-center gap-1.5 rounded-t-[14px] border-b border-border bg-muted px-4"><span className="size-2.5 rounded-full bg-[#f2a0a5]" /><span className="size-2.5 rounded-full bg-[#f2ce8d]" /><span className="size-2.5 rounded-full bg-[#9ed8ae]" /><div className="mx-auto h-5 w-2/5 rounded-md bg-background shadow-inner sm:w-1/3" /></div>
          <div className="rounded-b-[14px] bg-muted"><img src="/Desk.png" alt="DelvIn interactive STEM workspace" className="block h-auto w-full rounded-b-[14px] object-contain" /></div>
        </div>
      </section>

      <section id="features" className="bg-muted/50 px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="mx-auto max-w-6xl"><div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Everything in one place</p><h2 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Study smarter, together.</h2></div><p className="max-w-sm text-sm leading-6 text-muted-foreground">One calm, focused space for understanding difficult ideas and building lasting confidence.</p></div><div className="grid auto-rows-[minmax(190px,auto)] gap-4 md:grid-cols-4">{features.map(({ title, description, icon: Icon, className, tone }) => <article key={title} className={`${className} ${tone} group relative overflow-hidden rounded-3xl border border-border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-8`}>
            {title === 'Smart Board & AI Tutor' && <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-75 transition-opacity duration-500 group-hover:opacity-95" style={{ maskImage: 'linear-gradient(to left, black 0%, black 48%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 0%, black 48%, transparent 100%)' }}><img src="/smart_board_ai_tutor_feature.png" alt="" className="size-full object-cover object-left mix-blend-multiply dark:mix-blend-normal" /></div>}
            {title === 'Focus Toolkit' && <div className="pointer-events-none absolute inset-y-0 right-0 h-full w-[32%] overflow-hidden opacity-90 transition-opacity duration-500 group-hover:opacity-100" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 100%)' }}><img src="/Focus%20Toolkit.png" alt="" className="absolute inset-y-0 right-0 h-full w-auto max-w-none mix-blend-multiply dark:mix-blend-normal" /></div>}
            <div className={`relative z-10 ${title === 'Smart Board & AI Tutor' || title === 'Focus Toolkit' ? 'max-w-[48%]' : ''}`}><div className={`${title === 'Smart Board & AI Tutor' || title === 'Focus Toolkit' ? 'mb-12' : 'mb-6'} flex size-11 items-center justify-center rounded-2xl bg-background text-primary shadow-sm`}><Icon size={21} /></div><h3 className="text-xl font-semibold tracking-[-0.03em] text-foreground">{title}</h3><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div><div className="absolute -bottom-12 -right-8 size-36 rounded-full border-[16px] border-background/50 transition-transform duration-500 group-hover:scale-125" /></article>)}</div></div></section>

      <section id="pricing" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-32"><div className="mx-auto max-w-6xl"><div className="mx-auto mb-12 max-w-xl text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Simple plans</p><h2 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Choose your pace.</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">Start for free, then unlock more room to think when you&apos;re ready.</p></div><div className="grid gap-4 lg:grid-cols-3">{plans.map((plan) => <article key={plan.name} className={`relative rounded-3xl border p-7 ${plan.featured ? 'border-primary bg-card shadow-lg lg:-translate-y-3' : 'border-border bg-card shadow-sm'}`}>{plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">Most popular</div>}<h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{plan.detail}</p><div className="mt-7 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-[-0.06em]">{plan.price}</span><span className="text-sm text-muted-foreground">/month</span></div><PricingPlanButton name={plan.name} /><ul className="mt-7 space-y-3 border-t border-border pt-6">{plan.features.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground"><Check size={15} className="text-primary" /> {item}</li>)}</ul></article>)}</div></div></section>

      <SiteFooter />
    </main>
  )
}
