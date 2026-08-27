(function () {
  "use strict";

  window.LocalApp = window.LocalApp || {};

  const CONFIG = {
    identity: {
      name: "McFamily",
      shortName: "McFamily",
      description: "A private, local-first family tree, address book, and printable family atlas.",
      version: "0.0.1.98",
      buildId: "0.0.1.98",
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
        appIconLight: "assets/icons/icon-512.png",
        appIconDark: "assets/icons/icon-512-dark.png",
        manifestLight: "manifest.webmanifest",
        manifestDark: "manifest-dark.webmanifest"
      }
    },

    schemaVersion: 14,
    packageFormat: "mcfamily-package",
    packageVersion: "1",
    datasetVersion: "17.0.0",
    datasetSeries: "17.0",
    accessModes: {
      editor: { label: "Editor", shortLabel: "Editor", editable: true, pii: true },
      "pii-viewer": { label: "Member", shortLabel: "Member", editable: false, pii: true },
      "redacted-viewer": { label: "Viewer", shortLabel: "Viewer", editable: false, pii: false }
    },
    storage: {
      stateKey: "mcfamily.state.v14",
      recoveryKey: "mcfamily.recovery.v6",
      devicePreferencesKey: "mcfamily.device-preferences.v1",
      cloudSettingsKey: "mcfamily.cloud.settings.v1",
      cloudTokenKey: "mcfamily.cloud.token.v1",
      cloudBaselineKey: "mcfamily.cloud.baseline.v1",
      hostedSeenKey: "mcfamily.hosted.seen.v1"
    },

    cloud: {
      owner: "themadat",
      repository: "mcdata",
      branch: "main",
      path: "data/mcfamily/McFamily-access.json",
      apiVersion: "2022-11-28",
      vaultFormat: "mcfamily-encrypted-vault",
      vaultVersion: 1,
      passphraseIterations: 350000,
      minPassphraseLength: 8,
      maxEditors: 20,
      maxPiiViewers: 20,
      maxRedactedViewers: 20,
      maxAccessGrants: 61,
      maxVaultBytes: 8 * 1024 * 1024
    },

    features: {
      family: true,
      familyEditing: true,
      cloudPackages: true,
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
      maxPlaces: 5000,
      maxResidences: 10000,
      maxAddressesPerPerson: 20,
      maxContactsPerPerson: 20,
      maxTextLength: 20000,
      maxDocumentHtmlLength: 250000,
      maxTreeDepth: 10
    },

    parentKinds: [
      { id: "biological", label: "Biological" },
      { id: "adoptive", label: "Adopted" },
      { id: "step", label: "Step" },
      { id: "foster", label: "Foster" },
      { id: "guardian", label: "Guardian" },
      { id: "unknown", label: "Unknown" }
    ],

    parentLineages: [
      { id: "lineal", label: "Lineal" },
      { id: "non-lineal", label: "Non-Lineal" }
    ],

    maritalStatuses: [
      { id: "married", label: "Married" },
      { id: "widowed", label: "Widowed" },
      { id: "divorced", label: "Divorced" },
      { id: "separated", label: "Separated" },
      { id: "annulled", label: "Annulled" },
      { id: "never-married", label: "Never married" },
      { id: "unknown", label: "Unknown" }
    ],

    maritalStatusByPartnerStatus: {
      married: "married",
      partnered: "never-married",
      widowed: "widowed",
      divorced: "divorced",
      separated: "separated",
      annulled: "annulled",
      former: "unknown",
      unknown: "unknown"
    },

    partnerStatuses: [
      { id: "married", label: "Married" },
      { id: "partnered", label: "Partners" },
      { id: "separated", label: "Separated" },
      { id: "divorced", label: "Divorced" },
      { id: "widowed", label: "Widowed" },
      { id: "annulled", label: "Annulled" },
      { id: "former", label: "Former partners" },
      { id: "unknown", label: "Partners" }
    ],

    partnerTypes: [
      { id: "marriage", label: "Marriage" },
      { id: "partnership", label: "Unmarried partnership" },
      { id: "UNKNOWN", label: "Unknown" }
    ],

    partnerEndReasons: [
      { id: "", label: "Ongoing / no recorded end" },
      { id: "death", label: "Death" },
      { id: "divorce", label: "Divorce" },
      { id: "separation", label: "Separation" },
      { id: "annulment", label: "Annulment" },
      { id: "UNKNOWN", label: "Unknown ending" }
    ],

    directoryFilters: [
      { id: "living", label: "Living", group: "status" },
      { id: "deceased", label: "Deceased", group: "status" },
      { id: "unknown", label: "Unknown status", group: "status" },
      { id: "consanguineal", label: "Lineal", group: "kinship" },
      { id: "affinal", label: "Non-Lineal", group: "kinship" },
      { id: "has-address", label: "Has Address", group: "contact" },
      { id: "has-phone", label: "Has Phone", group: "contact" },
      { id: "has-email", label: "Has Email", group: "contact" }
    ],

    themes: [
      { id: "harbor", label: "McFamily", accent: "#315f73", accent2: "#b86b4b", success: "#4f745f", warning: "#9b6a24", danger: "#a74747" }
    ],

    releases: [
      {
        version: "0.0.1.98",
        date: "2026-08-27T20:00:00.000Z",
        title: "Pre-1.0 cleanup",
        summary: "McFamily now carries only the current runtime contracts, data reader, and release guidance needed for the 1.0 line.",
        features: [],
        improvements: ["Reduced documentation and routine verification overhead", "GitHub Pages publishes only runtime assets through pinned workflow actions", "Browser state now omits unused legacy records and sync tombstones"],
        fixes: ["Removed the retired dataset 16 upgrade path, beta deployment path, and hidden package controls"],
        knownIssues: []
      }
    ],

    roadmap: [
      { id: "road-accounts", title: "Server-authenticated accounts and usage history", description: "Add identity-backed accounts and a central audit trail for sign-ins and reading activity beyond the current encrypted passphrase grants and publication history. This requires a secure backend.", state: "wishlist", priority: 1, target: "Future backend release", effort: 4, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-photos", title: "Private profile photos", description: "Explore storage-safe, offline profile photos without making backups fragile or publishing image requests.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 3, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-gedcom", title: "GEDCOM import", description: "Map standard genealogy exports into McFamily people and relationships with a review step.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 3, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-family-atlas", title: "Local family atlas", description: "Ship the editable directory, interactive tree, private backups, and print-ready family atlas.", state: "released", priority: 1, target: "0.0.1.3", effort: 4, createdAt: "2026-08-18T12:00:00.000Z" }
    ],

    help: [
      { id: "start", title: "Getting started", section: "Basics", keywords: "start passphrase password access owner editor viewer encrypted first launch", html: "<p>Open the ordinary McFamily link and enter the private passphrase assigned by the Owner. McFamily identifies the matching access locally, downloads only ciphertext, decrypts it in this browser, and validates the complete five-file family record before opening. Recipients do not choose a role and do not need a ZIP. Before the first encrypted vault exists, the Owner uses one private recovery ZIP to initialize their browser and publish hosted access.</p>" },
      { id: "tree", title: "Exploring the Family Tree", section: "Family", keywords: "tree focus overview zoom pan scroll horizontal vertical generation ancestor descendant home person condensed detailed co-parent non-lineal resize preferred legal birth name", html: "<p>Lineage shows the selected person and nearby generations; choosing a person from search returns here automatically. Full Tree clears and closes the selected-person panel, and Lineage stays disabled until another person is selected. Set the symbol-labelled Ancestors and Descendants depth numbers, or switch between Summary and Details cards. Summary shows only the chosen name; Details adds lifespan years plus Lineal and available-contact symbols. Name Preferences groups Preferred (Display), Legal (Current), and Lineal (Birth) with Short and Full choices. The selected-person panel follows this source preference, while its Lineage section always uses full Lineal Birth names. Both generation depths default to 10. Narrow cards keep short names stacked while names with four or more parts balance across three fitted lines; Lineal people keep the standard living or deceased card fill and use a bold muted-red outline plus a small lineage symbol beside the lifespan. Selection temporarily replaces that outline with the same accent border used for every person. Faded muted-red parent edges follow the Lineal bloodline. <strong>Non-Lineal Lines</strong> adds the lighter dashed branch from each recorded Non-Lineal parent to their child while keeping one fixed filled icon. Bright gold partner links distinguish current marriages (solid), previous marriages (dashed), never-married relationships (dotted), and unknown relationships (question marks fitted across the complete connector). Up to two prior partners appear at two-thirds size on the left: one is centered; two keep separate side-by-side positions, align with the top and bottom of the full-size spouse, and use straight parallel links. The current or latest death-ended spouse remains full-size on the right. The Key at the upper right of the canvas names each line and can be collapsed. <strong>?? Lineal</strong> appears only in Full Tree and reveals people whose stored source lineage is 99, plus anyone connected only to them; enabling it centers those people without changing its outlined icon. They always remain in the directory and search. On desktop, drag the divider beside the selected person panel to resize both modules; Developer Mode adds a left-side generation bubble scale and shows divider percentages only while dragging. Scroll horizontally or vertically to explore larger layouts; edit the zoom number directly, use the adjacent percent sign and stacked one-percent arrows, or choose the right-aligned Out, In, and Fit actions.</p>" },
      { id: "people", title: "People and relationships", section: "Family", keywords: "people directory favorites star search sort filter blood lineal non-lineal alphabet address phone email parent child partner ancestry lineage generation names preferred legal birth maiden", html: "<p>Use Directory to the left of Search to open or close the pane. Its title-bar search contains the current result count. Filter By combines living status, Lineal or Non-Lineal scope, and Has Address, Has Phone, or Has Email; selections within each group match any chosen option. A shared phone stored with an address counts as Has Phone and appears beneath that address rather than as an individual's phone. Sort By switches between first and last name; the A–Z rail follows the filtered results. Global person results lead with the display name and add Birth and Current names in parentheses only when they differ. Select the strongly highlighted star beside a person search result or use Favorite in the selected-person panel to pin them above other matches. Favorites to the right of Search toggles every starred person beneath the search field without changing the search scope. Developer Mode can save a private Favorites JSON file outside browser storage and restore it after a reset. The person panel closes and deselects with its X; selecting a person in the Family Tree reopens it. Names lists Preferred (Display), Legal (Current), Lineal (Birth), and Maiden as four compact full-name rows; unrecorded values use ----. Lineage uses a compact Family Line with each name followed by its lineage number and generation; readings use the generation and the parent's first name, such as Gen 6, 5th Child of Max. Lineage sits directly under identity details, above Relationships. Identity details show Born, Died, Age, Living Status, and Marital Status; Gender and Pronouns are hidden for now. Missing values use UNKNOWN except a living person's Died value, which is ----. Age uses natural years or months on one line and adds the emphasized would-be age for deceased people. McLineage death descriptors distinguish no recorded death (NONE), an explicitly unknown death date (UNKNOWN), and a presumed death (UNKNOWN PRESUMED). A deceased spouse in a marriage ended by death reads Married while the surviving spouse reads Widowed. Relationship groups label parent, sibling, and child generations; each Partners row adds its start–end years and perspective-aware status; parents identify recorded Lineal or Non-Lineal roles, siblings and children show birth order and year, and partners show relationship years. Partners puts the displayed spouse first in bold before reverse-ordered prior partners. Notes follow Relationships, and Imported Source finishes the profile. Every editable date accepts blank, YYYY, YYYY-MM, or YYYY-MM-DD with ? in any unknown digit and shows the same live red validation. When adding a person, at least one First name is required, and searchable Parents, Partners, and Children pickers connect existing people before saving. A selected Partner also records relationship status plus start and end dates. Connecting a Lineal parent previews and assigns the child’s complete Lineage ID. Owner and Editor can use the Edit control beside each partner history to record relationship type, start and end dates, end reason, and notes. Generations are rooted at George McMillen (1745) as G0.</p>" },
      { id: "print", title: "Print or save a PDF", section: "Family", keywords: "print pdf atlas directory household address phone contact lineage family maps generation developer preview", html: "<p>Choose <strong>Print / Save PDF</strong> to build the atlas and open the browser print dialog. After the cover, <strong>Directory of McMillen Clan</strong> includes people with at least one phone, email, or address and keeps their current partners in the same household. Main people and partners occupy separate rows with individual phones and emails; a shared Place phone stays with the Address column. The four column labels repeat only at the top of each printed page. Display Names are used throughout, only Lineal names are bold, and every deceased household person retains the concise italic death marker. Six-column Family Maps still include people omitted from the contact directory. In Developer Mode, the same action opens an in-app preview instead of printing.</p>" },
      { id: "notes", title: "Working with Notes", section: "Features", keywords: "notes text edit modal autosave", html: "<p>Notes is a single private plain-text scratchpad available only to Owner and Editor access. Open it from the top bar or press <kbd>N</kbd>; it is included in private recovery files and encrypted family publications.</p>" },
      { id: "backup", title: "Owner recovery file", section: "Data", keywords: "zip csv recovery backup restore owner private metadata audit", html: "<p>Owner and Editor access can download a private recovery ZIP containing McPeople, McPlaces, McRelations, McResidences, and McMetadata. It is not the normal sharing method and contains readable private information. Store it securely and use it only to recover or initialize the Owner workspace. Members and Viewers receive no recovery import or download controls.</p>" },
      { id: "cloud", title: "Publishing the encrypted family", section: "Data", keywords: "cloud github audit encrypted vault publish latest patch editor username token conflict json path changes update", html: "<p><strong>Audit</strong> lets Admin and named Editor access publish the current family to the ciphertext-only public <code>mcdata</code> repository. GitHub settings expand from the top connection card. McFamily compares the local family with the record opened from the vault, lists every unpublished family change, and enables Update only when changes exist. Admin publications are recorded as Admin; Editor publications use the signed-in Editor name. McFamily generates one <code>data/mcfamily/McFamily-access.json</code> file containing the access grants plus separately encrypted full and Viewer family packages. The fine-grained GitHub token stays outside the vault.</p>" },
      { id: "access-packages", title: "Passphrases and access", section: "Data", keywords: "password passphrase access owner editor member viewer pii redacted revoke rotate", html: "<p>Everyone uses the same public McFamily link and enters only their assigned passphrase; McFamily identifies the matching grant locally. <strong>Owner</strong> can edit, publish, and manage access. Each named <strong>Editor</strong> has a unique passphrase, can edit and publish, and is automatically named in publication history. Separately named <strong>Members</strong> see full profile details read-only, while named <strong>Viewers</strong> decrypt only a copy with places, contacts, and unstructured private notes physically removed. Neither read-only role can open family Notes or Audit. In Developer Mode, the signed-in Owner can use the role pill to preview other roles without changing data or access. Owners can add, rename, rotate, or revoke every recipient independently, and McFamily rejects duplicate passphrases. Revocation blocks the next sign-in after reload but cannot erase information already seen or copied.</p>" },
      { id: "privacy", title: "Privacy and local data", section: "Data", keywords: "privacy encryption aes gcm pbkdf2 passphrase github token redacted lock", html: "<p>The public data repository contains only AES-GCM ciphertext, salts, nonces, wrapped random keys, access labels, and non-secret version metadata. Passphrases and GitHub tokens are never written into the vault. Eight characters are required, but three unrelated words are recommended because short phrases are easier to guess from the public encrypted file. Send phrases privately and never reuse a personal password. A hosted session keeps the decrypted family only in memory; the encrypted GitHub vault and its commit history are the saved source. <strong>Lock McFamily</strong> clears that session, reloads, and requires a passphrase again without changing the hosted vault. Dismissed hints, dismissed What’s New banners, Directory visibility, and favorites remain as compact non-sensitive device preferences. Member and Viewer modes remove Audit, routine ZIP, PDF, developer-data, and publishing controls; Viewer also lacks the private fields cryptographically. Member and Viewer sign-ins are not centrally recorded without a backend.</p>" },
      { id: "install", title: "Install McFamily", section: "Installation", keywords: "install home screen pwa offline", html: "<p>Use the browser’s Install app, Add to Home Screen, or Add to Dock command. After the shell has loaded once, local features continue to work offline.</p>" },
      { id: "shortcuts", title: "Keyboard access", section: "Accessibility", keywords: "keyboard shortcuts search directory favorites key update reload dialog popup", html: "<p>Press <kbd>/</kbd> for search, <kbd>D</kbd> for Directory, <kbd>F</kbd> for Favorites, <kbd>K</kbd> for the tree Key, <kbd>X</kbd> to close the active pop-up or dismiss What’s New, <kbd>R</kbd> to update McFamily when a new version is ready, <kbd>T</kbd> for theme, and <kbd>?</kbd> for Help. The Shortcut Reference lists any additional actions available to your permission role. Visible controls provide every shortcut action.</p>" }
    ]
  };

  window.LocalApp.config = Object.freeze(CONFIG);
})();
