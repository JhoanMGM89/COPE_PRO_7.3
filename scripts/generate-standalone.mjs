import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const modulesDir = path.join(rootDir, "public", "modules");
const outputDir = "/mnt/documents";
const outputName = "COPE_PRO_Standalone_v13.html";
const outputPath = path.join(outputDir, outputName);
const authStorageKey = "sb-ufrmotkqquwbujppgjlp-auth-token";
const authBackupKey = "cope_auth_backup_v1";
const standaloneAuthCacheKey = "cope_standalone_auth_cache_v1";

const inlineLocalAssets = async (html) => {
  let nextHtml = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

  const stylesheetMatches = [...nextHtml.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
  for (const match of stylesheetMatches) {
    const href = match[1];
    if (/^(https?:)?\/\//i.test(href)) continue;
    const assetPath = path.join(distDir, href.replace(/^\.\//, "").replace(/^\//, ""));
    const css = await fs.readFile(assetPath, "utf8");
    const safeCss = css.replace(/<\/style/gi, "<\\/style");
    nextHtml = nextHtml.replace(match[0], `<style>\n${safeCss}\n</style>`);
  }

  const scriptMatches = [...nextHtml.matchAll(/<script([^>]*?)type="module"([^>]*?)src="([^"]+)"([^>]*)><\/script>/g)];
  for (const match of scriptMatches) {
    const src = match[3];
    if (/^(https?:)?\/\//i.test(src)) continue;
    const assetPath = path.join(distDir, src.replace(/^\.\//, "").replace(/^\//, ""));
    const js = await fs.readFile(assetPath, "utf8");
    const jsBase64 = Buffer.from(js, "utf8").toString("base64");
    nextHtml = nextHtml.replace(
      match[0],
      `<script type="module">\nconst __standaloneJsBytes = Uint8Array.from(atob(${JSON.stringify(jsBase64)}), c => c.charCodeAt(0));\nconst __standaloneJsBlob = new Blob([__standaloneJsBytes], { type: "text/javascript;charset=utf-8" });\nconst __standaloneJsUrl = URL.createObjectURL(__standaloneJsBlob);\nimport(__standaloneJsUrl);\n</script>`
    );
  }

  return nextHtml;
};

const buildEmbeddedModules = async () => {
  const entries = await fs.readdir(modulesDir);
  const embedded = {};

  for (const entry of entries) {
    if (!entry.endsWith(".html")) continue;
    const fileBuffer = await fs.readFile(path.join(modulesDir, entry));
    embedded[entry] = fileBuffer.toString("base64");
  }

  return embedded;
};

const standaloneBootstrap = (embeddedModules) => `<script>
(function() {
  var AUTH_KEY = ${JSON.stringify(authStorageKey)};
  var BACKUP_KEY = ${JSON.stringify(authBackupKey)};
  var CACHE_KEY = ${JSON.stringify(standaloneAuthCacheKey)};

  function syncAuthBackup() {
    try {
      var current = window.localStorage.getItem(AUTH_KEY);
      var cached = window.localStorage.getItem(CACHE_KEY);
      if (current) {
        window.localStorage.setItem(CACHE_KEY, current);
        return;
      }
      if (!current && cached) {
        window.localStorage.setItem(AUTH_KEY, cached);
      }
    } catch (error) {}
  }

  var __backupCleared = false;
  window.__clearStandaloneAuthBackup = function() {
    __backupCleared = true;
    try { window.localStorage.removeItem(BACKUP_KEY); } catch (error) {}
    try { window.localStorage.removeItem(CACHE_KEY); } catch (error) {}
  };

  try {
    var localStorageProto = Object.getPrototypeOf(window.localStorage);
    if (localStorageProto && !localStorageProto.__copeAuthBackupPatched) {
      var originalSetItem = localStorageProto.setItem;
      var originalRemoveItem = localStorageProto.removeItem;

      localStorageProto.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (key === AUTH_KEY && value) {
          try { originalSetItem.call(this, CACHE_KEY, value); } catch (error) {}
        }
      };

      localStorageProto.removeItem = function(key) {
        if (key === AUTH_KEY) {
          if (__backupCleared) {
            originalRemoveItem.call(this, key);
            try { originalRemoveItem.call(this, CACHE_KEY); } catch (error) {}
            __backupCleared = false;
            return;
          }
          var cached = null;
          try { cached = this.getItem(CACHE_KEY); } catch (error) {}
          if (cached) {
            originalSetItem.call(this, AUTH_KEY, cached);
            return;
          }
        }
        originalRemoveItem.call(this, key);
      };

      Object.defineProperty(localStorageProto, "__copeAuthBackupPatched", {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
      });
    }
  } catch (error) {}

  syncAuthBackup();
  window.addEventListener("online", syncAuthBackup);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") syncAuthBackup();
  });
})();

function __b64ToUtf8(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

window.__EMBEDDED_MODULES = Object.fromEntries(
  Object.entries(${JSON.stringify(embeddedModules)}).map(function(entry) {
    return [entry[0], __b64ToUtf8(entry[1])];
  })
);

window.__injectStandaloneBootstrap = function(html, queryString) {
  var query = typeof queryString === "string" ? queryString : "";
  var normalizedQuery = query && query.charAt(0) !== "?" ? "?" + query : query;
  var moduleHtml = String(html || "").replace(
    /new URLSearchParams\(window\.location\.search\)/g,
    "new URLSearchParams(window.__STANDALONE_QUERY || window.location.search)"
  );

  var childBootstrap = "<script>\\n"
    + "window.__STANDALONE_QUERY = " + JSON.stringify(normalizedQuery) + ";\\n"
    + "window.__EMBEDDED_MODULES = (window.top && window.top.__EMBEDDED_MODULES) || window.__EMBEDDED_MODULES || {};\\n"
    + "window.__injectStandaloneBootstrap = (window.top && window.top.__injectStandaloneBootstrap) || window.__injectStandaloneBootstrap;\\n"
    + "(function() {\\n"
    + "  var iframeProto = HTMLIFrameElement.prototype;\\n"
    + "  var srcDesc = Object.getOwnPropertyDescriptor(iframeProto, 'src');\\n"
    + "  var origSetAttribute = iframeProto.setAttribute;\\n"
    + "  function resolveEmbedded(el, value) {\\n"
    + "    if (typeof value !== 'string' || !value) return null;\\n"
    + "    var cleanValue = value.trim();\\n"
    + "    if (!cleanValue || cleanValue.indexOf('blob:') === 0 || cleanValue.indexOf('data:') === 0 || cleanValue.indexOf('about:') === 0) return null;\\n"
    + "    var filePart = cleanValue.split('#')[0];\\n"
    + "    var filename = filePart.split('?')[0].split('/').pop();\\n"
    + "    var queryIndex = cleanValue.indexOf('?');\\n"
    + "    var query = queryIndex >= 0 ? cleanValue.slice(queryIndex) : '';\\n"
    + "    var htmlMap = (window.top && window.top.__EMBEDDED_MODULES) || window.__EMBEDDED_MODULES || {};\\n"
    + "    var raw = htmlMap[filename];\\n"
    + "    if (!raw || !window.__injectStandaloneBootstrap) return null;\\n"
    + "    var injected = window.__injectStandaloneBootstrap(raw, query);\\n"
    + "    var blob = new Blob([injected], { type: 'text/html;charset=utf-8' });\\n"
    + "    if (el.__standaloneBlobUrl) URL.revokeObjectURL(el.__standaloneBlobUrl);\\n"
    + "    el.__standaloneBlobUrl = URL.createObjectURL(blob);\\n"
    + "    return el.__standaloneBlobUrl;\\n"
    + "  }\\n"
    + "  iframeProto.setAttribute = function(name, value) {\\n"
    + "    if (name === 'src') {\\n"
    + "      var resolved = resolveEmbedded(this, String(value));\\n"
    + "      if (resolved && srcDesc && srcDesc.set) {\\n"
    + "        srcDesc.set.call(this, resolved);\\n"
    + "        return;\\n"
    + "      }\\n"
    + "    }\\n"
    + "    return origSetAttribute.call(this, name, value);\\n"
    + "  };\\n"
    + "  if (srcDesc && srcDesc.set && srcDesc.get) {\\n"
    + "    Object.defineProperty(iframeProto, 'src', {\\n"
    + "      configurable: true,\\n"
    + "      get: function() { return srcDesc.get.call(this); },\\n"
    + "      set: function(value) {\\n"
    + "        var resolved = resolveEmbedded(this, String(value));\\n"
    + "        if (resolved) {\\n"
    + "          srcDesc.set.call(this, resolved);\\n"
    + "          return;\\n"
    + "        }\\n"
    + "        srcDesc.set.call(this, value);\\n"
    + "      }\\n"
    + "    });\\n"
    + "  }\\n"
    + "})();\\n"
    + "<\\/script>";

  if (/<head[^>]*>/i.test(moduleHtml)) {
    return moduleHtml.replace(/<head([^>]*)>/i, "<head$1>" + childBootstrap);
  }

  return childBootstrap + moduleHtml;
};

(function() {
  var iframeProto = HTMLIFrameElement.prototype;
  var srcDesc = Object.getOwnPropertyDescriptor(iframeProto, "src");
  var origSetAttribute = iframeProto.setAttribute;

  function resolveEmbedded(el, value) {
    if (typeof value !== "string" || !value) return null;
    var cleanValue = value.trim();
    if (!cleanValue || cleanValue.indexOf("blob:") === 0 || cleanValue.indexOf("data:") === 0 || cleanValue.indexOf("about:") === 0) return null;
    var filePart = cleanValue.split("#")[0];
    var filename = filePart.split("?")[0].split("/").pop();
    var queryIndex = cleanValue.indexOf("?");
    var query = queryIndex >= 0 ? cleanValue.slice(queryIndex) : "";
    var raw = window.__EMBEDDED_MODULES[filename];
    if (!raw) return null;
    var injected = window.__injectStandaloneBootstrap(raw, query);
    var blob = new Blob([injected], { type: "text/html;charset=utf-8" });
    if (el.__standaloneBlobUrl) URL.revokeObjectURL(el.__standaloneBlobUrl);
    el.__standaloneBlobUrl = URL.createObjectURL(blob);
    return el.__standaloneBlobUrl;
  }

  iframeProto.setAttribute = function(name, value) {
    if (name === "src") {
      var resolved = resolveEmbedded(this, String(value));
      if (resolved && srcDesc && srcDesc.set) {
        srcDesc.set.call(this, resolved);
        return;
      }
    }
    return origSetAttribute.call(this, name, value);
  };

  if (srcDesc && srcDesc.set && srcDesc.get) {
    Object.defineProperty(iframeProto, "src", {
      configurable: true,
      get: function() { return srcDesc.get.call(this); },
      set: function(value) {
        var resolved = resolveEmbedded(this, String(value));
        if (resolved) {
          srcDesc.set.call(this, resolved);
          return;
        }
        srcDesc.set.call(this, value);
      },
    });
  }
})();
</script>`;

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const baseHtml = await fs.readFile(path.join(distDir, "index.html"), "utf8");
  const inlinedHtml = await inlineLocalAssets(baseHtml);
  const embeddedModules = await buildEmbeddedModules();
  const bootstrap = standaloneBootstrap(embeddedModules);
  const finalHtml = inlinedHtml.replace("</head>", `${bootstrap}\n</head>`);
  await fs.writeFile(outputPath, finalHtml, "utf8");
  console.log(outputPath);
};

await main();