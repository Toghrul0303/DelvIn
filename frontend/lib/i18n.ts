export type Locale = "en"

export const LOCALES: { code: Locale; nativeLabel: string; short: string }[] = [
  { code: "en", nativeLabel: "English", short: "EN" },
]

export const STORAGE_KEY = "locknlearn.uiLanguage"
export const DEFAULT_LOCALE: Locale = "en"

export type TranslateVars = Record<string, string | number>

const en = {
  nav: {
    home: "Home",
    desk: "Workspace",
    library: "Library",
    assignments: "Assignments",
    notes: "Notes",
    progress: "Progress",
    sections: "Sections",
    workspaceSections: "Workspace sections",
    normalMode: "Light",
    focusMode: "Dark",
    light: "Light",
    dark: "Dark",
    system: "System",
    appearance: "Appearance",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Language",
  },
  account: {
    open: "Account",
    plan: "Plan: {name}",
    planFree: "Free",
    planPro: "Pro",
    planPremium: "Premium",
    textToday: "Text today: {used} / {cap}",
    textUnlimited: "Text today: Unlimited",
    visionMonth: "Vision this month: {used} / {cap}",
    upgrade: "Upgrade",
    manage: "Manage subscription",
    usageUnavailable: "Usage unavailable",
    portalUnavailable: "Could not open the billing portal.",
  },
  sidebar: {
    workspace: "Workspace",
    newSession: "New Session",
    mySessions: "My Sessions",
    taskTracker: "Task Tracker",
    memoryBox: "Personal Database · Memory Box",
    emptySessions: "Send a message to start your first session.",
    expand: "Expand sidebar",
    collapse: "Collapse sidebar",
    pinSession: "Pin session to Bookmarks",
    pinnedSession: "Pinned to Bookmarks",
    deleteSession: "Delete session {title}",
    renameSession: "Rename session",
    itemsCount: "{count} items",
    sessions: "Sessions",
    noProblemSet: "No problem set yet",
    assignProblemSet: "Assign a problem set to track progress",
    sessionProgress: "Session progress",
    completedCount: "{done}/{total} completed",
    removeSection: "Remove section {title}",
    extractAndSolve: "Click to extract and solve.",
    questionAria: "{label}, {status}. Click to toggle status, Alt+Click to extract and solve.",
    questionTitle: "{label} — {status}. Click to toggle status, Alt+Click to extract and solve.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Sign up",
    signOut: "Sign out",
    signedInAs: "Signed in as {email}",
    goToWorkspace: "Go to Workspace",
    enterCredentials: "Enter your email and password.",
    confirmEmail: "Check your email to confirm your account, then sign in.",
    authUnavailable: "Sign-in is not configured yet. Add the Supabase anon key to continue.",
    authSubtitle: "Sign in to sync your Memory Box across devices.",
    continueWithGoogle: "Continue with Google",
    or: "or",
    forgotPassword: "Forgot password?",
    resetTitle: "Reset password",
    resetHelper: "Enter your email and we will send you a link to set a new password.",
    sendResetLink: "Send reset link",
    checkEmail: "Check your email for a link to reset your password.",
    updatePasswordTitle: "Set a new password",
    newPassword: "New password",
    savePassword: "Save password",
    invalidRecoveryLink: "This reset link is invalid or has expired.",
    featureLogin: "Please log in or sign up to use this feature.",
    authCallbackError: "Sign-in could not be completed. Please try again.",
  },
  status: {
    unanswered: "Unanswered",
    completed: "Completed",
    review: "Needs Review",
    skipped: "Skipped",
  },
  chat: {
    aria: "Delvin chat",
    placeholder: "Ask about this problem…",
    send: "Send message",
    stop: "Stop generating",
    templates: "Prompt templates",
    attach: "Attach a document or image",
    dropFiles: "Drop files here",
    thinking: "Delvin is thinking",
    aborted: "You stopped this response",
    redo: "Try again",
    why: "Why?",
    how: "How?",
    explain: "Explain",
    altExplainTip: "Select the '?' tool from the left menu, or hold Alt/Option while selecting to get AI explanations.",
    highlightAsk: "Ask about this highlight",
    saveFormula: "Save to FormulaBox",
    saveGraph: "Save to GraphBox",
    saved: "Saved",
    backendError:
      "Sorry — I couldn't reach the tutor backend. Please try again.",
    textLimit: "You've used your {limit} text queries for today.",
    visionLimit: "You've used your {limit} vision queries this month.",
    seePlans: "See plans",
    addTrackerPrompt: "Add questions to Task Tracker?",
    addTracker: "Add questions to Task Tracker",
    summarize: "Summarize?",
    extractFormulas: "Extract Formulas?",
    other: "Other",
    filePrompt: "What would you like me to do with this file?",
    uploadingDocument: "Uploading document… {percent}%",
    uploadFailed: "Upload failed",
    summarizeDoc: "Summarize this document.",
    extractDoc: "Extract the key formulas from this document.",
    studySession: "Study session",
    completed: "Completed",
    needsReview: "Needs Review",
    skip: "Skip",
    reviewChip: "Review {label}?",
    reviewPrompt:
      "I didn't fully understand {label}. Please provide a more detailed, step-by-step explanation.",
    reviewStillUnclear:
      "Still unclear? Type your specific question in the chat, or Alt+select the confusing step on the workspace.",
    mathCalculation: "Math & Calculation",
    deskGenerated: "Workspace visual generated.",
    explanationAdded: "I've added the detailed explanation to the workspace.",
    newDeskResult: "New Workspace result",
    collapse: "Collapse chat panel",
    expand: "Show chat",
    dragToClose: "Drag down to close",
    resize: "Resize chat",
  },
  templates: {
    solve: { label: "Solve the problem", text: "Solve the problem" },
    formulas: {
      label: "Extract formulas",
      text: "Extract the key formulas from this document.",
    },
    section: {
      label: "Section questions",
      text: "Add these questions from Section [X]: [Y, Z]",
    },
  },
  modes: {
    detailed: {
      label: "Detailed Explanation",
      shortLabel: "Detailed",
      description: "Full walkthrough with concepts and steps",
    },
    socratic: {
      label: "Socratic Tutor",
      shortLabel: "Socratic",
      description: "Guiding questions and hints — no full solution",
    },
    aria: "Study mode",
  },
  toast: {
    savedMemory: "Saved to Memory Box!",
    savedBookmarks: "Saved to Bookmarks",
    alreadyBookmarks: "Already in Bookmarks",
    savedQuestion: "Saved to Saved Solutions",
    alreadyQuestion: "Already in Saved Solutions",
    savedReview: "Saved to Needs Review",
    pinnedBookmarks: "Pinned to Bookmarks",
  },
  desk: {
    aria: "Workspace",
    newDocument: "New document",
    drag: "Drag to reposition",
    saveBookmark: "Save to Bookmarks",
    savedBookmark: "Saved to Bookmarks",
    removeCard: "Remove workspace card",
    workingNotes: "Working Notes",
    closePanel: "Close panel",
    calculator: "Calculator",
    problemSubtitle: "Solution and analysis for this document",
    notes: "Notes",
    showTool: "Show {label}",
    hideTool: "Hide {label}",
    closeBoard: "Close board",
    renameBoard: "Rename board",
    boardName: "Board {n}",
    question: "Question",
    solve: "Solve",
    stepByStep: "Step-by-Step",
    solving: "Solving…",
    result: "Result",
    showSolution: "Show Solution",
    hideSolution: "Hide Solution",
    collapseQuestion: "Hide Question",
    flagQuestion: "Save this question",
    expandQuestion: "Show Question",
    showExplanation: "Show Explanation",
    hideExplanation: "Hide Explanation",
    explanationGroup: "Explanation",
    currentTask: "Current Task",
    readyTitle: "Active Workspace — Ready for queries",
    readySubtitle:
      "Ask DelvIn Tutor a question in the chat to see it tracked here, alongside any charts, calculations, or diagrams it generates.",
  },
  folders: {
    formula: "FormulaBox",
    graphs: "Graphs",
    summaries: "Summaries",
    bookmarks: "Saved Solutions",
  },
  collections: {
    title: "Memory Box · Collections",
    subtitle: "Everything you've saved from DelvIn Tutor.",
    backToDesk: "Back to Workspace",
    savedFormulas: "Saved Formulas",
    savedGraphs: "Saved Graphs",
    bookmarks: "Saved Solutions",
    comingSoon: "Coming soon",
    needsReview: "Needs Review",
    emptyFormulas: 'No saved formulas yet — click "Save to FormulaBox" on a chat answer to add one.',
    emptyGraphs: 'No saved graphs yet — click "Save to GraphBox" on a chat answer to add one.',
    emptyBookmarks: "No saved solutions yet — click Save on a Workspace card, or pin a session from My Sessions.",
    emptyReview: 'No review items yet — tap "Needs Review" on a solution to save it here.',
    removeFormula: "Remove saved formula",
    removeGraph: "Remove saved graph",
    removeBookmark: "Remove saved solution",
    removeSessionBookmark: "Remove saved session",
    removeReview: "Remove review item",
    open: "Open",
    closePreview: "Close",
  },
  pomodoro: {
    title: "Pomodoro",
    focus: "Focus",
    shortBreak: "Short Break",
    longBreak: "Long Break",
    short: "Short",
    long: "Long",
    drag: "Drag timer",
    collapse: "Collapse Pomodoro timer",
    expand: "Expand Pomodoro timer",
    start: "Start",
    pause: "Pause",
    reset: "Reset timer",
    minutes: "min",
  },
  player: {
    show: "Show focus music player",
    drag: "Drag player",
    play: "Play focus music",
    pause: "Pause focus music",
    next: "Next track",
    minimize: "Minimize player",
    close: "Close player",
    expand: "Expand focus music player",
    collapse: "Collapse focus music player",
  },
  settings: {
    open: "Settings",
    theme: "Theme",
    systemDefault: "System default",
    showTimer: "Show timer",
  },
}

export type Messages = typeof en

export const DICTIONARIES: Record<Locale, Messages> = { en }

type MessageNode = string | { [key: string]: MessageNode }

function lookup(tree: MessageNode, path: string): string | undefined {
  const parts = path.split(".")
  let node: MessageNode = tree
  for (const part of parts) {
    if (typeof node === "string") return undefined
    node = node[part]
    if (node == null) return undefined
  }
  return typeof node === "string" ? node : undefined
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] == null ? `{${name}}` : String(vars[name]),
  )
}

export function isLocale(value: unknown): value is Locale {
  return value === "en"
}

export function detectNavigatorLocale(): Locale {
  return DEFAULT_LOCALE
}

export function translate(locale: Locale, key: string, vars?: TranslateVars): string {
  const primary = lookup(DICTIONARIES[locale] as unknown as MessageNode, key)
  const fallback = lookup(DICTIONARIES.en as unknown as MessageNode, key)
  return interpolate(primary ?? fallback ?? key, vars)
}

export function localeToBcp47(_locale: Locale): string {
  return "en-US"
}
