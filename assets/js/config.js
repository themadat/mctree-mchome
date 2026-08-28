(function () {
  "use strict";

  window.LocalApp = window.LocalApp || {};

  const CONFIG = {
    identity: {
      name: "McFamily",
      shortName: "McFamily",
      description: "A private, local-first family tree, address book, and printable family atlas.",
      version: "0.0.1.101",
      buildId: "0.0.1.101",
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
      roadmap: true,
      developerTools: true,
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
        version: "0.0.1.101",
        date: "2026-08-28T13:00:00.000Z",
        title: "Compact role-safe header",
        summary: "The header keeps its actions clear at enlarged text sizes, and non-Admin sessions always start outside Developer Mode.",
        features: [],
        improvements: ["Reduced header action widths, padding, and label spacing while preserving complete accessible names"],
        fixes: ["Forced Developer Mode off whenever an Editor, Member, or Viewer opens the encrypted family record"],
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
      { id: "tree", title: "Exploring the Family Tree", section: "Family", keywords: "tree focus overview zoom pan scroll generation ancestor descendant condensed detailed co-parent non-lineal resize preferred legal birth name", html: "<p>Focus shows the selected person and nearby generations; Full Tree shows every component and closes the profile. Ancestor and Descendant levels default to 10. Summary cards show names; Details adds lifespan and Lineal/contact symbols. Name Preferences chooses Preferred, Legal, or Lineal names and Short or Full length. Gold links show partner status, muted-red links show Lineal parents, and Non-Lineal Lines reveals other recorded parents. Use the Key, scroll, pan, zoom, Fit, and the desktop dividers to explore or resize the tree.</p>" },
      { id: "people", title: "People and relationships", section: "Family", keywords: "people list favorites star search sort filter blood lineal non-lineal alphabet address phone email parent child partner ancestry lineage generation names preferred legal birth maiden", html: "<p>Use <strong>List</strong> to open the searchable people pane. Filter by living status, Lineal scope, address, phone, or email; sort by first or last name; and use the A–Z rail to jump. Global search shows Preferred, Current, and Birth names. Star people from search or a profile, then choose Favorites to list them. Admin can restore a Favorites file in Developer Mode. Profiles contain Names, auto-generated Lineage, Relationships, contacts, and person-level editor notes. Imported Source appears only to editors in Developer Mode. Editors can add or connect parents, partners, and children; Lineal parents generate the child’s Lineage ID automatically.</p>" },
      { id: "print", title: "Print the Directory", section: "Family", keywords: "print pdf atlas directory household address phone contact lineage family maps generation developer preview", html: "<p>Choose <strong>Directory</strong> to build the atlas and open the browser print dialog. Saving as PDF uses a dated <code>McFamily-Directory-YYYY-MM-DD</code> filename. <strong>Directory of McMillen Clan</strong> includes people with at least one phone, email, or address and keeps their current partners in the same household. Main people and partners occupy separate rows with individual phones and emails; a shared Place phone stays with the Address column. The four column labels repeat only at the top of each printed page. Display Names are used throughout, only Lineal names are bold, and every deceased household person retains the concise italic death marker. Six-column Family Maps still include people omitted from the contact directory. In Developer Mode, the same action opens an in-app preview instead of printing.</p>" },
      { id: "backup", title: "Owner recovery file", section: "Data", keywords: "zip csv recovery backup restore owner private metadata audit", html: "<p>Owner and Editor access can download a private recovery ZIP containing McPeople, McPlaces, McRelations, McResidences, and McMetadata. It is not the normal sharing method and contains readable private information. Store it securely and use it only to recover or initialize the Owner workspace. Members and Viewers receive no recovery import or download controls.</p>" },
      { id: "cloud", title: "Saving the encrypted family", section: "Data", keywords: "cloud github save audit encrypted vault publish latest patch editor username token conflict json path changes update", html: "<p><strong>Save</strong> lets Admin and named Editor access publish the current family to the ciphertext-only public <code>mcdata</code> repository. GitHub settings expand from the top connection card. McFamily compares the local family with the record opened from the vault, lists every unpublished family change, and enables Update only when changes exist. Admin publications are recorded as Admin; Editor publications use the signed-in Editor name. McFamily generates one <code>data/mcfamily/McFamily-access.json</code> file containing the access grants plus separately encrypted full and Viewer family packages. The fine-grained GitHub token stays outside the vault.</p>" },
      { id: "access-packages", title: "Passphrases and access", section: "Data", keywords: "password passphrase access owner editor member viewer pii redacted revoke rotate", html: "<p>Everyone uses the same public McFamily link and enters only their assigned passphrase; McFamily identifies the matching grant locally. <strong>Owner</strong> can edit, publish, and manage access. Each named <strong>Editor</strong> has a unique passphrase, can edit and publish, and is automatically named in publication history. Separately named <strong>Members</strong> see full profile details read-only, while named <strong>Viewers</strong> decrypt only a copy with places, contacts, and unstructured private notes physically removed. Neither read-only role can open Save controls. In Developer Mode, the signed-in Owner can use the role pill to preview other roles without changing data or access. Owners can add, rename, rotate, or revoke every recipient independently, and McFamily rejects duplicate passphrases. Revocation blocks the next sign-in after reload but cannot erase information already seen or copied.</p>" },
      { id: "privacy", title: "Privacy and local data", section: "Data", keywords: "privacy encryption aes gcm pbkdf2 passphrase github token redacted lock", html: "<p>The public data repository contains only AES-GCM ciphertext, salts, nonces, wrapped random keys, access labels, and non-secret version metadata. Passphrases and GitHub tokens are never written into the vault. Eight characters are required, but three unrelated words are recommended because short phrases are easier to guess from the public encrypted file. Send phrases privately and never reuse a personal password. A hosted session keeps the decrypted family only in memory; the encrypted GitHub vault and its commit history are the saved source. <strong>Lock McFamily</strong> clears that session, reloads, and requires a passphrase again without changing the hosted vault. List visibility and favorites remain as compact non-sensitive device preferences. Member and Viewer modes remove Save, routine ZIP, Directory print, developer-data, and publishing controls; Viewer also lacks the private fields cryptographically. Member and Viewer sign-ins are not centrally recorded without a backend.</p>" },
      { id: "install", title: "Install McFamily", section: "Installation", keywords: "install home screen pwa offline", html: "<p>Use the browser’s Install app, Add to Home Screen, or Add to Dock command. After the shell has loaded once, local features continue to work offline.</p>" },
      { id: "shortcuts", title: "Keyboard access", section: "Accessibility", keywords: "keyboard shortcuts search list favorites key update reload dialog popup", html: "<p>Press <kbd>/</kbd> for search, <kbd>D</kbd> for List, <kbd>F</kbd> for Favorites, <kbd>K</kbd> for the tree Key, <kbd>X</kbd> to close the active pop-up, <kbd>R</kbd> to update McFamily when a new version is ready, <kbd>T</kbd> for theme, and <kbd>?</kbd> for Help. The Shortcut Reference lists any additional actions available to your permission role. Visible controls provide every shortcut action.</p>" }
    ]
  };

  window.LocalApp.config = Object.freeze(CONFIG);
})();
