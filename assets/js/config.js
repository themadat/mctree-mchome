(function () {
  "use strict";

  window.LocalApp = window.LocalApp || {};

  const CONFIG = {
    identity: {
      name: "App Template",
      shortName: "Template",
      description: "A focused pre-launch local-first shell with a blank app workspace, Notes, settings, and optional GitHub Sync.",
      version: "0.0.1.2",
      buildId: "0.0.1.2",
      repository: {
        label: "Project repository",
        url: "https://github.com/OWNER/REPOSITORY"
      },
      support: [
        { label: "Report a problem", url: "https://github.com/OWNER/REPOSITORY/issues/new" },
        { label: "View documentation", url: "https://github.com/OWNER/REPOSITORY#readme" }
      ],
      assets: {
        favicon: "assets/icons/favicon.svg",
        appIconLight: "assets/icons/app-icon-light.svg",
        appIconDark: "assets/icons/app-icon-dark.svg",
        manifestLight: "manifest.webmanifest",
        manifestDark: "manifest-dark.webmanifest"
      }
    },

    schemaVersion: 4,
    storage: {
      stateKey: "appTemplate.state.v4",
      legacyKeys: ["appTemplate.state.v3", "localWorkspace.state.v3", "localWorkspace.state.v2", "localWorkspace.state.v1"],
      recoveryKey: "appTemplate.recovery.v1",
      secretKey: "appTemplate.githubToken.v1",
      sessionSecretKey: "appTemplate.githubToken.session.v1"
    },

    features: {
      records: false,
      documents: true,
      cloudSync: true,
      roadmap: true,
      developerTools: true,
      hints: true,
      demoData: true
    },

    controls: {
      shortcutHintModifier: "Alt",
      autosaveDelayMs: 180,
      syncCheckIntervalMs: 5 * 60 * 1000,
      maxImportBytes: 5 * 1024 * 1024,
      maxRecords: 5000,
      maxDocuments: 500,
      maxTextLength: 20000,
      maxDocumentHtmlLength: 250000
    },

    statuses: [
      { id: "active", label: "Active", icon: "●", color: "#2f7d68" },
      { id: "paused", label: "Paused", icon: "Ⅱ", color: "#a86a1f" },
      { id: "complete", label: "Complete", icon: "✓", color: "#4f6f52" },
      { id: "idea", label: "Idea", icon: "◇", color: "#7058a3" }
    ],

    themes: [
      { id: "harbor", label: "Harbor", accent: "#315f73", accent2: "#b86b4b", success: "#4f745f", warning: "#9b6a24", danger: "#a74747" },
      { id: "forest", label: "Forest", accent: "#356859", accent2: "#a76f3f", success: "#4d744e", warning: "#9a7028", danger: "#a04c48" },
      { id: "plum", label: "Plum", accent: "#6a4c79", accent2: "#b76b65", success: "#547158", warning: "#9c6c25", danger: "#a74650" },
      { id: "slate", label: "Slate", accent: "#49627c", accent2: "#9b664b", success: "#52715c", warning: "#916c2e", danger: "#9e4850" }
    ],

    releases: [
      {
        version: "0.0.1.2",
        date: "2026-08-03T15:00:00.000Z",
        title: "Blank application workspace",
        summary: "The main app area is empty and ready for a future app while Notes, Roadmap, updates, and shortcuts remain available from the shell.",
        features: ["Theme shortcut on the app icon", "Modifier-tolerant global shortcuts"],
        improvements: ["Unaccented Notes toolbar action", "Icon-only release and force-refresh actions", "Roadmap search, filters, and sorting live in Settings"],
        fixes: ["Fresh and unchanged demonstration Notes start blank", "Notes closes from its standard close control without a redundant Done button"],
        knownIssues: ["GitHub Sync requires a user-provided repository and fine-grained token."]
      },
      {
        version: "0.0.1.1",
        date: "2026-08-03T12:00:00.000Z",
        title: "Pre-launch application foundation",
        summary: "A focused local-first shell with centered search, combined storage and GitHub status, and force-refreshable PWA updates.",
        features: ["Single-modal Notes workspace", "Major.minor.patch.build versioning", "Combined Storage & GitHub settings"],
        improvements: ["Centered app-bar search", "Unified floating save and sync status", "Dedicated Notes SF Symbol", "Bottom new-version toast with force refresh"],
        fixes: ["Installed apps can explicitly activate and reload a waiting application update", "The redundant Roadmap navigation strip is removed"],
        knownIssues: ["GitHub Sync requires a user-provided repository and fine-grained token."]
      }
    ],

    roadmap: [
      { id: "road-1", title: "Optional attachment adapter", description: "Document an extension point for local or remote file attachments.", state: "planned", priority: 2, target: "1.2", effort: 3, createdAt: "2026-07-08T12:00:00.000Z" },
      { id: "road-2", title: "Notes print view", description: "Add a clean print layout for the single Notes workspace.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 2, createdAt: "2026-07-20T12:00:00.000Z" },
      { id: "road-3", title: "Local print layout", description: "Add a clean print view for notes and roadmap entries.", state: "planned", priority: 1, target: "1.1", effort: 1, createdAt: "2026-07-29T12:00:00.000Z" },
      { id: "road-4", title: "Focused template foundation", description: "Ship the shell, Notes, Roadmap, sync, recovery, PWA, and settings modules.", state: "released", priority: 1, target: "1.0", effort: 4, createdAt: "2026-06-12T12:00:00.000Z" }
    ],

    help: [
      { id: "start", title: "Getting started", section: "Basics", keywords: "start notes roadmap", html: "<p>The main application workspace starts blank. Open <strong>Notes</strong> for a plain-text scratchpad, and find the replaceable <strong>Roadmap</strong> inside Settings. Local changes save automatically.</p>" },
      { id: "notes", title: "Working with Notes", section: "Features", keywords: "notes text edit modal autosave", html: "<p>Open Notes from the top bar or press <kbd>N</kbd>. The single plain-text editor saves locally and is included in backup and synchronization data.</p>" },
      { id: "roadmap", title: "Using Roadmap", section: "Features", keywords: "roadmap planned released wishlist priority target effort", html: "<p>Search Roadmap, filter its state, and sort by priority, target release, effort, age, or title. Replace the demonstration entries in configuration.</p>" },
      { id: "backup", title: "Backup and restore", section: "Data", keywords: "json export import backup restore recovery", html: "<p>Export a JSON backup from Settings. Imports are parsed, migrated, sanitized, summarized, and confirmed before replacement. The current copy is saved as a recovery snapshot first.</p>" },
      { id: "sync", title: "GitHub synchronization", section: "Data", keywords: "github cloud sync token conflict merge", html: "<p>GitHub sync is optional. Configure a private repository, branch, JSON file path, and a fine-grained token with Contents access. Conflicts always ask whether to upload, download, merge, or cancel.</p>" },
      { id: "install", title: "Install the application", section: "Installation", keywords: "install add home screen iphone ipad android mac windows pwa offline", html: "<p>Use your browser’s Install app, Add to Home Screen, or Add to Dock command. There is no in-app installation dialog. Once the application shell has loaded, core local features continue to work offline.</p>" },
      { id: "app-icon", title: "App icon controls", section: "Appearance", keywords: "icon theme dark light beta developer mode hold press shortcut", html: "<p>Click or tap the app icon, or press <kbd>T</kbd>, to switch between light and dark themes. Press and hold the icon to enable or disable Developer Mode. The Beta pill appears automatically on a <code>/beta/</code> URL or when <code>?beta=1</code> is present.</p>" },
      { id: "privacy", title: "Privacy and local data", section: "Data", keywords: "privacy local storage token secret", html: "<p>Notes remain in browser storage unless you export them or explicitly use GitHub Sync. Tokens are stored separately per device and excluded from backups and diagnostics.</p>" },
      { id: "shortcuts", title: "Keyboard access", section: "Accessibility", keywords: "keyboard shortcuts slash escape alt option shift control hints version", html: "<p>Press <kbd>/</kbd> for global search, <kbd>N</kbd> for Notes, <kbd>V</kbd> for What’s New, <kbd>T</kbd> for the theme, and <kbd>?</kbd> for Help. Listed shortcuts continue to work while Shift, Control, or Option is held. Hold the configured modifier to reveal shortcut hints.</p>" }
    ]
  };

  window.LocalApp.config = Object.freeze(CONFIG);
})();
