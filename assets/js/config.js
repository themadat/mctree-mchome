(function () {
  "use strict";

  window.LocalApp = window.LocalApp || {};

  const CONFIG = {
    identity: {
      name: "McFamily",
      shortName: "McFamily",
      description: "A private, local-first family tree, address book, and printable family atlas.",
      version: "0.0.1.94",
      buildId: "0.0.1.94",
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

    schemaVersion: 13,
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
      stateKey: "mcfamily.state.v13",
      recoveryKey: "mcfamily.recovery.v5",
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
      { id: "harbor", label: "Harbor", accent: "#315f73", accent2: "#b86b4b", success: "#4f745f", warning: "#9b6a24", danger: "#a74747" },
      { id: "forest", label: "Forest", accent: "#356859", accent2: "#a76f3f", success: "#4d744e", warning: "#9a7028", danger: "#a04c48" },
      { id: "plum", label: "Plum", accent: "#6a4c79", accent2: "#b76b65", success: "#547158", warning: "#9c6c25", danger: "#a74650" },
      { id: "slate", label: "Slate", accent: "#49627c", accent2: "#9b664b", success: "#52715c", warning: "#916c2e", danger: "#9e4850" }
    ],

    releases: [
      {
        version: "0.0.1.94",
        date: "2026-08-27T14:52:45.000Z",
        title: "Connected partner stacks and clearer mailings",
        summary: "Stacked historical partners now connect cleanly, while household PDFs and labels use denser, clearer address formatting.",
        features: [],
        improvements: ["Two historical partners share one stacked tree position with uninterrupted links to their person", "Directory print headers distinguish Address and Landline", "Labels use one type size and omit the first person's repeated surname"],
        fixes: ["A single household person uses the shorter row when other residents already provide vertical space", "Compact print margins replace the browser timestamp with McFamily's ISO date"],
        knownIssues: []
      },
      {
        version: "0.0.1.93",
        date: "2026-08-27T14:14:41.000Z",
        title: "Reliable compact printing",
        summary: "The atlas now starts with the directory, keeps household and label pages intact, and removes private contact hints from Viewer tree cards.",
        features: [],
        improvements: ["Households use compact black-outlined cards with light internal separators and right-aligned shared phones", "Print headers use an ISO date and a clean temporary URL while the native dialog is open", "The atlas begins with the directory instead of a separate title page"],
        fixes: ["Viewer tree cards no longer reveal address, phone, or email availability", "Household cards use an indivisible wrapper that browsers honor more reliably at page boundaries", "Label print rules remain active until print preview closes and leave one device pixel of pagination slack"],
        knownIssues: []
      },
      {
        version: "0.0.1.92",
        date: "2026-08-26T22:02:00.000Z",
        title: "Mailing labels and CSV",
        summary: "Admin and Editors can now turn current household addresses into compact directory pages, Avery 5260 labels, or a simple mailing CSV.",
        features: ["Labels builds 30-up Avery 5260 sheets from household display names and current addresses", "CSV downloads the same mailing list with Names and Address columns"],
        improvements: ["Printable directory household rows use substantially less vertical space"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.91",
        date: "2026-08-26T21:43:16.000Z",
        title: "Isolated Pages publishing",
        summary: "GitHub Pages now publishes from a clean staging directory that cannot traverse local scratch dependencies.",
        features: [],
        improvements: ["Pages assembles an explicit publishable directory before invoking the deployment action", "Local family data directories are explicitly excluded from the staged website"],
        fixes: ["The deployment action no longer scans the repository root or follows the broken temporary node_modules link", "Temporary migration files are removed from Git tracking even when another computer retains ignored local copies"],
        knownIssues: []
      },
      {
        version: "0.0.1.90",
        date: "2026-08-26T21:33:07.000Z",
        title: "Reliable Pages publishing",
        summary: "GitHub Pages publishing now excludes local migration scratch files and machine-specific dependency links.",
        features: [],
        improvements: ["The repository now ignores the complete local tmp workspace and explicitly excludes it from Pages publishing"],
        fixes: ["Removed a broken local node_modules symlink that stopped the Pages action before it could update the existing gh-pages branch", "Removed temporary migration outputs from the publishable repository tree"],
        knownIssues: []
      },
      {
        version: "0.0.1.89",
        date: "2026-08-26T20:23:30.000Z",
        title: "Compact address-phone printing",
        summary: "Address phones now use one clean number format, the person editor gives addresses more room, and printable households fit together more reliably.",
        features: [],
        improvements: ["Phone fields insert dashes while typing and save ten-digit numbers as ###-###-####", "The wider person editor shows Current address on two compact lines", "Single- and two-person household rows share the space beside their address more evenly", "Letter printing uses half-inch margins and keeps household cards together"],
        fixes: ["Address phone numbers no longer carry a redundant Landline label", "McDirectory home phones can be migrated from person contacts to their shared Place records without overriding newer manual addresses"],
        knownIssues: []
      },
      {
        version: "0.0.1.88",
        date: "2026-08-26T19:01:23.000Z",
        title: "Shared landlines and current households",
        summary: "Addresses can now carry a shared landline, and the printable clan directory keeps current partners together under one repeating page header.",
        features: ["Shared Place landlines editable with each address and shown in the Address column"],
        improvements: ["The print directory is titled Directory of McMillen Clan", "Household, Phone, Email, and Address labels repeat once at the top of each printed directory page"],
        fixes: ["Current partners stay in the same household card when one partner is deceased or only one partner has current contact information"],
        knownIssues: []
      },
      {
        version: "0.0.1.87",
        date: "2026-08-26T16:25:46.000Z",
        title: "Accurate compact household names",
        summary: "The printable directory now distinguishes Lineal emphasis from heading weight and marks deceased household leads as clearly as partners.",
        features: [],
        improvements: ["Household name, phone, and email rows use less vertical space", "Name rows align their content vertically in both preview and printed output"],
        fixes: ["Non-Lineal names render at normal weight while Lineal names remain bold", "Deceased main people now use italics and the same concise death marker as deceased partners"],
        knownIssues: []
      },
      {
        version: "0.0.1.86",
        date: "2026-08-26T16:01:16.000Z",
        title: "Contact-focused household directory",
        summary: "The printable directory now omits people without contact information and aligns each household member with their own phone and email.",
        features: [],
        improvements: ["Household partners occupy separate name, phone, and email rows", "Other same-address residents appear as a muted name list without a redundant label", "People without a phone, email, or address remain in Family Maps but are omitted from Person Directory"],
        fixes: ["Non-Lineal household names no longer inherit Lineal emphasis"],
        knownIssues: []
      },
      {
        version: "0.0.1.85",
        date: "2026-08-26T15:39:14.000Z",
        title: "Admin repository shortcuts",
        summary: "Admin Settings now provides direct links to the McFamily application and encrypted-data repositories.",
        features: ["Admin-only GitHub repository links in Settings"],
        improvements: ["The application and mcdata repositories can be opened without leaving the Settings workflow"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.84",
        date: "2026-08-26T15:14:38.000Z",
        title: "Household print directory",
        summary: "The printable Person Directory now organizes people into address-based households before the Family Maps.",
        features: ["Address-based household entries combine recorded partners, other residents, main-person contacts, and the full address"],
        improvements: ["Person Directory now appears before Family Maps", "Households sort by the main person's Display Last Name and use Display Names throughout", "Lineage footers end with the full Lineal name and formatted Lineage ID"],
        fixes: ["Deceased partners now use italic names with a concise death marker and the known death year when available"],
        knownIssues: []
      },
      {
        version: "0.0.1.83",
        date: "2026-08-26T14:45:34.000Z",
        title: "Hosted sessions without storage pressure",
        summary: "Hosted family data now stays in session memory while GitHub remains the saved copy, and Appearance offers only the three supported color modes.",
        features: [],
        improvements: ["Hosted sessions retain only compact favorites and display preferences in browser storage", "Appearance now exposes only System, Light, and Dark", "Zoom stepper dividers no longer offset the arrow controls horizontally"],
        fixes: ["Large hosted families no longer trigger browser quota errors from a full decrypted local copy", "Previously customized colors reset to the fixed McFamily palette"],
        knownIssues: []
      },
      {
        version: "0.0.1.82",
        date: "2026-08-26T14:23:26.000Z",
        title: "Simpler owner and display controls",
        summary: "Owner tools are easier to scan, and appearance settings now use one consistent text-size control.",
        features: [],
        improvements: ["Owner access controls and recovery tools are collapsed until needed", "Tree zoom percentage spacing and stepper alignment are clearer", "Publish Access Changes and Lock McFamily use dedicated symbols", "One Text size slider now scales both the application and reading surfaces"],
        fixes: ["Removed unused theme-preset, manual-motion, and Family Guidance settings surfaces"],
        knownIssues: []
      },
      {
        version: "0.0.1.81",
        date: "2026-08-26T13:41:19.000Z",
        title: "Lean hosted storage",
        summary: "Hosted McFamily sessions now keep one browser working copy and rely on the encrypted GitHub vault and its history for recovery.",
        features: [],
        improvements: ["Hosted unlock, Update, access publication, and Bulk Upload remove redundant local recovery snapshots", "Destructive-edit messaging explains that GitHub remains unchanged until Update"],
        fixes: ["Large hosted families no longer duplicate the complete dataset in browser recovery storage"],
        knownIssues: []
      },
      {
        version: "0.0.1.80",
        date: "2026-08-26T05:04:43.000Z",
        title: "Contact-aware Directory",
        summary: "Directory filters can find people with recorded contact details, while larger tree symbols keep living contacts easy to spot.",
        features: ["Has Address, Has Phone, and Has Email Directory filters"],
        improvements: ["Living people use doubled address, phone, and email symbols in a dedicated tree-card row"],
        fixes: ["Contact availability symbols no longer appear on deceased people"],
        knownIssues: []
      },
      {
        version: "0.0.1.79",
        date: "2026-08-25T18:20:00.000Z",
        title: "Bulk address update",
        summary: "Admin can validate and publish the new dataset 17 address package in one guarded bulk-upload flow.",
        features: ["Admin-only Bulk Upload review and publication from Audit", "Address, phone, and email availability symbols on Family Tree people", "Imported Source details for McDirectory addresses in Developer Mode"],
        improvements: ["Audit uses the same neutral toolbar color as the other title-bar actions", "Lineage ID occupies its own labelled Add Person row with the automatic-parent disclaimer beneath it"],
        fixes: ["The dataset 16 hosted vault remains available to Admin long enough to perform the one-time dataset 17 upgrade"],
        knownIssues: []
      },
      {
        version: "0.0.1.78",
        date: "2026-08-25T17:13:59.000Z",
        title: "Clearer person details",
        summary: "The automatically generated Lineage ID now has its own full-width row in Add and Edit Person Details.",
        features: [],
        improvements: ["Lineage ID and its Parents-based disclaimer no longer compete with Birth, Death, and Living status fields on the same row"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.77",
        date: "2026-08-25T16:16:06.000Z",
        title: "Automatic lineage and clearer audit",
        summary: "Add Person now calculates parent lineage and the resulting Lineage ID automatically, while names, audit details, and GitHub settings follow simpler rules.",
        features: ["Read-only Lineage ID preview in Person Details based on the selected parents", "Automatic Lineal/Non-Lineal classification when parents are attached to a new person"],
        improvements: ["Legal name changes immediately update the Preferred display name", "Birth Last immediately updates Maiden Last", "Detailed audit entries render every changed area on its own line", "GitHub owner, repository, branch, and path share one fixed read-only row"],
        fixes: ["Saving GitHub settings now closes the expanded connection panel", "Test, Forget, and Save use the supplied external-drive status symbols"],
        knownIssues: []
      },
      {
        version: "0.0.1.76",
        date: "2026-08-25T14:28:03.000Z",
        title: "Consistent dates and dialogs",
        summary: "Every editable date now follows one partial-date contract, all pop-up dialogs share X dismissal, and the sign-in screen is quieter.",
        features: ["Person, address, partner, and relationship dates accept the same blank, year, month, day, and question-mark partial syntax", "X closes the active pop-up dialog outside editable fields, including confirmations and choices"],
        improvements: ["Fresh and reset preferences follow the system theme", "The locked screen removes introductory and passphrase-length copy while exposing R on Update McFamily", "Zoom has more breathing room after the percent sign, a shorter entry box, and centered steppers"],
        fixes: ["Relationship date descriptors are generated automatically and partial values survive editing", "Relationship Place is no longer shown in the editor while existing hidden values remain preserved"],
        knownIssues: []
      },
      {
        version: "0.0.1.75",
        date: "2026-08-24T20:49:37.000Z",
        title: "Faster keyboard and update flow",
        summary: "Common actions are easier from the keyboard, and a waiting app update can be installed before entering the family passphrase.",
        features: ["A opens Add Person, W opens View As in Owner Developer Mode, and | toggles Developer Mode", "A waiting service worker appears on the locked screen so it can refresh before sign-in"],
        improvements: ["X closes Settings, What’s New, or the active new-version notification", "Parents, Partners, and Children use separate dense searchable rows in Add Person", "The compact Zoom percentage gives the percent sign balanced side spacing"],
        fixes: ["Update discovery now begins before the passphrase gate waits for sign-in, avoiding an unnecessary second passphrase entry"],
        knownIssues: []
      },
      {
        version: "0.0.1.74",
        date: "2026-08-24T19:38:00.000Z",
        title: "Refined person entry",
        summary: "The Add Person form now finds relationships faster, captures partner history immediately, and uses cleaner compact controls.",
        features: ["Parents, Partners, and Children pickers each include a people search", "A selected Partner can record status plus start and end dates before the new person is saved"],
        improvements: ["The Zoom percentage control is only wide enough for its value, percent sign, and stepper", "Birth, Current, Preferred, and Maiden headings sit fully inside their bordered name cards", "Spouses / Partners is now labelled simply Partners"],
        fixes: ["Partner details selected during Add Person are stored as authoritative partner type and end reason fields and render immediately in the profile"],
        knownIssues: []
      },
      {
        version: "0.0.1.73",
        date: "2026-08-24T19:30:00.000Z",
        title: "Editable relationship history",
        summary: "Lineal links now create visible lineage IDs automatically, and each partner history can record how and when it ended.",
        features: ["Lineal parent links preview and assign the child’s complete lineage ID", "Each partner row has an Editor-only relationship control for marriage or partnership type, start and end dates, end reason, place, and notes"],
        improvements: ["Partner histories show start–end year ranges and render separation, divorce, annulment, death, and unknown endings from explicit source fields", "Lineage assignment preserves valid existing child numbers, uses the next available number for a new branch, and rebases Lineal descendants when a branch moves"],
        fixes: ["The previously unreachable relationship editor is now available from every partner history row", "Explicit partner type and end reason survive package export instead of being inferred from one combined status"],
        knownIssues: []
      },
      {
        version: "0.0.1.72",
        date: "2026-08-24T19:03:52.000Z",
        title: "Faster person entry",
        summary: "Search and zoom are easier to scan, while Add Person now fits one desktop page and can connect existing relatives as the person is created.",
        features: ["Parents, spouses or partners, and children can be selected from existing people during Add Person", "Live comprehensive date validation with save blocking and automatic Deceased status"],
        improvements: ["The larger global search is centered in the title bar and its dropdown exactly matches the field width", "Person search leads with the display name and adds only differing Birth and Current names", "Zoom uses an editable number, adjacent percent sign, and far-right stacked one-percent steppers", "The Add Person form keeps four name rows beside compact details and preserves a full-width one-line address editor"],
        fixes: ["At least one First name is required before Save is available", "Invalid dates, email addresses, and empty address rows cannot be saved", "The supplied seal symbols now label Save and Cancel", "A single address row fits the ordinary 1280 × 720 desktop form without scrolling or overlapping Remove"],
        knownIssues: ["New parent and child links begin as Non-Lineal / Unknown and can be refined from the relationship editor after saving"]
      },
      {
        version: "0.0.1.71",
        date: "2026-08-24T18:19:48.000Z",
        title: "Audited family updates",
        summary: "Favorites now toggles predictably, while Admin and Editor publishing clearly identifies unpublished family changes before an update.",
        features: ["Automatic detailed change list for people, relationships, places, residences, family identity, and Notes", "Update availability driven by real family changes since the hosted vault was opened"],
        improvements: ["The Owner permission is displayed and recorded as Admin", "GitHub connection settings expand directly from their top status card", "The Update action uses the plus-arrow-clockwise symbol", "Favorites visibly opens and closes its list beneath Search"],
        fixes: ["Editor no longer sees the Owner Recovery section", "No Updates keeps the hosted Update button disabled", "Access changes cannot silently publish an unaudited family edit", "Removed redundant publishing and audit-history explanatory copy"],
        knownIssues: ["The detailed audit entry is limited to the existing 4,000-character metadata field even when the on-screen unpublished list is longer"]
      },
      {
        version: "0.0.1.70",
        date: "2026-08-24T18:05:09.000Z",
        title: "Read-only action cleanup",
        summary: "Member and Viewer now see a fully read-only workspace, while Audit explains the one generated encrypted vault required in mcdata.",
        features: ["Single-vault GitHub setup guidance with the exact configured JSON path"],
        improvements: ["GitHub connection identifies McFamily-access.json as the generated file containing both access grants and encrypted family packages"],
        fixes: ["Member and Viewer no longer see Add in the title bar", "Member and Viewer no longer see Add, Connect, Edit, Delete, or the empty-profile Add Person action"],
        knownIssues: ["The current vault format uses one combined JSON file; separate physical access and data files would require a future format change"]
      },
      {
        version: "0.0.1.69",
        date: "2026-08-24T17:25:42.000Z",
        title: "Compact person entry and role preview",
        summary: "The title bar and person editor are more compact, while Owner Developer Mode can safely preview Editor, Member, and Viewer behavior without changing access.",
        features: ["Owner-only role preview menu on the role pill in Developer Mode", "Birth names automatically seed Current and Preferred names until those fields are changed", "Question-mark partial dates receive their descriptor automatically"],
        improvements: ["Audit, Add, Notes, PDF, and Settings now use the requested title-bar order", "The Add Person form uses three single-line 5/30/30/30/5 name rows, compact contact sections, Details, and Editor Notes", "PDF uses the filled document symbol"],
        fixes: ["Invalid person dates are blocked and marked with a red input border", "Removed Gender, Pronouns, life-place, and lineage-background fields remain preserved on existing people"],
        knownIssues: ["Role preview is transient and intentionally returns to the signed-in Owner role after reload or when Developer Mode is turned off"]
      },
      {
        version: "0.0.1.68",
        date: "2026-08-24T17:03:02.000Z",
        title: "Simpler access and audit",
        summary: "Access & Audit now opens with one compact status row for publishers, while read-only access uses the clearer Member and Viewer names without exposing publishing controls.",
        features: ["Member replaces the full-detail read-only role name", "Viewer replaces the privacy-filtered read-only role name"],
        improvements: ["Signed-in identity and permission, encrypted family file status, and GitHub connection now share one top row", "Encrypted file and GitHub connection summaries use clear green or red status treatment"],
        fixes: ["Member and Viewer no longer see or open Access & Audit", "Read-only access does not expose PDF through its button, shortcut reference, or Help topic"],
        knownIssues: ["Stable internal pii-viewer and redacted-viewer identifiers remain in packages and vaults for compatibility"]
      },
      {
        version: "0.0.1.67",
        date: "2026-08-24T16:41:27.000Z",
        title: "Local data and favorite recovery",
        summary: "Project data now stays outside Git, while starred people persist separately on this device and can be restored from the header in Developer Mode.",
        features: ["Device-local persistence for favorite person references", "Developer Mode Restore shortcut beside Favorites using the List Star symbol"],
        improvements: ["The entire data directory is ignored so private working files remain local", "Existing device-preference records upgrade without discarding favorites already stored in the family state"],
        fixes: ["Hosted refreshes and Lock no longer replace the browser’s remembered favorites"],
        knownIssues: ["Clearing site storage also clears remembered favorites; keep a Favorites JSON file for recovery", "Previously committed data remains in older Git history until that history is separately rewritten"]
      },
      {
        version: "0.0.1.66",
        date: "2026-08-24T16:28:41.000Z",
        title: "Remembered interface choices",
        summary: "Dismissed hints, individual What’s New banners, and the Directory’s open or closed state now remain on the same device through hosted refreshes and Lock.",
        features: ["Device-local persistence for dismissed hints and release banners", "Remembered Directory visibility on desktop and mobile"],
        improvements: ["Lock keeps non-sensitive interface choices while clearing decrypted family data", "Reset Preferences and Erase Everything still return those choices to defaults"],
        fixes: ["Hosted sign-in no longer replaces these personal interface choices with the publisher’s copy"],
        knownIssues: ["Preferences are stored per browser profile and do not synchronize between devices"]
      },
      {
        version: "0.0.1.65",
        date: "2026-08-24T15:59:19.000Z",
        title: "Passphrase-only access",
        summary: "McFamily now identifies each encrypted access grant from its unique passphrase, with the hosted vault fixed to the public themadat/mcdata repository.",
        features: ["One passphrase field with no account or role selector", "Automatic local matching for Owner, Editor, Member, and Viewer access"],
        improvements: ["Hosted ciphertext now targets themadat/mcdata", "Public grant labels remain available for access management and publication auditing without being listed before sign-in"],
        fixes: ["New and retained access grants cannot be published with the same passphrase", "The locked sign-in screen no longer reveals the configured account list"],
        knownIssues: ["Every publishing device still needs its own fine-grained GitHub token", "Member and Viewer sign-ins are not centrally audited because they have no write credential"]
      },
      {
        version: "0.0.1.64",
        date: "2026-08-24T15:00:00.000Z",
        title: "Named access for every recipient",
        summary: "Owners can now create multiple independently revocable Editors, Members, and Viewers while keeping Notes and imported source details appropriately restricted.",
        features: ["Multiple named Member and Viewer grants", "Independent passphrase rotation and revocation for every recipient", "Person and family Notes limited to Owner and Editor access"],
        improvements: ["One consistent add, name, passphrase, and revoke workflow across recipient roles", "Imported Source appears and participates in search only for Owner or Editor while Developer Mode is enabled", "Read-only search, profiles, and shortcuts no longer expose Notes"],
        fixes: ["Read-only grants no longer share one fixed access slot", "The hidden Notes dialog is cleared for read-only access"],
        knownIssues: ["Member and Viewer sign-ins are not centrally audited because they have no write credential", "Short passphrases remain easier to guess from a public encrypted vault"]
      },
      {
        version: "0.0.1.63",
        date: "2026-08-24T13:00:00.000Z",
        title: "Named editors and simpler passphrases",
        summary: "Owners can now give multiple editors separate usernames and independently revocable passphrases, with publications automatically attributed to the signed-in editor.",
        features: ["Up to 20 separately named Editor grants", "Add and revoke controls for each editor", "Audit attribution locked to the signed-in Owner or Editor username"],
        improvements: ["Custom passphrases now require eight characters instead of five words", "The generator creates three-word phrases that are easier to read and type", "Existing single-Editor encrypted vaults remain valid and editable"],
        fixes: ["GitHub connection settings can no longer override the username recorded in the audit history", "Duplicate sign-in names are rejected before an access update is published"],
        knownIssues: ["Short passphrases are easier to guess from a public encrypted vault; three unrelated words remain recommended", "Revocation cannot erase information already viewed or copied"]
      },
      {
        version: "0.0.1.62",
        date: "2026-08-24T12:00:00.000Z",
        title: "Passphrase access from one family link",
        summary: "McFamily can now open an encrypted hosted family record with revocable Owner, Editor, Member, and Viewer passphrases.",
        features: ["One public app link with an automatic encrypted-family download", "Long passphrases wrap separate full-data and redacted-data encryption keys", "Owner access management can add, rotate, or remove Editor, Member, and Viewer grants"],
        improvements: ["Editors publish the current browser family directly to the encrypted hosted vault", "Every hosted publication advances the dataset patch and appends an audit event", "Read-only modes omit ZIP import, backup, package creation, PDF, and developer-data export surfaces"],
        fixes: ["Readable family CSVs and GitHub tokens never enter the public vault", "Revoked grants disappear from the next online sign-in after the vault is republished"],
        knownIssues: ["Revocation cannot erase information already viewed or copied", "Member and Viewer sign-ins cannot be centrally logged without giving them a write credential or adding a backend"]
      },
      {
        version: "0.0.1.61",
        date: "2026-08-24T07:00:00.000Z",
        title: "Three clear family access packages",
        summary: "One McFamily link now opens explicit Editor, Member, or physically redacted read-only ZIP handoffs.",
        features: ["Editor package with family editing and audited GitHub publishing", "Member package with full private details and disabled record editing", "Viewer package that removes places, contacts, family Notes, and record notes before export"],
        improvements: ["The current access mode stays visible beside the app version and at the top of Save & Share", "Import preview names the assigned access before opening a package", "Read-only modes hide cloud connection and publishing tools"],
        fixes: ["Redacted packages are rejected if their files still contain place, residence, relationship-place, or note records", "Family title, Notes, person, and relationship mutations are guarded consistently in read-only modes"],
        knownIssues: ["Static access packages are not authenticated accounts: a Member ZIP is plaintext and read-only mode cannot prevent deliberate external inspection or modification"]
      },
      {
        version: "0.0.1.60",
        date: "2026-08-24T06:00:00.000Z",
        title: "Friendlier save, share, and audit workflow",
        summary: "Local backups, cloud handoff status, connection details, and recent changes now live in one clear, reliably scrollable workspace.",
        features: ["One title-bar Save & Share entry point", "Prominent cloud connection and latest-package status", "Local private backup and replacement import beside cloud handoff tools"],
        improvements: ["Plain-language Get latest copy and Publish edited ZIP actions", "Simplified recent-change entries omit machine-only comparison text", "One dialog scroll area works consistently on desktop and mobile"],
        fixes: ["Long audit histories no longer get trapped inside a nested scroll area", "Connection state and repository target remain visible without opening advanced settings"],
        knownIssues: ["McMetadata history is durable change history, not a tamper-proof security log; repository access remains controlled by GitHub"]
      },
      {
        version: "0.0.1.59",
        date: "2026-08-24T05:00:00.000Z",
        title: "Private cloud package handoff",
        summary: "Editors can now validate, publish, audit, and download the latest five-file family package through a private GitHub data repository.",
        features: ["Title-bar Cloud & Audit workspace", "Validated Upload Changes and Download Latest workflow", "Automatic dataset patch versions and persistent McMetadata audit events"],
        improvements: ["GitHub file SHAs reject stale uploads instead of overwriting a newer edit", "Every published ZIP is opened locally and downloaded for the next old-fashioned edit/save cycle", "Fine-grained tokens stay outside family packages and can remain session-only"],
        fixes: ["Dataset 16 packages can advance through compatible 16.0 patch revisions without a website schema update"],
        knownIssues: ["The audit is change history, not a tamper-proof security log; repository access and revocation remain controlled by GitHub"]
      },
      {
        version: "0.0.1.58",
        date: "2026-08-24T04:00:00.000Z",
        title: "Lineal and Non-Lineal adoption records",
        summary: "Parent relationships now store lineage role separately from biological, adopted, step, foster, guardian, or unknown parent type.",
        features: ["Multiple Non-Lineal parents per child", "Lineal adoption branches use a dashed muted-red tree line", "Profiles identify parent relationships such as Lineal :: Adopted and Non-Lineal :: Biological"],
        improvements: ["McRelations schema 2.0 replaces parent-kind with parent-lineage and parent-type", "Lineage paths continue through the explicitly selected Lineal parent regardless of parent type", "The tree Key now explains Lineal adoption"],
        fixes: ["Adoption cases no longer require every Non-Lineal parent to be partnered with the Lineal parent"],
        knownIssues: []
      },
      {
        version: "0.0.1.57",
        date: "2026-08-24T03:30:00.000Z",
        title: "Validated five-file data packages",
        summary: "McFamily now imports and exports one private ZIP containing separate people, places, relationships, residences, and metadata CSV files.",
        features: ["McPeople, McPlaces, McRelations, McResidences, and McMetadata schemas", "Strict cross-file validation before import", "Package audit history for schema changes, imports, and exports"],
        improvements: ["Parent and partner records now live in McRelations", "Addresses are normalized as reusable Places plus Person-to-Place Residences", "The import preview reports every validation group before replacement", "Older versioned McFamily state copies are removed so they cannot consume the current package's browser-storage quota"],
        fixes: ["Bad checksums, missing files, wrong headers, count mismatches, missing references, duplicates, self-links, and ancestry cycles are rejected without replacing local data"],
        knownIssues: []
      },
      {
        version: "0.0.1.56",
        date: "2026-08-24T03:00:00.000Z",
        title: "McLineage v14 cleanup",
        summary: "McFamily now uses a focused 30-column McLineage schema without the obsolete legacy spouse-directory display fields.",
        features: [],
        improvements: ["Exact 30-column McLineage v14 import", "Structured Birth, Current, Preferred, and Maiden names remain authoritative"],
        fixes: ["Removed the four legacy male/female display-name columns without changing structured name values"],
        knownIssues: []
      },
      {
        version: "0.0.1.55",
        date: "2026-08-24T02:00:00.000Z",
        title: "Roomier person names",
        summary: "Search and selected-person profiles now give structured name variants more room to remain readable.",
        features: [],
        improvements: ["A wider, taller search-results panel uses horizontal columns for Preferred, Current, and Lineal names", "Selected-person property labels use a wider column", "Preferred (Display) remains on one line"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.54",
        date: "2026-08-23T21:00:00.000Z",
        title: "Aligned Family Tree controls",
        summary: "Family Tree toolbar headings and internal name controls now align consistently, with the zoom suffix placed before its stepper arrows.",
        features: [],
        improvements: ["Centered Name Preferences, Tree View, Card View, Levels, and Zoom headings", "Equal-height, evenly sized Preferred/Legal/Lineal and Short/Full controls", "Zoom values read as number, percent, then native up/down arrows"],
        fixes: ["Name Preferences controls no longer overflow or render at mismatched heights"],
        knownIssues: []
      },
      {
        version: "0.0.1.53",
        date: "2026-08-23T18:00:00.000Z",
        title: "Durable favorites and compact name search",
        summary: "Favorite people can now be saved outside browser storage and restored from Developer Mode, while person search shows every structured name.",
        features: ["Private Favorites JSON save and restore controls in Developer Mode", "Preferred, Current, and Lineal names in every person search result"],
        improvements: ["Favorite people have a stronger gold highlight in search and profiles", "Selected-person property labels use a 100px column", "The Family Tree Key now floats at the upper right"],
        fixes: ["Favorites can be recovered after browser storage is reset or unavailable"],
        knownIssues: []
      },
      {
        version: "0.0.1.52",
        date: "2026-08-23T12:00:00.000Z",
        title: "McLineage v13 names and life status",
        summary: "McFamily now accepts the exact 34-column McLineage v13 schema, uses explicit death descriptors, and presents grouped Family Tree preferences.",
        features: ["Explicit NONE, UNKNOWN, and UNKNOWN PRESUMED death descriptors", "Grouped Name Preferences, Tree View, Card View, Levels, and Zoom controls"],
        improvements: ["Selected-person names follow the Family Tree source preference", "Lineage chains always use full Lineal Birth names", "Zoom percentage is contained inside its number field"],
        fixes: ["Obsolete retain-maiden-name and legacy deceased headers are removed", "Presumed and explicitly deceased people remain distinguishable without a known death date"],
        knownIssues: []
      },
      {
        version: "0.0.1.51",
        date: "2026-08-21T16:54:44.000Z",
        title: "McLineage v12 hard cutover",
        summary: "McFamily now accepts the exact hyphenated McLineage v12 source schema and starts in a fresh storage namespace.",
        features: ["Exact 36-column McLineage v12 import", "Latest-only state model without historical browser-state migration"],
        improvements: ["Structured Birth, Current, Preferred, and Maiden names import directly", "Every McLineage source header uses hyphens"],
        fixes: ["Old browser state and recovery snapshots cannot interfere with the v12 workspace", "Removed flat name columns are no longer read"],
        knownIssues: []
      },
      {
        version: "0.0.1.50",
        date: "2026-08-21T16:35:20.000Z",
        title: "Compact names and profile favorites",
        summary: "Person profiles now present names in four compact rows, expose Favorites directly, and offer all three tree name sources.",
        features: ["Favorite or unfavorite the selected person from their profile", "Preferred (Display), Legal (Current), and Lineal (Birth) Family Tree name sources"],
        improvements: ["Names now show one full value per source plus a compact Maiden row", "Tree name source and length choices use the supplied icon-over-label controls"],
        fixes: ["Preferred tree names fall back to Legal and then Lineal names when no preferred name is recorded"],
        knownIssues: []
      },
      {
        version: "0.0.1.49",
        date: "2026-08-21T16:11:18.000Z",
        title: "Aligned person properties",
        summary: "Selected-person property values now share one compact, consistent starting position.",
        features: [],
        improvements: ["Profile labels use a narrower fixed column with a smaller gap before their values"],
        fixes: ["Age now aligns horizontally with Born, Died, Living Status, and Marital Status"],
        knownIssues: []
      },
      {
        version: "0.0.1.48",
        date: "2026-08-21T15:31:12.000Z",
        title: "Structured family names",
        summary: "Birth, legal, and preferred names now retain distinct parts while the Family Tree can switch how names are shown.",
        features: ["Structured Birth, Current, and Preferred names with Prefix, First, Middle, Last, and Suffix parts", "Family Tree controls for Lineal (Birth) or Legal names and Short or Full presentation"],
        improvements: ["Selected-person profiles place a complete Names section before Lineage", "Native private CSV v2 stores every name part plus Maiden Last Name in dedicated columns", "Display names consistently prefer Preferred, then Current, then Birth names"],
        fixes: ["Legacy first-name strings split into First and Middle parts while recognized prefixes and suffixes move into their own fields", "Retain-maiden records keep matching Birth and Current last names during migration"],
        knownIssues: []
      },
      {
        version: "0.0.1.47",
        date: "2026-08-21T14:57:27.000Z",
        title: "Clearer profiles and lineage navigation",
        summary: "Person details are easier to scan, and tree mode changes now keep selection and unresolved lineage navigation predictable.",
        features: ["Enabling ?? Lineal centers the newly revealed unresolved-Lineal people", "Full Tree clears and closes the selected-person panel"],
        improvements: ["Clickable Family Line and relationship names use brighter accessible blue links in both themes", "Natural-language ages now show years or months and distinguish age at death from the corresponding age today", "Printable Bloodline cards use a stronger outline and special Bloodline symbols for Albon, Newton, and Lucian"],
        fixes: ["Living profiles show four dashes instead of an unknown death value", "Lineage is unavailable until a person is selected", "Gender and Pronouns are temporarily hidden from person details"],
        knownIssues: []
      },
      {
        version: "0.0.1.46",
        date: "2026-08-21T14:21:04.000Z",
        title: "Clearer life status and atlas cues",
        summary: "Living and deceased status now reads more naturally across the tree, profiles, search, and printable atlas.",
        features: ["Tree Key card samples identify deceased shading and the Bloodline outline", "The unresolved-Lineal control appears only in Full Tree"],
        improvements: ["Deceased atlas entries use brown shading and Newton replaces Theophilus as an orientation highlight", "Profiles show complete identity properties with UNKNOWN fallbacks and a compact one-line Age row", "Favorites opens a one-time dropdown without changing search scope or button state"],
        fixes: ["Living people no longer show an unknown death year in tree or directory lifespans", "Jon Couts no longer appears as a Family Map root ancestor", "Tree lifespan text is larger and toolbar symbols no longer change when toggled"],
        knownIssues: []
      },
      {
        version: "0.0.1.45",
        date: "2026-08-20T19:32:59.000Z",
        title: "Clearer tree spacing and scale",
        summary: "Past-partner lines now avoid name areas, long names fit more intelligently, and Developer Mode can display generation bubble measurements.",
        features: ["Developer Mode bubble scale labels every visible generation with its card width and height"],
        improvements: ["Four-or-more-part names balance across three fitted lines without widening cards", "Brighter, heavier gold partner lines stand apart from faded-red Lineal edges"],
        fixes: ["Two prior-partner links attach one-quarter from the top or bottom of their compact cards instead of crossing name centers"],
        knownIssues: []
      },
      {
        version: "0.0.1.44",
        date: "2026-08-20T18:35:02.000Z",
        title: "Faster navigation and compact PDF directory",
        summary: "Local backup status now lives in the header, Family Tree controls are more compact, and the PDF directory fits many lineage references on each page.",
        features: ["Directory, Favorites, Key, banner dismissal, and update reload keyboard shortcuts", "Compact three-column PDF Person Directory with styled Lineage IDs and first-name progressions"],
        improvements: ["Non-Lineal and unresolved-Lineal controls now match the icon-and-label toolbar pattern", "Ancestor and descendant depth controls use aligned full-height symbols and narrower number fields"],
        fixes: ["Shortcut hints are no longer clipped by the application icon", "Lucian Lynn Kretzing no longer receives the Lineal orientation highlight in PDF maps"],
        knownIssues: []
      },
      {
        version: "0.0.1.43",
        date: "2026-08-20T18:19:50.000Z",
        title: "Clearer marriage placement and spacing",
        summary: "The Family Tree now treats the latest marriage ended by death as the displayed spouse, preserves perspective-aware widow labels, and routes compact prior partners on parallel gold lines.",
        features: ["Marriage and partnership lines use gold to separate them from muted-red Lineal parent edges", "Unknown relationships draw question marks instead of inheriting previous-marriage styling"],
        improvements: ["Prior partners use two-thirds-scale cards with centered or evenly staggered placement and straight parallel links", "The Lineal symbol shares the lifespan row so tree cards are shorter"],
        fixes: ["A deceased spouse reads Married while the surviving spouse reads Widowed", "Unknown Lineal members in Generations 0 through 4 are inferred as presumed deceased"],
        knownIssues: []
      },
      {
        version: "0.0.1.42",
        date: "2026-08-20T18:08:48.000Z",
        title: "Generation 3 PDF family lines",
        summary: "Printable Family Maps now organize later generations beneath Generation 3 ancestors, distinguish the Lineal path, and omit unresolved 99-lineage branches.",
        features: ["Every Family Map uses the Root Ancestor label", "Generation 4 and later entries are grouped beneath their Generation 3 family line"],
        improvements: ["Lineal map cards use a faded-red outline, with Theophilus, Albon, and Lucian highlighted for orientation", "Smaller adaptive name type keeps map names to two lines"],
        fixes: ["Stored 99/?? lineage people and their isolated branches no longer create extra PDF maps or directory profiles"],
        knownIssues: []
      },
      {
        version: "0.0.1.41",
        date: "2026-08-20T17:41:17.000Z",
        title: "Clearer historical family status",
        summary: "Deceased-partner inference and older marriage labels now agree, while Family Tree selection and relationship lines communicate lineage and uncertainty more clearly.",
        features: ["Unknown partner relationships once again draw question marks", "The Key orders Current marriage, Previous marriage, Never married, and Unknown status"],
        improvements: ["Lineal parent edges use a faded muted-red stroke", "A selected Lineal card uses the same accent border as any selected Non-Lineal card"],
        fixes: ["Unknown-status partners of deceased people are inferred as presumed deceased", "A marriage ended by death reads Married rather than Widowed when both spouses are deceased"],
        knownIssues: []
      },
      {
        version: "0.0.1.40",
        date: "2026-08-20T17:32:08.000Z",
        title: "A denser, branch-organized PDF atlas",
        summary: "The printable atlas now opens with compact combined front matter, a George McMillen root map, and six-column family lines grouped beneath Generation 4 ancestors.",
        features: ["Developer Mode opens an in-app PDF preview instead of the browser print dialog", "Generation 5 and later map entries are grouped by their Generation 4 line"],
        improvements: ["Cover, statistics, legend, and Family Maps now flow together without forced opening-page breaks", "Family Maps use six compact columns and place George McMillen (1745) first as Generation 0", "Person Directory profiles omit internal P references, individual Notes, and Imported Source fields"],
        fixes: ["Late-generation Non-Lineal partners follow their Lineal partner into the correct Generation 4 branch"],
        knownIssues: []
      },
      {
        version: "0.0.1.39",
        date: "2026-08-20T17:12:48.000Z",
        title: "Clearer profile and tree controls",
        summary: "Selected-person actions and Family Tree display controls now use consistent icon-over-label controls with clearer names and profile details.",
        features: ["Profile actions use supplied person symbols in their relevant sections", "Full Tree, Lineage, Details, and Summary controls use supplied view symbols", "Ancestor and descendant depth fields have directional symbols"],
        improvements: ["Age values use natural language and readable number typography", "Identity details follow Born, Died, Age, Living Status, and Marital Status order"],
        fixes: ["Set as home person is no longer offered in the selected-person profile"],
        knownIssues: []
      },
      {
        version: "0.0.1.38",
        date: "2026-08-20T06:06:59.000Z",
        title: "Lineal marks and visible unknowns",
        summary: "Lineal people now retain the standard tree-card colors while a muted-red outline and corner symbol carry the lineage distinction.",
        features: ["Lineal corner mark with a bold muted-red outline", "Stateful symbols for Non-Lineal Lines and Show ?? Lineal"],
        improvements: ["Stored 99 lineage values display as ?? throughout the interface and print output", "Normal and deceased card fills no longer receive a red tint"],
        fixes: ["The unplaced-lineage control now reads as a positive Show action"],
        knownIssues: []
      },
      {
        version: "0.0.1.37",
        date: "2026-08-20T05:46:15.000Z",
        title: "Clearer partner histories",
        summary: "Unended marriages now account for each partner's living status, while compact staggered history cards keep partner lines readable.",
        features: ["Widowed status inferred for a living partner whose current spouse is deceased", "Unended deceased couples remain married", "Staggered 75% prior-partner cards"],
        improvements: ["The current Non-Lineal spouse stays to the right of the Lineal person", "Oldest and next prior partners use top and bottom alignment"],
        fixes: ["Never-married lines are dotted and every other past partner line is dashed", "Partner edges no longer use question-mark glyphs"],
        knownIssues: []
      },
      {
        version: "0.0.1.36",
        date: "2026-08-20T04:00:00.000Z",
        title: "Lineal tree emphasis",
        summary: "Lineal relatives now carry a muted blood-red tree treatment, generation controls begin fully expanded, and the Family Tree title bar aligns its controls into clearer groups.",
        features: ["Lineal and Non-Lineal family terminology", "Muted Lineal and blended Lineal-deceased tree cards", "Presumed-deceased inference for unknown-status partners"],
        improvements: ["Ancestor and descendant defaults set to 10", "Grouped generation depths and equally tall toolbar controls", "Zoom actions right-aligned in the title bar"],
        fixes: ["Developer divider percentages appear only during an active drag"],
        knownIssues: []
      },
      {
        version: "0.0.1.35",
        date: "2026-08-20T03:05:00.000Z",
        title: "Unplaced people and out-of-wedlock partnerships",
        summary: "The tree can hide 99-lineage people, Lineage now sits above Relationships, and partnerships without a start date sequence by order.",
        features: ["Hide 99 Lineage tree checkbox", "Never-married partnerships with no start date"],
        improvements: ["Lineage above Relationships in profiles and print", "Relationship order sequences undated partnerships"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.34",
        date: "2026-08-20T02:10:00.000Z",
        title: "Partial dates and partnership status",
        summary: "Profiles show partial dates and approximate ages, add a Marital Status row, and the tree gains a partnership line key.",
        features: ["Marital Status row and per-partner year plus status", "Floating Family Tree key"],
        improvements: ["Partial source dates shown as December ??, 1979 with ~ approximate ages", "Partner lines reserve solid for the current marriage"],
        fixes: [],
        knownIssues: []
      },
      {
        version: "0.0.1.33",
        date: "2026-08-20T01:20:00.000Z",
        title: "Ended partnerships read as past",
        summary: "A partnership with an unknown end reason is now a former partnership, so nobody who is single keeps a current partner.",
        features: [],
        improvements: ["Unknown end reasons map to former rather than an open-ended state"],
        fixes: ["People whose partnerships all ended no longer show a current partner in the tree or profile"],
        knownIssues: []
      },
      {
        version: "0.0.1.32",
        date: "2026-08-20T00:35:00.000Z",
        title: "Current schema only",
        summary: "McFamily now reads only the current McLineage schema, records Non-Lineal parents as their own kind, and no longer presumes living people are deceased.",
        features: ["Ancestor and descendant depths up to 10", "Non-Lineal parent links drawn only by the Non-Lineal Lines toggle"],
        improvements: ["Full Search Directory placeholder with a compact result pill", "Filter By and Sort By share one control size", "Legacy McLineage columns and spouse slots removed"],
        fixes: ["A recorded death or an age past 100 marks someone deceased instead of an UNKNOWN descriptor or lineage position", "Solid tree edges follow the Lineal bloodline again"],
        knownIssues: []
      },
      {
        version: "0.0.1.31",
        date: "2026-08-19T23:40:00.000Z",
        title: "Title Case headings",
        summary: "Section headings and dialog titles now use Title Case, and a directory row without a source path reads No Lineage ID.",
        features: [],
        improvements: ["Title Case profile, print, form, and Settings section headings", "Family Line heading in profiles and printed atlas pages"],
        fixes: ["Directory rows without a lineage path read No Lineage ID"],
        knownIssues: []
      },
      {
        version: "0.0.1.30",
        date: "2026-08-19T22:17:26.000Z",
        title: "Workspace balance and relationship visibility",
        summary: "The desktop workspace now opens at a compact 20/50/30 balance, while profile relationships and concise age details are easier to find.",
        features: ["20% directory and 70% profile-divider defaults", "Combined age and would-be-today detail"],
        improvements: ["Very thin module-divider spacing", "Ancestor and descendant labels above their number fields", "Relationships promoted above Lineage"],
        fixes: ["Albon's existing parents and siblings are visible near the top of the profile", "Unknown death ages retain the would-be-today estimate"],
        knownIssues: []
      },
      {
        version: "0.0.1.29",
        date: "2026-08-19T21:46:50.000Z",
        title: "Life status and workspace sizing",
        summary: "Profiles now explain presumed-deceased status and estimated ages, while both desktop workspace dividers resize persistently.",
        features: ["Estimated current and death ages", "Resizable directory/tree divider", "Developer divider-position percentages"],
        improvements: ["Presumed deceased after age 100", "Smaller Family Tree nodes", "Printable age details"],
        fixes: ["Unknown death dates retain deceased meaning", "Saved McLineage status is refreshed during normalization"],
        knownIssues: []
      },
      {
        version: "0.0.1.28",
        date: "2026-08-19T21:23:49.000Z",
        title: "Directory filter controls",
        summary: "Directory search and result count now share the title bar, with labelled sorting and combinable status and kinship filters.",
        features: ["Checkbox multi-select directory filters", "Lineal and Non-Lineal directory scopes"],
        improvements: ["Result count inside title-bar search", "Visible Filter By and Sort By labels"],
        fixes: ["Legacy living-status selections migrate into the new filter menu", "Other parent lines is now labelled Non-Lineal Lines"],
        knownIssues: []
      },
      {
        version: "0.0.1.27",
        date: "2026-08-19T21:02:33.000Z",
        title: "Relationship context",
        summary: "Profile and print relationships now show generation, parent role, birth order, birth year, and marriage year context.",
        features: ["Generation-labelled family groups", "Relationship context beside each person"],
        improvements: ["Lineal and Non-Lineal parent designations", "Birth order and year for siblings and children"],
        fixes: ["Marriage years remain visible in compact partner lists", "Screen and print relationship order now matches"],
        knownIssues: []
      },
      {
        version: "0.0.1.26",
        date: "2026-08-19T20:37:28.000Z",
        title: "Flexible partner records",
        summary: "Current McLineage imports now read one structured partner relationship column instead of fixed spouse slots.",
        features: ["partner_relationships_json source records", "Relationship end reasons"],
        improvements: ["Stable relationship references", "Death, divorce, and unknown endings map to distinct partner states"],
        fixes: ["Non-Lineal parents validate against normalized partner pairs", "Legacy spouse-slot files remain importable"],
        knownIssues: []
      },
      {
        version: "0.0.1.25",
        date: "2026-08-19T20:20:01.000Z",
        title: "Compact generation cards",
        summary: "Family Tree cards now stack name words while lineage readings and imported life status follow the intended generation rules.",
        features: ["Generation-prefixed Child of readings", "Stacked tree-card names"],
        improvements: ["Narrower Family Tree cards", "First-name parent readings"],
        fixes: ["Only G0-G4 are automatically marked deceased", "Saved imported status is corrected during migration"],
        knownIssues: []
      },
      {
        version: "0.0.1.24",
        date: "2026-08-19T20:05:32.000Z",
        title: "Explicit parent roles",
        summary: "Current McLineage imports now distinguish the direct bloodline parent from an evidence-supported spouse-parent reference.",
        features: ["Lineal parent references", "Explicit Non-Lineal parent links"],
        improvements: ["Non-Lineal parents become real parent relationships", "Lineal lineage remains authoritative"],
        fixes: ["Non-Lineal references must resolve through the Lineal parent's spouse slots", "Older direct-parent and lineage-path schemas remain importable"],
        knownIssues: []
      },
      {
        version: "0.0.1.23",
        date: "2026-08-19T19:41:43.000Z",
        title: "Clearer McLineage columns",
        summary: "Current McLineage imports now use a record-first layout, a concise direct-parent field, and person-oriented sort naming.",
        features: ["Record-first McLineage schema", "Direct parent_lineage_id references"],
        improvements: ["Person sort names sit beside surnames", "Source row numbers move beside data-quality notes"],
        fixes: ["Older direct-parent and lineage-path source schemas remain distinguishable", "Removed parent display names are no longer required"],
        knownIssues: []
      },
      {
        version: "0.0.1.22",
        date: "2026-08-19T19:21:52.000Z",
        title: "First-class spouse records",
        summary: "Current McLineage imports now resolve every spouse slot to its own stable person row instead of creating an extra person during import.",
        features: ["Explicit spouse record references", "Shared person identity and date columns"],
        improvements: ["Spouse rows keep stable P references", "Older descendant and embedded-spouse sources remain importable"],
        fixes: ["Unlineaged spouse rows no longer fail lineage validation", "Missing, self, or duplicate spouse references are rejected"],
        knownIssues: []
      },
      {
        version: "0.0.1.21",
        date: "2026-08-19T18:00:45.000Z",
        title: "Question-mark partial dates",
        summary: "Current McLineage imports now recognize question marks as unknown date digits when the source descriptor is partial.",
        features: ["Question marks may appear anywhere in partial source dates"],
        improvements: ["Partial and unrecognized source-date warnings are reported separately", "The cleaned-source contract rejects invalid date descriptors"],
        fixes: ["Valid partial dates are no longer described as invalid"],
        knownIssues: []
      },
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
      { id: "road-accounts", title: "Server-authenticated accounts and usage history", description: "Add identity-backed accounts and a central audit trail for sign-ins and reading activity beyond the current encrypted passphrase grants and publication history. This requires a secure backend.", state: "wishlist", priority: 1, target: "Future backend release", effort: 4, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-photos", title: "Private profile photos", description: "Explore storage-safe, offline profile photos without making backups fragile or publishing image requests.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 3, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-gedcom", title: "GEDCOM import", description: "Map standard genealogy exports into McFamily people and relationships with a review step.", state: "wishlist", priority: 3, target: "Unscheduled", effort: 3, createdAt: "2026-08-18T12:00:00.000Z" },
      { id: "road-family-atlas", title: "Local family atlas", description: "Ship the editable directory, interactive tree, private backups, and print-ready family atlas.", state: "released", priority: 1, target: "0.0.1.3", effort: 4, createdAt: "2026-08-18T12:00:00.000Z" }
    ],

    help: [
      { id: "start", title: "Getting started", section: "Basics", keywords: "start passphrase password access owner editor viewer encrypted first launch", html: "<p>Open the ordinary McFamily link and enter the private passphrase assigned by the Owner. McFamily identifies the matching access locally, downloads only ciphertext, decrypts it in this browser, and validates the complete five-file family record before opening. Recipients do not choose a role and do not need a ZIP. Before the first encrypted vault exists, the Owner uses one private recovery ZIP to initialize their browser and publish hosted access.</p>" },
      { id: "tree", title: "Exploring the Family Tree", section: "Family", keywords: "tree focus overview zoom pan scroll horizontal vertical generation ancestor descendant home person condensed detailed co-parent non-lineal resize preferred legal birth name", html: "<p>Lineage shows the selected person and nearby generations; choosing a person from search returns here automatically. Full Tree clears and closes the selected-person panel, and Lineage stays disabled until another person is selected. Set the grouped Ancestor and Descendant depth numbers, or switch between Summary and Details cards. Name Preferences groups Preferred (Display), Legal (Current), and Lineal (Birth) with Short and Full choices. The selected-person panel follows this source preference, while its Lineage section always uses full Lineal Birth names. Both generation depths default to 10. Narrow cards place each name word on its own line; Lineal people keep the standard living or deceased card fill and use a bold muted-red outline plus a small lineage symbol beside the lifespan. Selection temporarily replaces that outline with the same accent border used for every person. Faded muted-red parent edges follow the Lineal bloodline. <strong>Non-Lineal Lines</strong> adds the lighter dashed branch from each recorded Non-Lineal parent to their child while keeping one fixed filled icon. Gold partner links distinguish current marriages (solid), previous marriages (dashed), never-married relationships (dotted), and unknown relationships (question marks). Up to two prior partners appear at two-thirds size on the left: one is centered; two align with the top and bottom of the full-size spouse and use evenly spaced parallel links. The current or latest death-ended spouse remains full-size on the right. The Key at the upper right of the canvas names each line and can be collapsed. <strong>?? Lineal</strong> appears only in Full Tree and reveals people whose stored source lineage is 99, plus anyone connected only to them; enabling it centers those people without changing its outlined icon. They always remain in the directory and search. On desktop, drag the divider beside the selected person panel to resize both modules; Developer Mode shows its percentage only while dragging. Scroll horizontally or vertically to explore larger layouts; edit the zoom number directly, use the adjacent percent sign and stacked one-percent arrows, or choose the right-aligned Out, In, and Fit actions.</p>" },
      { id: "people", title: "People and relationships", section: "Family", keywords: "people directory favorites star search sort filter blood lineal non-lineal alphabet address phone email parent child partner ancestry lineage generation names preferred legal birth maiden", html: "<p>Use Directory to the left of Search to open or close the pane. Its title-bar search contains the current result count. Filter By combines living status, Lineal or Non-Lineal scope, and Has Address, Has Phone, or Has Email; selections within each group match any chosen option. A shared phone stored with an address counts as Has Phone and appears beneath that address rather than as an individual's phone. Sort By switches between first and last name; the A–Z rail follows the filtered results. Global person results lead with the display name and add Birth and Current names in parentheses only when they differ. Select the strongly highlighted star beside a person search result or use Favorite in the selected-person panel to pin them above other matches. Favorites to the right of Search toggles every starred person beneath the search field without changing the search scope. Developer Mode can save a private Favorites JSON file outside browser storage and restore it after a reset. The person panel closes and deselects with its X; selecting a person in the Family Tree reopens it. Names lists Preferred (Display), Legal (Current), Lineal (Birth), and Maiden as four compact full-name rows; unrecorded values use ----. Lineage uses a compact Family Line with each name followed by its lineage number and generation; readings use the generation and the parent's first name, such as Gen 6, 5th Child of Max. Lineage sits directly under identity details, above Relationships. Identity details show Born, Died, Age, Living Status, and Marital Status; Gender and Pronouns are hidden for now. Missing values use UNKNOWN except a living person's Died value, which is ----. Age uses natural years or months on one line and adds the emphasized would-be age for deceased people. McLineage death descriptors distinguish no recorded death (NONE), an explicitly unknown death date (UNKNOWN), and a presumed death (UNKNOWN PRESUMED). A deceased spouse in a marriage ended by death reads Married while the surviving spouse reads Widowed. Relationship groups label parent, sibling, and child generations; each Partners row adds its start–end years and perspective-aware status; parents identify recorded Lineal or Non-Lineal roles, siblings and children show birth order and year, and partners show relationship years. Partners puts the displayed spouse first in bold before reverse-ordered prior partners. Notes follow Relationships, and Imported Source finishes the profile. Every editable date accepts blank, YYYY, YYYY-MM, or YYYY-MM-DD with ? in any unknown digit and shows the same live red validation. When adding a person, at least one First name is required, and searchable Parents, Partners, and Children pickers connect existing people before saving. A selected Partner also records relationship status plus start and end dates. Connecting a Lineal parent previews and assigns the child’s complete Lineage ID. Owner and Editor can use the Edit control beside each partner history to record relationship type, start and end dates, end reason, and notes. Generations are rooted at George McMillen (1745) as G0.</p>" },
      { id: "print", title: "Print or save a PDF", section: "Family", keywords: "print pdf atlas directory household address landline contact lineage family maps generation developer preview", html: "<p>Choose <strong>Print / Save PDF</strong> to build the atlas and open the browser print dialog. After the cover, <strong>Directory of McMillen Clan</strong> includes people with at least one phone, email, or address and keeps their current partners in the same household. Main people and partners occupy separate rows with individual phones and emails; a shared Place phone stays with the Address column. The four column labels repeat only at the top of each printed page. Display Names are used throughout, only Lineal names are bold, and every deceased household person retains the concise italic death marker. Six-column Family Maps still include people omitted from the contact directory. In Developer Mode, the same action opens an in-app preview instead of printing.</p>" },
      { id: "notes", title: "Working with Notes", section: "Features", keywords: "notes text edit modal autosave", html: "<p>Notes is a single private plain-text scratchpad available only to Owner and Editor access. Open it from the top bar or press <kbd>N</kbd>; it is included in private recovery files and encrypted family publications.</p>" },
      { id: "backup", title: "Owner recovery file", section: "Data", keywords: "zip csv recovery backup restore owner private metadata audit", html: "<p>Owner and Editor access can download a private recovery ZIP containing McPeople, McPlaces, McRelations, McResidences, and McMetadata. It is not the normal sharing method and contains readable private information. Store it securely and use it only to recover or initialize the Owner workspace. Members and Viewers receive no recovery import or download controls.</p>" },
      { id: "cloud", title: "Publishing the encrypted family", section: "Data", keywords: "cloud github audit encrypted vault publish latest patch editor username token conflict json path changes update", html: "<p><strong>Audit</strong> lets Admin and named Editor access publish the current family to the ciphertext-only public <code>mcdata</code> repository. GitHub settings expand from the top connection card. McFamily compares the local family with the record opened from the vault, lists every unpublished family change, and enables Update only when changes exist. Admin publications are recorded as Admin; Editor publications use the signed-in Editor name. McFamily generates one <code>data/mcfamily/McFamily-access.json</code> file containing the access grants plus separately encrypted full and Viewer family packages. The fine-grained GitHub token stays outside the vault.</p>" },
      { id: "access-packages", title: "Passphrases and access", section: "Data", keywords: "password passphrase access owner editor member viewer pii redacted revoke rotate", html: "<p>Everyone uses the same public McFamily link and enters only their assigned passphrase; McFamily identifies the matching grant locally. <strong>Owner</strong> can edit, publish, and manage access. Each named <strong>Editor</strong> has a unique passphrase, can edit and publish, and is automatically named in publication history. Separately named <strong>Members</strong> see full profile details read-only, while named <strong>Viewers</strong> decrypt only a copy with places, contacts, and unstructured private notes physically removed. Neither read-only role can open family Notes or Audit. In Developer Mode, the signed-in Owner can use the role pill to preview other roles without changing data or access. Owners can add, rename, rotate, or revoke every recipient independently, and McFamily rejects duplicate passphrases. Revocation blocks the next sign-in after reload but cannot erase information already seen or copied.</p>" },
      { id: "privacy", title: "Privacy and local data", section: "Data", keywords: "privacy encryption aes gcm pbkdf2 passphrase github token redacted lock", html: "<p>The public data repository contains only AES-GCM ciphertext, salts, nonces, wrapped random keys, access labels, and non-secret version metadata. Passphrases and GitHub tokens are never written into the vault. Eight characters are required, but three unrelated words are recommended because short phrases are easier to guess from the public encrypted file. Send phrases privately and never reuse a personal password. A hosted session keeps the decrypted family only in memory; the encrypted GitHub vault and its commit history are the saved source. <strong>Lock McFamily</strong> clears that session, reloads, and requires a passphrase again without changing the hosted vault. Dismissed hints, dismissed What’s New banners, Directory visibility, and favorites remain as compact non-sensitive device preferences. Member and Viewer modes remove Audit, routine ZIP, PDF, developer-data, and publishing controls; Viewer also lacks the private fields cryptographically. Member and Viewer sign-ins are not centrally recorded without a backend.</p>" },
      { id: "install", title: "Install McFamily", section: "Installation", keywords: "install home screen pwa offline", html: "<p>Use the browser’s Install app, Add to Home Screen, or Add to Dock command. After the shell has loaded once, local features continue to work offline.</p>" },
      { id: "shortcuts", title: "Keyboard access", section: "Accessibility", keywords: "keyboard shortcuts search directory favorites key update reload dialog popup", html: "<p>Press <kbd>/</kbd> for search, <kbd>D</kbd> for Directory, <kbd>F</kbd> for Favorites, <kbd>K</kbd> for the tree Key, <kbd>X</kbd> to close the active pop-up or dismiss What’s New, <kbd>R</kbd> to update McFamily when a new version is ready, <kbd>T</kbd> for theme, and <kbd>?</kbd> for Help. The Shortcut Reference lists any additional actions available to your permission role. Visible controls provide every shortcut action.</p>" }
    ]
  };

  const treeHelp = CONFIG.help.find(function (item) { return item.id === "tree"; });
  treeHelp.html = treeHelp.html
    .replace("Focus view shows", "Lineage view shows")
    .replace("the grouped Ancestor and Descendant depth numbers", "the symbol-labelled Ancestors and Descendants depth numbers")
    .replace("condensed and detailed cards", "Summary and Details cards")
    .replace("Narrow cards place each name word on its own line", "Narrow cards keep short names stacked while names with four or more parts balance across three fitted lines")
    .replace("Gold partner links", "Bright gold partner links")
    .replace("its icon fills while the lines are shown", "its filled icon remains the same in both states")
    .replace("<strong>Show ?? Lineal</strong> reveals", "<strong>?? Lineal</strong> appears only in Full Tree and reveals")
    .replace("and its icon fills while those people are shown", "and its outlined icon remains the same in both states")
    .replace("two align with the top and bottom of the full-size spouse and use evenly spaced parallel links", "two align with the top and bottom of the full-size spouse and attach their parallel links one-quarter from each compact card’s outer edge")
    .replace("Developer Mode shows its percentage only while dragging", "Developer Mode adds a left-side generation bubble scale and shows divider percentages only while dragging");
  window.LocalApp.config = Object.freeze(CONFIG);
})();
