const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  screen,
  session,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const {
  APP_ORIGIN,
  isAllowedExternalUrl,
  isTrustedSpeechSender,
  resolveAssetPath,
} = require("./security.cjs");
const { getInitialWindowLayout } = require("./window-options.cjs");
const { createNativeSpeechService } = require("./native-speech.cjs");
const { getWindowThemeOptions, createWindowThemeController } = require("./theme.cjs");
const { createVoicePack } = require("./voice-pack.cjs");

// Before 2.0 the app was called Oxford Cards. Its profile (progress in Local Storage of the oxford://app origin,
// the speech cache) is copied once; the old folder stays untouched as a backup.
function migrateLegacyProfile(legacyPath, targetPath) {
  // The page creates Local Storage on the first start, so its absence means the progress has not been moved yet.
  if (fs.existsSync(path.join(targetPath, "Local Storage")) || !fs.existsSync(path.join(legacyPath, "Local Storage")))
    return null;
  const staging = `${targetPath}.migrating`;
  const skipped = new Set(["Cache", "Code Cache", "GPUCache", "DawnCache", "DawnGraphiteCache", "DawnWebGPUCache", "Crashpad", "lockfile"]);
  try {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.cpSync(legacyPath, staging, {
      recursive: true,
      filter: (source) => !skipped.has(path.relative(legacyPath, source).split(path.sep)[0]),
    });
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(staging)) {
      if (!fs.existsSync(path.join(targetPath, entry))) fs.renameSync(path.join(staging, entry), path.join(targetPath, entry));
    }
    fs.rmSync(staging, { recursive: true, force: true });
    return null;
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    return error;
  }
}

// Only words shown on cards may be spoken: Oxford 3000, the cards of every film mode and the irregular verbs
// (the infinitive and the three forms as spokenForms in src/lib/verbs.ts reads them).
function speechVocabulary() {
  const filmsDir = path.join(__dirname, "..", "src", "data", "films");
  const filmCards = fs
    .readdirSync(filmsDir)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(filmsDir, name), "utf8")).cards);
  const verbs = require("../src/data/irregular-verbs.json").flatMap((verb) => [
    verb.base,
    [verb.base, verb.past, verb.participle].map((form) => form.split(" / ").join(" or ")).join(", "),
  ]);
  return new Set([...[...require("../src/data/oxford3000.json"), ...filmCards].map((entry) => entry.word), ...verbs]);
}

const APP_NAME = "English Path";
app.setName(APP_NAME);
// Progress lives in the user's profile, apart from the installed program.
const userDataPath = path.join(app.getPath("appData"), APP_NAME);
const legacyDataError = migrateLegacyProfile(path.join(app.getPath("appData"), "Oxford Cards"), userDataPath);
fs.mkdirSync(userDataPath, { recursive: true });
app.setPath("userData", userDataPath);
app.setAppUserModelId("local.englishpath.desktop");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "oxford",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      codeCache: true,
    },
  },
]);
app.enableSandbox();

let mainWindow;
let nativeSpeech;
let voicePack;
let windowTheme;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app
    .whenReady()
    .then(async () => {
      if (legacyDataError)
        throw new Error(
          `Не удалось перенести прогресс Oxford Cards (${legacyDataError.code ?? legacyDataError.message}). ` +
            "Закройте Oxford Cards, если она открыта, и запустите English Path снова. Прежний прогресс не изменён.",
        );
      const root = path.join(app.getAppPath(), "dist");
      if (!fs.existsSync(path.join(root, "index.html")))
        throw new Error(
          "Сборка приложения не найдена. Выполните npm run build.",
        );
      nativeTheme.themeSource = "system";
      Menu.setApplicationMenu(null);
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      nativeSpeech = createNativeSpeechService({
        workerPath: app.isPackaged
          ? path.join(process.resourcesPath, "speech-worker.ps1")
          : path.join(__dirname, "speech-worker.ps1"),
        allowedTexts: speechVocabulary(),
        cacheDir: path.join(userDataPath, "speech-cache"),
      });
      ipcMain.handle("oxford:speech:prepare", (event, text) => {
        if (!isTrustedSpeechSender(event, mainWindow?.webContents))
          throw new Error("Недоступный источник запроса озвучивания.");
        return nativeSpeech.prepare(text);
      });

      voicePack = createVoicePack({
        // Large and re-downloadable: the local, not the roaming, profile.
        dir: path.join(process.env.LOCALAPPDATA || userDataPath, APP_NAME, "voices"),
        manifest: require("./voice-pack.json"),
        onStatus: (status) => mainWindow?.webContents.send("oxford:voices:status", status),
      });
      ipcMain.handle("oxford:voices:status", (event) => {
        if (!isTrustedSpeechSender(event, mainWindow?.webContents)) throw new Error("Недоступный источник запроса.");
        return voicePack.status();
      });
      voicePack.start();

      protocol.handle("oxford", async (request) => {
        if (request.method !== "GET" && request.method !== "HEAD")
          return new Response("Method not allowed", { status: 405 });
        const recording = /^oxford:\/\/app\/voices\/([a-z]+)\/([0-9a-f]{16})\.mp3$/.exec(request.url);
        if (recording) {
          const data = await voicePack.read(recording[1], recording[2]).catch(() => null);
          if (data) return new Response(data, { headers: { "content-type": "audio/mpeg" } });
        }
        const asset = resolveAssetPath(root, request.url);
        if (!asset) return new Response("Not found", { status: 404 });
        try {
          const response = await net.fetch(pathToFileURL(asset).href);
          const headers = new Headers(response.headers);
          headers.set(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
          );
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });

      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const initialLayout = getInitialWindowLayout(display.workArea);
      mainWindow = new BrowserWindow({
        ...initialLayout.options,
        title: APP_NAME,
        ...getWindowThemeOptions(nativeTheme),
        titleBarStyle: "hidden",
        icon: path.join(app.getAppPath(), "desktop", "resources", "icon.ico"),
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          webviewTag: false,
          spellcheck: false,
        },
      });

      windowTheme = createWindowThemeController({
        nativeTheme,
        ipcMain,
        getWindow: () => mainWindow,
      });

      const openDictionary = (url) => {
        if (isAllowedExternalUrl(url))
          shell.openExternal(url).catch(() => {
            dialog.showErrorBox(
              "Не удалось открыть ссылку",
              "Откройте словарь в браузере вручную.",
            );
          });
      };
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        openDictionary(url);
        return { action: "deny" };
      });
      mainWindow.webContents.on("will-navigate", (event, url) => {
        if (
          url !== `${APP_ORIGIN}/index.html` &&
          url !== `${APP_ORIGIN}/index.html#`
        ) {
          event.preventDefault();
          openDictionary(url);
        }
      });
      mainWindow.webContents.on("will-attach-webview", (event) =>
        event.preventDefault(),
      );
      mainWindow.once("ready-to-show", () => {
        windowTheme.update();
        if (initialLayout.maximize) mainWindow.maximize();
        mainWindow.show();
      });
      mainWindow.on("closed", () => {
        windowTheme.dispose();
        mainWindow = undefined;
      });
      await mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
    })
    .catch((error) => {
      dialog.showErrorBox(`${APP_NAME} — не удалось запустить`, error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    windowTheme?.dispose();
    nativeSpeech?.dispose();
    voicePack?.dispose();
  });
}
