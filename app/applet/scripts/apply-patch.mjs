import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";

const indexPath = path.resolve("index.html");
let html = fs.readFileSync(indexPath, "utf8");

// 1. FIREBASE_CONFIG_FIELDS
const target1 = 'const FIREBASE_CONFIG_FIELDS = Object.freeze(["apiKey","authDomain","projectId","appId","storageBucket","messagingSenderId","measurementId"]);';
const replacement1 = 'const FIREBASE_CONFIG_FIELDS = Object.freeze(["apiKey","authDomain","projectId","appId","storageBucket","messagingSenderId","measurementId","firestoreDatabaseId","databaseId"]);';

if (!html.includes(target1)) {
  console.error("Target 1 not found!");
  process.exit(1);
}
html = html.replace(target1, replacement1);

// 2. firebaseCloudInitialize
const target2 = `  async function firebaseCloudInitialize() {
    if (!state.cloud.configLoaded) cloudLoadLocalMetadata();
    if (!firebaseConfigConfigured()) {
      const appletConfig = await cloudFetchAppletConfig();
      if (appletConfig) {
        state.cloud.config = appletConfig;
        localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(appletConfig));
        state.cloud.status = "signed_out";
      }
    }
    if (!firebaseConfigConfigured()) { cloudSetStatus("not_configured"); return false; }
    if (state.cloud.app && state.cloud.auth && state.cloud.firestore) return true;
    if (state.cloud.initializing) return false;
    state.cloud.initializing = true;
    try {
      const modules = await firebaseCloudLoadSDK(), { appModule, authModule, firestoreModule } = modules;
      state.cloud.app = appModule.initializeApp(normalizeCloudConfig(state.cloud.config), "fepl-cloud-sync");
      state.cloud.auth = authModule.getAuth(state.cloud.app);
      state.cloud.firestore = firestoreModule.getFirestore(state.cloud.app);
      state.cloud.unsubscribeAuth = authModule.onAuthStateChanged(state.cloud.auth, user => { void firebaseCloudHandleAuthState(user); });
      if (!state.cloud.user) cloudSetStatus("signed_out");
      return true;
    } catch (error) {
      cloudSetStatus(cloudStatusForError(error), { error: cloudFriendlyError(error) });
      return false;
    } finally { state.cloud.initializing = false; }
  }`;

const replacement2 = `  async function firebaseCloudInitialize() {
    if (!state.cloud.configLoaded) cloudLoadLocalMetadata();
    const appletConfig = await cloudFetchAppletConfig();
    if (appletConfig) {
      const mergedDbId = appletConfig.firestoreDatabaseId || appletConfig.databaseId || state.cloud.config.firestoreDatabaseId || state.cloud.config.databaseId || "ai-studio-fecivilstudyapp-2f80f9c9-ed97-4e6b-b735-54438ec415e7";
      state.cloud.config = { ...state.cloud.config, ...appletConfig, firestoreDatabaseId: mergedDbId };
      try { localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(state.cloud.config)); } catch {}
      if (!firebaseConfigConfigured()) state.cloud.status = "signed_out";
    }
    if (!firebaseConfigConfigured()) { cloudSetStatus("not_configured"); return false; }
    if (state.cloud.app && state.cloud.auth && state.cloud.firestore) return true;
    if (state.cloud.initializing) return false;
    state.cloud.initializing = true;
    try {
      const modules = await firebaseCloudLoadSDK(), { appModule, authModule, firestoreModule } = modules;
      state.cloud.app = appModule.initializeApp(normalizeCloudConfig(state.cloud.config), "fepl-cloud-sync");
      state.cloud.auth = authModule.getAuth(state.cloud.app);
      const dbId = state.cloud.config.firestoreDatabaseId || state.cloud.config.databaseId || "ai-studio-fecivilstudyapp-2f80f9c9-ed97-4e6b-b735-54438ec415e7";
      state.cloud.firestore = dbId ? firestoreModule.getFirestore(state.cloud.app, dbId) : firestoreModule.getFirestore(state.cloud.app);
      state.cloud.unsubscribeAuth = authModule.onAuthStateChanged(state.cloud.auth, user => { void firebaseCloudHandleAuthState(user); });
      if (!state.cloud.user) cloudSetStatus("signed_out");
      return true;
    } catch (error) {
      cloudSetStatus(cloudStatusForError(error), { error: cloudFriendlyError(error) });
      return false;
    } finally { state.cloud.initializing = false; }
  }`;

