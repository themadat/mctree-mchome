(function () {
  "use strict";

  window.LocalApp = window.LocalApp || {};

  const CONFIG = {
    identity: {
      name: "McFamily",
      shortName: "McFamily",
      description: "A private, local-first family tree, address book, and printable family atlas.",
      version: "0.0.1.6",
      buildId: "0.0.1.6",
      repository: {
        label: "Project repository",
        url: "https://github.com/themadat/mctree-mchome"
      },
      support: [
        { label: "Report a problem", url: "https://github.com/themadat/mctree-mchome/issues/new" },
        { label: "View documentation", url: "https://github.com/themadat/mctree-mchome#readme" }
      ],
      assets: {
        favicon: "assets/icons/favicon.svg",
        appIconLight: "assets/icons/app-icon-light.png",
        appIconDark: "assets/icons/app-icon-dark.png",
        manifestLight: "manifest.webmanifest",
        manifestDark: "manifest-dark.webmanifest"
      }
    },

    schemaVersion: 7,
    csvFormat: "mcfamily-csv-v1",
    storage: {
      stateKey: "mcfamily.state.v7",
      legacyKeys: ["mcfamily.state.v6", "mcfamily.state.v5", "appTemplate.state.v4", "appTemplate.state.v3", "localWorkspace.state.v3", "localWorkspace.state.v2", "localWorkspace.state.v1"],
      recoveryKey: "mcfamily.recovery.v1"
    },

    features: {
      family: true,
      documents: true,
      roadmap: true,
      developerTools: true,
      hints: true,
      demoData: false
    },

    controls: {
      shortcutHintModifier: "Alt",
      autosaveDelayMs: 180,
      maxImportBytes: 5 * 1024 * 1024,
      maxPeople: 1500,
      maxRelationships: 6000,
      maxAddressesPerPerson: 20,
      maxContactsPerPerson: 20,
      maxTextLength: 20000,
      maxDocumentHtmlLength: 250000
    },

    parentKinds: [
      { id: "biological", label: "Biological parent" },
      { id: "adoptive", label: "Adoptive parent" },
      { id: "step", label: "Step-parent" },
      { id: "foster", label: "Foster parent" },
      { id: "guardian", label: "Guardian" },
      { id: "unknown", label: "Parent" }
    ],

    partnerStatuses: [
      { id: "married", label: "Married" },
      { id: "partnered", label: "Partners" },
      { id: "separated", label: "Separated" },
      { id: "divorced", label: "Divorced" },
      { id: "widowed", label: "Widowed" },
      { id: "former", label: "Former partners" },
      { id: "unknown", label: "Partners" }
    ],

    themes: [
      { id: "harbor", label: "Harbor", accent: "#315f73", accent2: "#b86b4b", success: "#4f745f", warning: "#9b6a24", danger: "#a74747" },
      { id: "forest", label: "Forest", accent: "#356859", accent2: "#a76f3f", success: "#4d744e", warning: "#9a7028", danger: "#a04c48" },
      { id: "plum", label: "Plum", accent: "#6a4c79", accent2: "#b76b65", success: "#547158", warning: "#9c6c25", danger: "#a74650" },
      { id: "slate", label: "Slate", accent: "#49627c", accent2: "#9b664b", success: "#52715c", warning: "#916c2e", danger: "#9e4850" }
    ],

    releases: [
      {
        version: "0.0.1.6",
        date: "2026-08-19T02:30:00.000Z",
        title: "Focused family tree controls",
        summary: "McFamily now gives lineage a readable family form and makes the tree easier to search, arrange, simplify, and expand.",
        features: ["Clickable son, daughter, or child-of lineage readings with source lineage IDs", "Condensed and detailed tree cards", "Collapsible Directory and Selected person panes"],
        improvements: ["Fuzzy partial-name search", "Partner-aware placement keeps couples adjacent", "Married and divorced links use distinct solid and dotted lines"],
        fixes: ["Parent relationship labels no longer repeat Child · Parent"],
        knownIssues: []
      },
      {
        version: "0.0.1.5",
        date: "2026-08-19T01:30:00.000Z",
        title: "CSV family portability",
        summary: "McFamily now opens the cleaned McLineage CSV and uses a complete native CSV for future backups and replacement imports.",
        features: ["First-launch McLineage-cleaned CSV mapping", "Complete McFamily CSV export and round-trip import", "Source-field preservation for future schema work"],
        improvements: ["Capacity raised for the 607-row source plus spouse profiles", "Import previews identify source format and mapping warnings"],
        fixes: ["Partial and invalid source dates remain preserved instead of being discarded"],
        knownIssues: ["The import gate is not authentication; CSV files and PDFs must be stored privately."]
      },
      {
        version: "0.0.1.4",
        date: "2026-08-19T00:44:51.000Z",
        title: "McFamily icon refresh",
        summary: "McFamily now uses its tree-and-monogram artwork throughout the browser and installed application.",
        features: [],
        improvements: ["New light and dark McFamily artwork across header, launcher, touch, maskable, and splash surfaces", "New vector McFamily favicon"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.3",
        date: "2026-08-18T12:00:00.000Z",
        title: "McFamily local family atlas",
        summary: "The application now combines an editable local family directory, interactive relationship tree, private backups, and a printable family atlas.",
        features: ["Focus and whole-family SVG tree views", "Complete people, contact, heritage, and relationship editing", "Strict first-run McFamily backup import", "Print / Save PDF atlas and directory"],
        improvements: ["Search covers people and contact details", "Local backup status replaces cloud synchronization", "McFamily identity and offline install metadata"],
        fixes: ["Relationship validation prevents missing references, duplicates, self-links, and ancestry cycles"],
        knownIssues: ["The import gate is not authentication; true roles and audit history require a future backend."]
      },
      {
        version: "0.0.1.2",
        date: "2026-08-03T15:00:00.000Z",
        title: "Blank application workspace",
        summary: "The original application foundation provided the Notes, Settings, backup, appearance, and offline shell now used by McFamily.",
        features: ["Theme shortcut on the app icon", "Modifier-tolerant global shortcuts"],
        improvements: ["Centered search", "Local persistence and recovery"],
        fixes: ["Fresh Notes start blank"],
        knownIssues: []
      }
    ],

    roadmap: [
      { id: "road-accounts", title: "Accounts, roles, and access history", description: "Add authenticated owner, editor, and viewer roles with access revocation and an audit trail for sign-ins, edits, exports, and other usage. This requires a secure backend and is intentionally outside the static local-only app.", state: "wishlist", priority: 1, target: "Future backend release", effort: 4, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-photos", title: "Private profile photos", description: "Explore storage-safe, offline profile photos without making backups fragile or publishing image requests.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 3, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-gedcom", title: "GEDCOM import", description: "Map standard genealogy exports into McFamily people and relationships with a review step.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 3, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-family-atlas", title: "Local family atlas", description: "Ship the editable directory, interactive tree, private backups, and print-ready family atlas.", state: "released", priority: 1, target: "0.0.1.3", effort: 4, createdAt: "2026-08-18T12:00:00.000Z" }
    ],

    help: [
      { id: "start", title: "Getting started", section: "Basics", keywords: "start import csv backup seed first launch", html: "<p>McFamily opens after you import the cleaned McLineage CSV or a native McFamily CSV export. The file is mapped, validated, and previewed before it replaces local data. There is no demo-family or blank-family bypass.</p>" },
      { id: "tree", title: "Exploring the family tree", section: "Family", keywords: "tree focus overview zoom pan generation home person condensed detailed collapse panels", html: "<p>Focus view shows the selected person and nearby generations. Select any person to recenter the tree, adjust generation depth, switch between condensed and detailed cards, or collapse the side panes for a tree-only view. Overview fits every family component.</p>" },
      { id: "people", title: "People and relationships", section: "Family", keywords: "people add edit address phone email parent child partner ancestry lineage", html: "<p>Add or edit people from the workspace. A profile can hold multiple addresses, phone numbers, and email addresses. Heritage shows the imported name line and lineage ID; activate the name line to read the person as a son, daughter, or child of their recorded parents.</p>" },
      { id: "print", title: "Print or save a PDF", section: "Family", keywords: "print pdf atlas directory lineage", html: "<p>Choose <strong>Print / Save PDF</strong> to build the complete atlas and open the browser print dialog. Select Save as PDF to create a file.</p>" },
      { id: "notes", title: "Working with Notes", section: "Features", keywords: "notes text edit modal autosave", html: "<p>Notes is a single local plain-text scratchpad. Open it from the top bar or press <kbd>N</kbd>; it is included in McFamily backups.</p>" },
      { id: "backup", title: "CSV backup and restore", section: "Data", keywords: "csv export import backup restore recovery private", html: "<p>CSV export is the complete editable copy of the family and contains private contact information. Native exports use typed rows for people, contacts, relationships, Notes, and settings. Store them securely. Replacement imports are previewed and confirmed; the prior local copy becomes the recovery snapshot.</p>" },
      { id: "privacy", title: "Privacy and local data", section: "Data", keywords: "privacy local storage static gate authentication", html: "<p>Family data stays in this browser unless you export it. The first-run import gate is an onboarding step, not authentication. Never commit a private family backup into the public Pages repository.</p>" },
      { id: "install", title: "Install McFamily", section: "Installation", keywords: "install home screen pwa offline", html: "<p>Use the browser’s Install app, Add to Home Screen, or Add to Dock command. After the shell has loaded once, local features continue to work offline.</p>" },
      { id: "shortcuts", title: "Keyboard access", section: "Accessibility", keywords: "keyboard shortcuts search add print notes settings", html: "<p>Press <kbd>/</kbd> for search, <kbd>A</kbd> to add a person, <kbd>P</kbd> to print, <kbd>N</kbd> for Notes, <kbd>T</kbd> for theme, and <kbd>?</kbd> for Help. Visible controls provide every shortcut action.</p>" }
    ]
  };

  window.LocalApp.config = Object.freeze(CONFIG);
})();
