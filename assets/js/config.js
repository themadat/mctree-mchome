(function () {
  "use strict";

  window.LocalApp = window.LocalApp || {};

  const CONFIG = {
    identity: {
      name: "McFamily",
      shortName: "McFamily",
      description: "A private, local-first family tree, address book, and printable family atlas.",
      version: "0.0.1.20",
      buildId: "0.0.1.20",
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
      familyEditing: false,
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
        version: "0.0.1.20",
        date: "2026-08-19T16:40:01.000Z",
        title: "Complete root-to-person lineage paths",
        summary: "Current McLineage imports now carry one complete oldest-to-newest lineage path without a separate legacy page field.",
        features: ["Full root-to-person lineage IDs", "Ancestor-prefix lineage emphasis"],
        improvements: ["Legacy page references move into data-quality notes", "Family Tree sorting reads the current source order directly"],
        fixes: ["Family line ordinals use each person's final path segment", "Current imports reject broken or duplicate lineage paths"],
        knownIssues: []
      },
      {
        version: "0.0.1.19",
        date: "2026-08-19T16:12:55.000Z",
        title: "Explicit descendant date status",
        summary: "Current McLineage imports now distinguish known date precision, unknown dates, and living people with a strict descendant date contract.",
        features: ["Strict descendant date descriptors", "Explicit living and deceased import status"],
        improvements: ["Partial dates collapse to their known year or month", "Legacy page references sit beside lineage IDs in source details"],
        fixes: ["Unknown birth dates no longer use invalid source text", "G0-G4 descendants without death dates import as deceased with an unknown date"],
        knownIssues: []
      },
      {
        version: "0.0.1.18",
        date: "2026-08-19T15:33:32.000Z",
        title: "Clearer family navigation",
        summary: "Directory, tree, lineage, and relationship views are now faster to control and easier to scan.",
        features: ["Direct numeric depth and zoom controls", "Icon-over-label Out, In, and Fit controls", "Light-brown deceased tree cards"],
        improvements: ["Directory header control now opens and closes the pane", "Family line rows combine lineage number and generation", "Birth-order sibling and child lists", "Current partner first with prior partners de-emphasized"],
        fixes: ["Source Last Modified By metadata no longer affects search", "Unknown lifespan years consistently display as ????", "Imported source details now finish each person profile"],
        knownIssues: []
      },
      {
        version: "0.0.1.17",
        date: "2026-08-19T14:25:55.000Z",
        title: "Direct lineage references",
        summary: "McLineage imports now use stable P record IDs, person-to-root lineage paths, and direct parent references instead of reconstructing ancestry from redundant names.",
        features: ["Direct lineage-parent references", "Stable imported P references"],
        improvements: ["Smaller 48-field cleaned-source schema", "Lineage readings follow referenced people instead of repeated name columns"],
        fixes: ["Normalized lineage IDs are no longer reversed a second time", "Tree rows still sort by the root-to-person numeric hierarchy"],
        knownIssues: []
      },
      {
        version: "0.0.1.16",
        date: "2026-08-19T07:30:00.000Z",
        title: "Clearer family connections",
        summary: "The Family Tree can now reveal likely co-parent connections on demand, preserve the requested spouse history order, and share desktop space with a resizable person panel.",
        features: ["Optional inferred other-parent branches", "Keyboard and pointer workspace divider", "Search selections return to Focus mode"],
        improvements: ["Siblings appear before Partners in person details", "Exactly one current imported spouse appears to the right of the lineage person"],
        fixes: ["Earlier imported spouses now appear on the left with divorced styling", "McLineage spouse slots normalize consistently on import and reload"],
        knownIssues: []
      },
      {
        version: "0.0.1.15",
        date: "2026-08-19T07:00:00.000Z",
        title: "Favorite people search",
        summary: "Frequently referenced people can now be starred, pinned above other search matches, and opened together from the header.",
        features: ["Persistent favorite people", "Favorites-only header search", "Accessible star toggles on person results"],
        improvements: ["Directory now sits left of Search", "Directory and Favorites use the header icon-over-label convention"],
        fixes: ["Search results use valid sibling actions instead of nested buttons", "Removed favorites are cleaned up when a person is deleted"],
        knownIssues: []
      },
      {
        version: "0.0.1.14",
        date: "2026-08-19T06:30:00.000Z",
        title: "Aligned lineage details",
        summary: "Person details now align each lineage name with its reading and present immediate relationships in a more useful family order.",
        features: ["Shared-height Names and lineage-reading rows", "Open Partners relationship group"],
        improvements: ["Family totals span the full lineage module", "Relationships follow Parents, Partners, Siblings, Children"],
        fixes: ["Notes now finish both on-screen and printable person profiles", "Removed the redundant Reading heading"],
        knownIssues: []
      },
      {
        version: "0.0.1.13",
        date: "2026-08-19T06:00:00.000Z",
        title: "Lineage-ordered family rows",
        summary: "Family Tree rows now follow numeric lineage order and present partner histories in a consistent left-to-right sequence.",
        features: ["Numeric lineage ordering within Family Tree generations", "Past partners ordered on the left with the current spouse on the right"],
        improvements: ["Multi-partner groups use relationship dates and imported spouse order for stable chronology"],
        fixes: ["Sibling order no longer falls back to alphabetic names when lineage IDs are available"],
        knownIssues: []
      },
      {
        version: "0.0.1.12",
        date: "2026-08-19T05:30:00.000Z",
        title: "Compact family details",
        summary: "Lineage and immediate-family details now use a denser, easier-to-scan profile layout with clearer source references.",
        features: ["Source-order lineage IDs with the selected segment emphasized", "Side-by-side Names and Reading columns", "Compact open Parents, Children, and Siblings groups"],
        improvements: ["Lineage follows Notes and includes ancestor, sibling, and descendant totals", "Likely co-parents appear with directly recorded parents"],
        fixes: ["Print profiles include inferred co-parents consistently with person details"],
        knownIssues: []
      },
      {
        version: "0.0.1.11",
        date: "2026-08-19T05:00:00.000Z",
        title: "Rooted lineage generations",
        summary: "Lineage now uses stable generations rooted at George McMillen (1745), while person details and the Family Tree behave as independent, dismissible surfaces.",
        features: ["Absolute lineage generations beginning at Gen 0", "Horizontal and vertical Family Tree scrolling", "Tree selection reopens person details"],
        improvements: ["Unknown child positions read simply as Child of", "Selected Person closes and deselects with one X control", "The mobile tree view is named Family Tree"],
        fixes: ["Removed the redundant Show person control", "Deselecting a person persists across reloads"],
        knownIssues: []
      },
      {
        version: "0.0.1.10",
        date: "2026-08-19T04:30:00.000Z",
        title: "Quieter family workspace",
        summary: "The family workspace now keeps the tree central while making the directory faster to open, scan, sort, and dismiss.",
        features: ["Header Directory control", "First-name or last-name directory sorting", "A–Z quick-jump rail", "Independent ancestor and descendant depth controls"],
        improvements: ["Light appearance is the default", "Directory rows combine lifespan and lineage", "Repeated workspace headings and portrait placeholders are removed"],
        fixes: ["Internal person references stay hidden outside Developer Mode", "Mobile workspace tabs reopen collapsed modules"],
        knownIssues: []
      },
      {
        version: "0.0.1.9",
        date: "2026-08-19T02:50:00.000Z",
        title: "Readable lineage paths",
        summary: "Lineage now reads from the selected person back through each recorded generation with direct navigation to family members.",
        features: ["Two-digit person-first lineage IDs", "Generation-by-generation child-of readings", "Clickable names throughout lineage lists and readings"],
        improvements: ["Lineage ID appears before the name list", "Unknown child positions use Nth without guessing"],
        fixes: ["Family add, edit, relationship, home-person, and deletion controls are visibly paused during development"],
        knownIssues: []
      },
      {
        version: "0.0.1.8",
        date: "2026-08-19T03:45:00.000Z",
        title: "More tree, less repetition",
        summary: "The family workspace now begins directly with the directory, tree, and selected person panes.",
        features: [],
        improvements: ["Removed the repeated family heading, counts, and text actions", "Reclaimed the freed vertical space for the tree on desktop and mobile"],
        fixes: ["Add Person and PDF actions now appear only in the application title bar"],
        knownIssues: []
      },
      {
        version: "0.0.1.7",
        date: "2026-08-19T03:15:00.000Z",
        title: "More useful family maps",
        summary: "The printable atlas now gets directly to compact, clearly named family maps before the detailed directory.",
        features: ["Family maps named for their top sibling", "Generation labels on dedicated rows with compact name-and-years cards"],
        improvements: ["Four-column map cards fit more relatives on each printed page", "Cover and guide language now describe family maps instead of numbered components"],
        fixes: ["Removed the redundant alphabetical person index from the PDF atlas"],
        knownIssues: []
      },
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
      { id: "tree", title: "Exploring the Family Tree", section: "Family", keywords: "tree focus overview zoom pan scroll horizontal vertical generation ancestor descendant home person condensed detailed co-parent resize", html: "<p>Focus view shows the selected person and nearby generations; choosing a person from search returns here automatically. Select any person to recenter the Family Tree, set separate Ancestor and Descendant depth numbers, or switch between condensed and detailed cards. Deceased people use light-brown cards. <strong>Other parent lines</strong> adds lighter, inferred branches from a recorded parent's partner to the recorded parent-child line without changing family data. On desktop, drag the divider beside the selected person panel to resize both modules. Scroll horizontally or vertically to explore larger layouts; enter a zoom percentage or use Out, In, and Fit.</p>" },
      { id: "people", title: "People and relationships", section: "Family", keywords: "people directory favorites star search sort alphabet address phone email parent child partner ancestry lineage generation", html: "<p>Use Directory to the left of Search to open or close the pane, sort by first or last name, and jump through matching people with the A–Z rail. Select the star beside a person search result to pin them above other matches. Favorites to the right of Search opens every starred person and can be narrowed with the search field. The person panel closes and deselects with its X; selecting a person in the Family Tree reopens it. Lineage uses a compact Family line with each name followed by its lineage number and generation. Parents put the bloodline parent first, siblings and children follow birth order, and Partners puts the current partner first in bold before reverse-ordered prior partners. Notes follow Relationships, and Imported source finishes the profile. Generations are rooted at George McMillen (1745) as G0, and unknown child positions read simply as Child of.</p>" },
      { id: "print", title: "Print or save a PDF", section: "Family", keywords: "print pdf atlas directory lineage family maps generation", html: "<p>Choose <strong>Print / Save PDF</strong> to build the complete atlas and open the browser print dialog. Family maps are named for their top sibling and use compact name-and-years cards; detailed profiles follow alphabetically. Select Save as PDF to create a file.</p>" },
      { id: "notes", title: "Working with Notes", section: "Features", keywords: "notes text edit modal autosave", html: "<p>Notes is a single local plain-text scratchpad. Open it from the top bar or press <kbd>N</kbd>; it is included in McFamily backups.</p>" },
      { id: "backup", title: "CSV backup and restore", section: "Data", keywords: "csv export import backup restore recovery private", html: "<p>CSV export is the complete editable copy of the family and contains private contact information. Native exports use typed rows for people, contacts, relationships, Notes, and settings. Store them securely. Replacement imports are previewed and confirmed; the prior local copy becomes the recovery snapshot.</p>" },
      { id: "privacy", title: "Privacy and local data", section: "Data", keywords: "privacy local storage static gate authentication", html: "<p>Family data stays in this browser unless you export it. The first-run import gate is an onboarding step, not authentication. Never commit a private family backup into the public Pages repository.</p>" },
      { id: "install", title: "Install McFamily", section: "Installation", keywords: "install home screen pwa offline", html: "<p>Use the browser’s Install app, Add to Home Screen, or Add to Dock command. After the shell has loaded once, local features continue to work offline.</p>" },
      { id: "shortcuts", title: "Keyboard access", section: "Accessibility", keywords: "keyboard shortcuts search add print notes settings", html: "<p>Press <kbd>/</kbd> for search, <kbd>A</kbd> to add a person, <kbd>P</kbd> to print, <kbd>N</kbd> for Notes, <kbd>T</kbd> for theme, and <kbd>?</kbd> for Help. Visible controls provide every shortcut action.</p>" }
    ]
  };

  window.LocalApp.config = Object.freeze(CONFIG);
})();