if (!html.includes(target2)) {
  console.error("Target 2 not found!");
  process.exit(1);
}
html = html.replace(target2, replacement2);

// 3. Google Drive Question Bank import functions
const target3 = `    toast("Google Drive worksheet backup disconnected.", "info");
    renderApp();
  }`;

const driveImportCode = `    toast("Google Drive worksheet backup disconnected.", "info");
    renderApp();
  }
  let isImportingFromGoogleDrive = false;
  async function loadGooglePickerSDK() {
    if (window.google?.picker) return window.google.picker;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout loading Google Picker API.")), 15000);
      const onLoaded = () => {
        clearTimeout(timeout);
        if (window.gapi) {
          window.gapi.load("picker", {
            callback: () => {
              if (window.google?.picker) resolve(window.google.picker);
              else reject(new Error("Google Picker loaded but google.picker namespace is missing."));
            },
            onerror: () => reject(new Error("Failed to initialize Google Picker library."))
          });
        } else {
          reject(new Error("Google API script failed to provide gapi object."));
        }
      };
      if (window.gapi) {
        onLoaded();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = onLoaded;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load Google API script (https://apis.google.com/js/api.js). Check network connection."));
      };
      document.head.appendChild(script);
    });
  }
  async function importQuestionBankFromGoogleDrive() {
    if (isImportingFromGoogleDrive) return;
    try {
      if (!firebaseConfigConfigured()) {
        toast("Firebase configuration is required to use Google Drive. Configure Firebase in Settings.", "error");
        return;
      }
      if (!state.cloud.user) {
        toast("Sign in with Google in Settings → Cloud Progress Sync before using Google Drive.", "warning");
        return;
      }
      const owner = driveLinkedOwnerUid();
      if (!owner) {
        toast("Link this local study profile to your signed-in Google account in Settings → Cloud Progress Sync before using Google Drive.", "warning");
        return;
      }
      if (state.cloud.user.uid !== owner) {
        toast("Google account mismatch. The signed-in Google account does not match this study profile's owner.", "error");
        return;
      }
      if (!state.drive.accessToken || !state.drive.enabled) {
        toast("Connecting to Google Drive…", "info");
        await connectGoogleDrive();
      }
      const identity = driveRequireIdentity({ requireToken: true });
      const accessToken = identity.accessToken;
      const apiKey = state.cloud.config.apiKey;
      const appId = state.cloud.config.messagingSenderId || (state.cloud.config.appId || "").split(":")[1] || "";
      toast("Opening Google Drive file picker…", "info");
      const pickerModule = await loadGooglePickerSDK();
      await new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        const view = new pickerModule.DocsView();
        view.setMimeTypes("application/json,text/csv,text/plain,application/octet-stream");
        view.setIncludeFolders(true);
        const builder = new pickerModule.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setTitle("Select FE Civil Question Bank (.json or .csv)")
          .enableFeature(pickerModule.Feature.MULTISELECT_ENABLED)
          .setCallback(async (data) => {
            const action = data[pickerModule.Response.ACTION];
            if (action === pickerModule.Action.CANCEL) { done(); return; }
            if (action === pickerModule.Action.PICKED) {
              done();
              const docs = data[pickerModule.Response.DOCUMENTS] || [];
              if (!docs.length) return;
              isImportingFromGoogleDrive = true;
              toast(\`Downloading \${docs.length} file\${docs.length === 1 ? "" : "s"} from Google Drive…\`, "info");
              const downloadedFiles = [], errors = [];
              for (const doc of docs) {
                const fileId = doc[pickerModule.Document.ID];
                const fileName = doc[pickerModule.Document.NAME] || \`drive-bank-\${fileId}.json\`;
                const mimeType = doc[pickerModule.Document.MIME_TYPE] || "application/json";
                try {
                  const response = await driveDownloadFile(fileId);
                  const blob = await response.blob();
                  const file = new File([blob], fileName, { type: mimeType });
                  downloadedFiles.push(file);
                } catch (err) {
                  errors.push(\`\${fileName}: \${err.message}\`);
                }
              }
              if (downloadedFiles.length) {
                await importQuestionFiles(downloadedFiles, false);
              }
              if (errors.length) {
                showModal({
                  title: "Drive Download Notes",
                  body: \`<div class="notice error">Failed to download some files from Google Drive:<br>\${errors.map(e => \`• \${escapeHTML(e)}\`).join("<br>")}</div>\`,
                  footer: '<span class="right"></span><button class="btn primary" data-action="close-modal">Done</button>'
                });
              }
              isImportingFromGoogleDrive = false;
            }
          });
        if (apiKey) builder.setDeveloperKey(apiKey);
        if (appId) builder.setAppId(appId);
        try {
          const origin = window.location.protocol + "//" + window.location.host;
          builder.setOrigin(origin);
        } catch {}
        const picker = builder.build();
        picker.setVisible(true);
      });
    } catch (error) {
      isImportingFromGoogleDrive = false;
      const friendly = driveFriendlyError(error);
      const isPickerDisabled = /API.*not.*enabled|has not been used in project/i.test(error.message || "");
      if (isPickerDisabled) {
        showModal({
          title: "Google Picker API Setup Required",
          body: \`<div class="notice warning">The Google Picker API is not enabled in your Google Cloud Project.<br><br>Please enable the <strong>Google Picker API</strong> in the Google Cloud Console for project <code>\${escapeHTML(state.cloud.config.projectId || "")}</code> and ensure <code>\${escapeHTML(window.location.origin)}</code> is added to Authorized JavaScript Origins.</div>\`,
          footer: '<span class="right"></span><button class="btn primary" data-action="close-modal">Done</button>'
        });
      } else {
        toast(\`Google Drive import failed: \${friendly}\`, "error");
      }
    } finally {
      isImportingFromGoogleDrive = false;
    }
  }`;

if (!html.includes(target3)) {
  console.error("Target 3 not found!");
  process.exit(1);
}
html = html.replace(target3, driveImportCode);

// 4. Tools menu: turn Import Bank into submenu
const target4 = '<section class="bank-tools-section" aria-label="Import, export and selection"><h3>Import & export</h3><button class="btn" data-action="import-bank">Import Bank…</button><button class="btn" data-action="export-bank-json"${ui.selection.size ? "" : " disabled"}>Export Selected JSON</button>';
const replacement4 = '<section class="bank-tools-section" aria-label="Import, export and selection"><h3>Import & export</h3><details class="bank-tools-submenu" data-persistent-panel="bank-tools-import-submenu"><summary class="btn" aria-haspopup="menu"><span>Import Bank…</span><span aria-hidden="true">▾</span></summary><div class="bank-tools-submenu-panel" style="padding-left:8px; display:grid; gap:4px; margin:4px 0;"><button class="btn" data-action="import-bank">Import from this device…</button><button class="btn" data-action="import-bank-drive">Import from Google Drive…</button></div></details><button class="btn" data-action="export-bank-json"${ui.selection.size ? "" : " disabled"}>Export Selected JSON</button>';

if (!html.includes(target4)) {
  console.error("Target 4 not found!");
  process.exit(1);
}
html = html.replace(target4, replacement4);

// 5. Action dispatcher
const target5 = 'case "import-bank": state.bank.utilityPopup = ""; state.pendingQuestionImportMode = "bank"; $("#question-file-input").click(); break;';
const replacement5 = 'case "import-bank": state.bank.utilityPopup = ""; state.pendingQuestionImportMode = "bank"; $$(".bank-tools-menu").forEach(el => { el.open = false; }); $("#question-file-input").click(); break;\n        case "import-bank-drive": state.bank.utilityPopup = ""; $$(".bank-tools-menu").forEach(el => { el.open = false; }); await importQuestionBankFromGoogleDrive(); break;';

if (!html.includes(target5)) {
  console.error("Target 5 not found!");
  process.exit(1);
}
html = html.replace(target5, replacement5);

// Verify JS parsing
const start = html.indexOf("<script>(() => {");
const end = html.indexOf("\\n</script>", start);
if (start < 0 || end < 0) throw new Error("main script block not found");
new vm.Script(html.slice(start + 8, end));
console.log("JavaScript parses successfully!");

// Write updated index.html
fs.writeFileSync(indexPath, html, "utf8");
const newSha256 = crypto.createHash("sha256").update(html).digest("hex");
console.log("New index.html SHA256:", newSha256);
