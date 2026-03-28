#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../store/dist/property-store.js
var require_property_store = __commonJS({
  "../store/dist/property-store.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getProperties = getProperties3;
    exports2.getAllProperties = getAllProperties3;
    exports2.setProperties = setProperties2;
    exports2.isStale = isStale;
    exports2.removeProperties = removeProperties;
    var fs4 = __importStar(require("fs/promises"));
    var path6 = __importStar(require("path"));
    var crypto = __importStar(require("crypto"));
    var PROPERTIES_FILE = "properties.json";
    var FILE_VERSION = 1;
    function propertiesPath(storeDir) {
      return path6.join(storeDir, PROPERTIES_FILE);
    }
    async function readPropertiesFile(storeDir) {
      const filePath = propertiesPath(storeDir);
      try {
        const content = await fs4.readFile(filePath, "utf8");
        return JSON.parse(content);
      } catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
          return { version: FILE_VERSION, modules: {} };
        }
        throw new Error(`Failed to read properties file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    async function writePropertiesFile(storeDir, data) {
      const filePath = propertiesPath(storeDir);
      const tmpName = `.tmp-${crypto.randomBytes(8).toString("hex")}.json`;
      const tmpPath = path6.join(storeDir, tmpName);
      const content = JSON.stringify(data, null, 2);
      await fs4.writeFile(tmpPath, content, "utf8");
      await fs4.rename(tmpPath, filePath);
    }
    async function getProperties3(storeDir, module3) {
      const file = await readPropertiesFile(storeDir);
      return file.modules[module3] ?? null;
    }
    async function getAllProperties3(storeDir) {
      const file = await readPropertiesFile(storeDir);
      return Object.values(file.modules);
    }
    async function setProperties2(storeDir, module3, propertySet) {
      const file = await readPropertiesFile(storeDir);
      const updated = {
        ...file,
        modules: { ...file.modules, [module3]: propertySet }
      };
      await writePropertiesFile(storeDir, updated);
    }
    function isStale(propertySet, currentHash) {
      return propertySet.sourceHash !== currentHash;
    }
    async function removeProperties(storeDir, module3) {
      const file = await readPropertiesFile(storeDir);
      const { [module3]: _removed, ...remaining } = file.modules;
      const updated = {
        ...file,
        modules: remaining
      };
      await writePropertiesFile(storeDir, updated);
    }
  }
});

// ../store/dist/test-file-store.js
var require_test_file_store = __commonJS({
  "../store/dist/test-file-store.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.writeTestFile = writeTestFile;
    exports2.readTestFile = readTestFile;
    exports2.listTestFiles = listTestFiles;
    var fs4 = __importStar(require("fs/promises"));
    var path6 = __importStar(require("path"));
    var TESTS_DIR = "tests";
    function testsPath(storeDir) {
      return path6.join(storeDir, TESTS_DIR);
    }
    async function writeTestFile(storeDir, fileName, content) {
      const dir = testsPath(storeDir);
      await fs4.mkdir(dir, { recursive: true });
      const filePath = path6.join(dir, fileName);
      await fs4.writeFile(filePath, content, "utf8");
      return filePath;
    }
    async function readTestFile(storeDir, fileName) {
      const filePath = path6.join(testsPath(storeDir), fileName);
      return fs4.readFile(filePath, "utf8");
    }
    async function listTestFiles(storeDir) {
      const dir = testsPath(storeDir);
      try {
        const entries = await fs4.readdir(dir);
        return entries.filter((e) => e.endsWith(".ts") || e.endsWith(".js") || e.endsWith(".py"));
      } catch {
        return [];
      }
    }
  }
});

// ../store/dist/corpus-store.js
var require_corpus_store = __commonJS({
  "../store/dist/corpus-store.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getSeeds = getSeeds;
    exports2.addSeeds = addSeeds;
    var fs4 = __importStar(require("fs/promises"));
    var path6 = __importStar(require("path"));
    var CORPUS_DIR = "corpus";
    function corpusPath(storeDir, functionName) {
      const safeName = functionName.replace(/[^a-zA-Z0-9._-]/g, "_");
      return path6.join(storeDir, CORPUS_DIR, `${safeName}.json`);
    }
    async function getSeeds(storeDir, functionName) {
      const filePath = corpusPath(storeDir, functionName);
      try {
        const content = await fs4.readFile(filePath, "utf8");
        return JSON.parse(content);
      } catch {
        return [];
      }
    }
    async function addSeeds(storeDir, functionName, seeds) {
      const existing = await getSeeds(storeDir, functionName);
      const existingKeys = new Set(existing.map((s) => JSON.stringify(s.value)));
      const newSeeds = seeds.filter((s) => !existingKeys.has(JSON.stringify(s.value)));
      const merged = [...existing, ...newSeeds];
      const dir = path6.join(storeDir, CORPUS_DIR);
      await fs4.mkdir(dir, { recursive: true });
      await fs4.writeFile(corpusPath(storeDir, functionName), JSON.stringify(merged, null, 2), "utf8");
    }
  }
});

// ../store/dist/init.js
var require_init = __commonJS({
  "../store/dist/init.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.initStore = initStore3;
    var fs4 = __importStar(require("fs/promises"));
    var path6 = __importStar(require("path"));
    var SUBDIRS = ["tests", "corpus", "reports"];
    async function initStore3(projectRoot, storeDir = ".propcheck") {
      const storePath = path6.join(projectRoot, storeDir);
      try {
        const stat2 = await fs4.stat(storePath);
        if (stat2.isDirectory()) {
          for (const sub of SUBDIRS) {
            await fs4.mkdir(path6.join(storePath, sub), { recursive: true });
          }
          return { created: false, path: storePath };
        }
      } catch {
      }
      await fs4.mkdir(storePath, { recursive: true });
      for (const sub of SUBDIRS) {
        await fs4.mkdir(path6.join(storePath, sub), { recursive: true });
      }
      const propertiesPath = path6.join(storePath, "properties.json");
      await fs4.writeFile(propertiesPath, JSON.stringify({ version: 1, modules: {} }, null, 2), "utf8");
      return { created: true, path: storePath };
    }
  }
});

// ../store/dist/index.js
var require_dist = __commonJS({
  "../store/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.initStore = exports2.addSeeds = exports2.getSeeds = exports2.listTestFiles = exports2.readTestFile = exports2.writeTestFile = exports2.removeProperties = exports2.isStale = exports2.setProperties = exports2.getAllProperties = exports2.getProperties = void 0;
    var property_store_1 = require_property_store();
    Object.defineProperty(exports2, "getProperties", { enumerable: true, get: function() {
      return property_store_1.getProperties;
    } });
    Object.defineProperty(exports2, "getAllProperties", { enumerable: true, get: function() {
      return property_store_1.getAllProperties;
    } });
    Object.defineProperty(exports2, "setProperties", { enumerable: true, get: function() {
      return property_store_1.setProperties;
    } });
    Object.defineProperty(exports2, "isStale", { enumerable: true, get: function() {
      return property_store_1.isStale;
    } });
    Object.defineProperty(exports2, "removeProperties", { enumerable: true, get: function() {
      return property_store_1.removeProperties;
    } });
    var test_file_store_1 = require_test_file_store();
    Object.defineProperty(exports2, "writeTestFile", { enumerable: true, get: function() {
      return test_file_store_1.writeTestFile;
    } });
    Object.defineProperty(exports2, "readTestFile", { enumerable: true, get: function() {
      return test_file_store_1.readTestFile;
    } });
    Object.defineProperty(exports2, "listTestFiles", { enumerable: true, get: function() {
      return test_file_store_1.listTestFiles;
    } });
    var corpus_store_1 = require_corpus_store();
    Object.defineProperty(exports2, "getSeeds", { enumerable: true, get: function() {
      return corpus_store_1.getSeeds;
    } });
    Object.defineProperty(exports2, "addSeeds", { enumerable: true, get: function() {
      return corpus_store_1.addSeeds;
    } });
    var init_1 = require_init();
    Object.defineProperty(exports2, "initStore", { enumerable: true, get: function() {
      return init_1.initStore;
    } });
  }
});

// ../config/dist/defaults.js
var require_defaults = __commonJS({
  "../config/dist/defaults.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULTS = void 0;
    exports2.DEFAULTS = {
      apiKey: null,
      model: "claude-sonnet-4-20250514",
      maxPropertiesPerFunction: 5,
      minScore: 10,
      defaultMode: "default",
      timeout: 3e4,
      languages: ["typescript", "javascript"],
      storeDir: ".propcheck",
      mock: false
    };
  }
});

// ../config/dist/loader.js
var require_loader = __commonJS({
  "../config/dist/loader.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.loadConfig = loadConfig5;
    exports2.validateConfig = validateConfig2;
    var fs4 = __importStar(require("fs"));
    var path6 = __importStar(require("path"));
    var zod_1 = require("zod");
    var defaults_1 = require_defaults();
    var PropcheckRcSchema = zod_1.z.object({
      apiKey: zod_1.z.string().optional(),
      model: zod_1.z.string().optional(),
      maxPropertiesPerFunction: zod_1.z.number().int().min(1).max(20).optional(),
      minScore: zod_1.z.number().int().min(0).max(15).optional(),
      defaultMode: zod_1.z.enum(["quick", "default", "thorough"]).optional(),
      timeout: zod_1.z.number().int().min(1e3).max(3e5).optional(),
      storeDir: zod_1.z.string().regex(/^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/, "storeDir must be a relative path without traversal").optional(),
      mock: zod_1.z.boolean().optional()
    }).strict();
    function loadConfig5(projectRoot, overrides = {}) {
      let config = { ...defaults_1.DEFAULTS };
      const rcPath = path6.join(projectRoot, ".propcheckrc");
      if (fs4.existsSync(rcPath)) {
        try {
          const rcContent = fs4.readFileSync(rcPath, "utf8");
          const rawJson = JSON.parse(rcContent);
          const parsed = PropcheckRcSchema.safeParse(rawJson);
          if (parsed.success) {
            config = { ...config, ...parsed.data };
          } else {
            console.warn(`  Warning: .propcheckrc has invalid entries (using defaults): ${parsed.error.issues.map((i) => i.message).join(", ")}`);
          }
        } catch (err) {
          console.warn(`  Warning: Failed to parse .propcheckrc (using defaults): ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const envApiKey = process.env["ANTHROPIC_API_KEY"];
      const envMock = process.env["PROPCHECK_MOCK"];
      if (envApiKey) {
        config = { ...config, apiKey: envApiKey };
      }
      if (envMock === "true" || envMock === "1") {
        config = { ...config, mock: true };
      }
      if (overrides.apiKey !== void 0) {
        config = { ...config, apiKey: overrides.apiKey };
      }
      if (overrides.model !== void 0) {
        config = { ...config, model: overrides.model };
      }
      if (overrides.mock !== void 0) {
        config = { ...config, mock: overrides.mock };
      }
      if (overrides.mode !== void 0) {
        config = { ...config, defaultMode: overrides.mode };
      }
      return Object.freeze(config);
    }
    function validateConfig2(config, command) {
      const errors = [];
      if (command === "infer" && !config.mock && !config.apiKey) {
        errors.push("ANTHROPIC_API_KEY is required for property inference.\nSet it via: export ANTHROPIC_API_KEY=sk-ant-...\nOr use --mock for offline testing with canned responses.");
      }
      return errors;
    }
  }
});

// ../config/dist/index.js
var require_dist2 = __commonJS({
  "../config/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULTS = exports2.validateConfig = exports2.loadConfig = void 0;
    var loader_1 = require_loader();
    Object.defineProperty(exports2, "loadConfig", { enumerable: true, get: function() {
      return loader_1.loadConfig;
    } });
    Object.defineProperty(exports2, "validateConfig", { enumerable: true, get: function() {
      return loader_1.validateConfig;
    } });
    var defaults_1 = require_defaults();
    Object.defineProperty(exports2, "DEFAULTS", { enumerable: true, get: function() {
      return defaults_1.DEFAULTS;
    } });
  }
});

// ../parser/dist/languages/typescript.js
var require_typescript = __commonJS({
  "../parser/dist/languages/typescript.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.analyzeFile = analyzeFile2;
    exports2.detectLanguage = detectLanguage2;
    var ts = __importStar(require("typescript"));
    function getLocation(node, sourceFile) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      return {
        startLine: start.line + 1,
        endLine: end.line + 1,
        startColumn: start.character,
        endColumn: end.character
      };
    }
    function getJsDocComment(node, sourceFile) {
      const jsDocs = node.jsDoc;
      if (!jsDocs || jsDocs.length === 0)
        return null;
      const doc = jsDocs[jsDocs.length - 1];
      if (!doc.comment)
        return null;
      const docEnd = sourceFile.getLineAndCharacterOfPosition(doc.getEnd());
      const nodeStart = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      if (nodeStart.line - docEnd.line > 2)
        return null;
      return String(doc.comment);
    }
    function extractJsDocTags(node, sourceFile) {
      const paramDocs = {};
      let returnDoc = null;
      const throws = [];
      const examples = [];
      const jsDocs = node.jsDoc;
      if (!jsDocs || jsDocs.length === 0) {
        return { paramDocs, returnDoc, throws, examples };
      }
      const doc = jsDocs[jsDocs.length - 1];
      const docEnd = sourceFile.getLineAndCharacterOfPosition(doc.getEnd());
      const nodeStart = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      if (nodeStart.line - docEnd.line > 2) {
        return { paramDocs, returnDoc, throws, examples };
      }
      if (doc.tags) {
        for (const tag of doc.tags) {
          const tagText = tag.comment ? String(tag.comment) : "";
          if (ts.isJSDocParameterTag(tag) && tag.name) {
            const paramName = tag.name.getText(sourceFile);
            paramDocs[paramName] = tagText;
          } else if (ts.isJSDocReturnTag(tag)) {
            returnDoc = tagText;
          } else if (tag.tagName.getText(sourceFile) === "throws" || tag.tagName.getText(sourceFile) === "exception") {
            throws.push(tagText);
          } else if (tag.tagName.getText(sourceFile) === "example") {
            examples.push(tagText);
          }
        }
      }
      return { paramDocs, returnDoc, throws, examples };
    }
    function isExported(node) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : void 0;
      if (!modifiers)
        return false;
      return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    }
    function extractParamInfo(param, checker, sourceFile) {
      const name = param.name.getText(sourceFile);
      let type = null;
      if (param.type) {
        type = param.type.getText(sourceFile);
      } else if (checker) {
        const symbol = checker.getSymbolAtLocation(param.name);
        if (symbol) {
          const t = checker.getTypeOfSymbolAtLocation(symbol, param);
          type = checker.typeToString(t);
        }
      }
      return {
        name,
        type,
        defaultValue: param.initializer ? param.initializer.getText(sourceFile) : null,
        isOptional: !!param.questionToken || !!param.initializer,
        isRest: !!param.dotDotDotToken
      };
    }
    function extractFunction(node, sourceFile, checker, className) {
      let name;
      if (ts.isFunctionDeclaration(node)) {
        if (!node.name)
          return null;
        name = node.name.getText(sourceFile);
      } else if (ts.isMethodDeclaration(node)) {
        name = node.name.getText(sourceFile);
      } else {
        const parent = node.parent;
        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
          name = parent.name.getText(sourceFile);
        } else {
          return null;
        }
      }
      const qualifiedName = className ? `${className}.${name}` : name;
      const parameters = node.parameters.map((p) => extractParamInfo(p, checker, sourceFile));
      let returnType = null;
      if (node.type) {
        returnType = node.type.getText(sourceFile);
      }
      const docstring = getJsDocComment(ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) ? node.parent.parent?.parent ?? node : node, sourceFile);
      let exported = false;
      if (ts.isFunctionDeclaration(node)) {
        exported = isExported(node);
      } else if (ts.isArrowFunction(node)) {
        const varStmt = node.parent?.parent?.parent;
        if (varStmt && ts.isVariableStatement(varStmt)) {
          exported = isExported(varStmt);
        }
      } else if (ts.isMethodDeclaration(node) && className) {
        exported = true;
      }
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : void 0;
      const isAsync = modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
      const isGenerator = !!node.asteriskToken;
      return {
        name,
        qualifiedName,
        parameters,
        returnType,
        docstring,
        visibility: exported ? "public" : "private",
        isAsync,
        isGenerator,
        loc: getLocation(node, sourceFile)
      };
    }
    function extractTypeDefinitions(sourceFile) {
      const types = [];
      function visit(node) {
        if (ts.isInterfaceDeclaration(node)) {
          const properties = node.members.filter(ts.isPropertySignature).map((member) => ({
            name: member.name.getText(sourceFile),
            type: member.type ? member.type.getText(sourceFile) : "unknown",
            isOptional: !!member.questionToken,
            isReadonly: member.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false
          }));
          types.push({
            name: node.name.getText(sourceFile),
            kind: "interface",
            properties,
            loc: getLocation(node, sourceFile)
          });
        }
        if (ts.isTypeAliasDeclaration(node)) {
          types.push({
            name: node.name.getText(sourceFile),
            kind: "type",
            properties: [],
            loc: getLocation(node, sourceFile)
          });
        }
        if (ts.isEnumDeclaration(node)) {
          const properties = node.members.map((member) => ({
            name: member.name.getText(sourceFile),
            type: member.initializer ? member.initializer.getText(sourceFile) : "number",
            isOptional: false,
            isReadonly: true
          }));
          types.push({
            name: node.name.getText(sourceFile),
            kind: "enum",
            properties,
            loc: getLocation(node, sourceFile)
          });
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
      return types;
    }
    function extractImports(sourceFile) {
      const imports = [];
      for (const stmt of sourceFile.statements) {
        if (!ts.isImportDeclaration(stmt))
          continue;
        const source = stmt.moduleSpecifier.text;
        const clause = stmt.importClause;
        if (!clause) {
          imports.push({ source, specifiers: [], isDefault: false, isNamespace: false });
          continue;
        }
        const specifiers = [];
        let isDefault = false;
        let isNamespace = false;
        if (clause.name) {
          specifiers.push(clause.name.getText(sourceFile));
          isDefault = true;
        }
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            specifiers.push(clause.namedBindings.name.getText(sourceFile));
            isNamespace = true;
          } else {
            for (const element of clause.namedBindings.elements) {
              specifiers.push(element.name.getText(sourceFile));
            }
          }
        }
        imports.push({ source, specifiers, isDefault, isNamespace });
      }
      return imports;
    }
    function analyzeFile2(filePath, source, language) {
      const isTS = language === "typescript";
      const scriptKind = isTS ? ts.ScriptKind.TS : ts.ScriptKind.JS;
      const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
      const functions = [];
      const funcJsDocTags = /* @__PURE__ */ new Map();
      function visitFunctions(node, className) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          const fn = extractFunction(node, sourceFile, null, className);
          if (fn) {
            functions.push(fn);
            funcJsDocTags.set(fn.qualifiedName, extractJsDocTags(node, sourceFile));
          }
        }
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
              const fn = extractFunction(decl.initializer, sourceFile, null);
              if (fn) {
                const exported = isExported(node);
                const fnWithVis = { ...fn, visibility: exported ? "public" : "private" };
                functions.push(fnWithVis);
                const tagNode = decl.initializer.parent?.parent?.parent ?? decl.initializer;
                funcJsDocTags.set(fnWithVis.qualifiedName, extractJsDocTags(tagNode, sourceFile));
              }
            }
          }
        }
        if (ts.isClassDeclaration(node) && node.name) {
          const cn = node.name.getText(sourceFile);
          for (const member of node.members) {
            if (ts.isMethodDeclaration(member)) {
              const fn = extractFunction(member, sourceFile, null, cn);
              if (fn) {
                functions.push(fn);
                funcJsDocTags.set(fn.qualifiedName, extractJsDocTags(member, sourceFile));
              }
            }
          }
        }
        ts.forEachChild(node, (child) => visitFunctions(child, className));
      }
      visitFunctions(sourceFile);
      const types = extractTypeDefinitions(sourceFile);
      const imports = extractImports(sourceFile);
      const typeSignals = functions.map((fn) => ({
        functionName: fn.qualifiedName,
        paramTypes: fn.parameters.map((p) => p.type ?? "unknown"),
        returnType: fn.returnType
      }));
      const docSignals = functions.filter((fn) => fn.docstring).map((fn) => {
        const tags = funcJsDocTags.get(fn.qualifiedName) ?? {
          paramDocs: {},
          returnDoc: null,
          throws: [],
          examples: []
        };
        return {
          functionName: fn.qualifiedName,
          description: fn.docstring ?? "",
          paramDocs: tags.paramDocs,
          returnDoc: tags.returnDoc,
          throws: tags.throws,
          examples: tags.examples
        };
      });
      const astSignals = functions.map((fn) => ({
        kind: fn.isAsync ? "async_function" : "function",
        detail: fn.qualifiedName
      }));
      return {
        filePath,
        language,
        sourceCode: source,
        functions,
        types,
        imports,
        signals: {
          ast: astSignals,
          type: typeSignals,
          doc: docSignals
        }
      };
    }
    function detectLanguage2(filePath) {
      if (filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
        return "typescript";
      if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".mjs"))
        return "javascript";
      if (filePath.endsWith(".py"))
        return "python";
      if (filePath.endsWith(".rs"))
        return "rust";
      return null;
    }
  }
});

// ../parser/dist/languages/python.js
var require_python = __commonJS({
  "../parser/dist/languages/python.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.analyzePythonFile = analyzePythonFile2;
    var FUNC_REGEX_SOURCE = /^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/;
    var PARAM_REGEX = /(\*{0,2})(\w+)\s*(?::\s*([^=,]+?))?\s*(?:=\s*([^,]+))?\s*$/;
    function parseParameter(raw) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === "self" || trimmed === "cls")
        return null;
      const match = trimmed.match(PARAM_REGEX);
      if (!match)
        return null;
      const [, stars, name, typeHint, defaultValue] = match;
      return {
        name,
        type: typeHint?.trim() ?? null,
        defaultValue: defaultValue?.trim() ?? null,
        isOptional: !!defaultValue,
        isRest: stars === "*" || stars === "**"
      };
    }
    function extractDocstring(source, funcEndIndex) {
      const remaining = source.slice(funcEndIndex);
      const lines = remaining.split("\n");
      let docStart = -1;
      for (let i = 0; i < lines.length && i < 5; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
          docStart = i;
          break;
        }
        if (trimmed.length > 0 && !trimmed.startsWith("#") && i > 0) {
          break;
        }
      }
      if (docStart === -1)
        return null;
      const quote = lines[docStart].trim().startsWith('"""') ? '"""' : "'''";
      let docLines = [];
      let found = false;
      for (let i = docStart; i < lines.length; i++) {
        docLines.push(lines[i]);
        if (i === docStart) {
          const afterOpen = lines[i].trim().slice(3);
          if (afterOpen.includes(quote)) {
            found = true;
            break;
          }
        } else if (lines[i].includes(quote)) {
          found = true;
          break;
        }
      }
      if (!found)
        return null;
      const raw = docLines.join("\n");
      return raw.replace(/^\s*["']{3}/, "").replace(/["']{3}\s*$/, "").trim();
    }
    function analyzePythonFile2(filePath, source) {
      const functions = [];
      const lines = source.split("\n");
      const funcRegex = new RegExp(FUNC_REGEX_SOURCE.source, "gm");
      let match;
      while ((match = funcRegex.exec(source)) !== null) {
        const [fullMatch, indent, asyncKw, name, rawParams, returnType] = match;
        const isTopLevel = indent.length === 0;
        const isAsync = !!asyncKw;
        const paramStrings = rawParams.split(",").filter((s) => s.trim().length > 0);
        const parameters = [];
        for (const ps of paramStrings) {
          const param = parseParameter(ps);
          if (param)
            parameters.push(param);
        }
        const beforeMatch = source.slice(0, match.index);
        const startLine = beforeMatch.split("\n").length;
        const endLine = startLine + fullMatch.split("\n").length - 1;
        const funcEndIndex = match.index + fullMatch.length;
        const docstring = extractDocstring(source, funcEndIndex);
        let visibility = "public";
        if (name.startsWith("__") && !name.endsWith("__")) {
          visibility = "internal";
        } else if (name.startsWith("_")) {
          visibility = "private";
        }
        functions.push({
          name,
          qualifiedName: name,
          parameters,
          returnType: returnType?.trim() ?? null,
          docstring,
          visibility,
          isAsync,
          isGenerator: false,
          // TODO: detect yield
          loc: {
            startLine,
            endLine,
            startColumn: indent.length,
            endColumn: 0
          }
        });
      }
      const imports = [];
      const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
      let importMatch;
      importRegex.lastIndex = 0;
      while ((importMatch = importRegex.exec(source)) !== null) {
        const [, fromModule, specifiers] = importMatch;
        const specs = specifiers.split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
        imports.push({
          source: fromModule ?? specs[0],
          specifiers: specs,
          isDefault: !fromModule,
          isNamespace: specifiers.trim() === "*"
        });
      }
      const typeSignals = functions.map((fn) => ({
        functionName: fn.qualifiedName,
        paramTypes: fn.parameters.map((p) => p.type ?? "unknown"),
        returnType: fn.returnType
      }));
      const docSignals = functions.filter((fn) => fn.docstring).map((fn) => ({
        functionName: fn.qualifiedName,
        description: fn.docstring ?? "",
        paramDocs: {},
        returnDoc: null,
        throws: [],
        examples: []
      }));
      return {
        filePath,
        language: "python",
        sourceCode: source,
        functions,
        types: [],
        imports,
        signals: {
          ast: functions.map((fn) => ({
            kind: fn.isAsync ? "async_function" : "function",
            detail: fn.qualifiedName
          })),
          type: typeSignals,
          doc: docSignals
        }
      };
    }
  }
});

// ../parser/dist/index.js
var require_dist3 = __commonJS({
  "../parser/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.analyzePythonFile = exports2.detectLanguage = exports2.analyzeFile = void 0;
    var typescript_1 = require_typescript();
    Object.defineProperty(exports2, "analyzeFile", { enumerable: true, get: function() {
      return typescript_1.analyzeFile;
    } });
    Object.defineProperty(exports2, "detectLanguage", { enumerable: true, get: function() {
      return typescript_1.detectLanguage;
    } });
    var python_1 = require_python();
    Object.defineProperty(exports2, "analyzePythonFile", { enumerable: true, get: function() {
      return python_1.analyzePythonFile;
    } });
  }
});

// ../common/dist/types/execution.js
var require_execution = __commonJS({
  "../common/dist/types/execution.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.RUN_MODE_ITERATIONS = void 0;
    exports2.RUN_MODE_ITERATIONS = {
      quick: 100,
      default: 1e3,
      thorough: 1e4
    };
  }
});

// ../common/dist/types/config.js
var require_config = __commonJS({
  "../common/dist/types/config.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULT_CONFIG = void 0;
    exports2.DEFAULT_CONFIG = {
      apiKey: null,
      model: "claude-sonnet-4-20250514",
      maxPropertiesPerFunction: 5,
      minScore: 10,
      defaultMode: "default",
      timeout: 3e4,
      languages: ["typescript", "javascript"],
      storeDir: ".propcheck",
      mock: false
    };
  }
});

// ../common/dist/errors/base.js
var require_base = __commonJS({
  "../common/dist/errors/base.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.PropcheckError = void 0;
    var PropcheckError = class _PropcheckError extends Error {
      code;
      context;
      constructor(message, code, context = {}) {
        super(message);
        this.name = "PropcheckError";
        this.code = code;
        this.context = Object.freeze({ ...context });
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, _PropcheckError);
        }
      }
    };
    exports2.PropcheckError = PropcheckError;
  }
});

// ../common/dist/errors/parse-error.js
var require_parse_error = __commonJS({
  "../common/dist/errors/parse-error.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ParseError = void 0;
    var base_1 = require_base();
    var ParseError = class extends base_1.PropcheckError {
      constructor(message, context = {}) {
        super(message, "PARSE_ERROR", context);
        this.name = "ParseError";
      }
    };
    exports2.ParseError = ParseError;
  }
});

// ../common/dist/errors/llm-error.js
var require_llm_error = __commonJS({
  "../common/dist/errors/llm-error.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.LlmError = void 0;
    var base_1 = require_base();
    var LlmError = class extends base_1.PropcheckError {
      constructor(message, context = {}) {
        super(message, "LLM_ERROR", context);
        this.name = "LlmError";
      }
    };
    exports2.LlmError = LlmError;
  }
});

// ../common/dist/errors/engine-error.js
var require_engine_error = __commonJS({
  "../common/dist/errors/engine-error.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.EngineError = void 0;
    var base_1 = require_base();
    var EngineError = class extends base_1.PropcheckError {
      constructor(message, context = {}) {
        super(message, "ENGINE_ERROR", context);
        this.name = "EngineError";
      }
    };
    exports2.EngineError = EngineError;
  }
});

// ../common/dist/utils/hash.js
var require_hash = __commonJS({
  "../common/dist/utils/hash.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.hashContent = hashContent3;
    var node_crypto_1 = require("crypto");
    function hashContent3(content) {
      return (0, node_crypto_1.createHash)("sha256").update(content, "utf8").digest("hex");
    }
  }
});

// ../common/dist/utils/path.js
var require_path = __commonJS({
  "../common/dist/utils/path.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.toForwardSlash = toForwardSlash4;
    exports2.resolveForward = resolveForward;
    exports2.relativeForward = relativeForward;
    exports2.importPath = importPath;
    var path6 = __importStar(require("path"));
    function toForwardSlash4(filePath) {
      return filePath.replace(/\\/g, "/");
    }
    function resolveForward(...segments) {
      return toForwardSlash4(path6.resolve(...segments));
    }
    function relativeForward(from, to) {
      const rel = path6.relative(from, to);
      return toForwardSlash4(rel);
    }
    function importPath(fromFile, toFile) {
      const fromDir = path6.dirname(fromFile);
      let rel = relativeForward(fromDir, toFile);
      rel = rel.replace(/\.(ts|tsx|js|jsx|mts|mjs)$/, "");
      if (!rel.startsWith(".")) {
        rel = "./" + rel;
      }
      return rel;
    }
  }
});

// ../common/dist/utils/git.js
var require_git = __commonJS({
  "../common/dist/utils/git.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getChangedFiles = getChangedFiles2;
    exports2.getChangedFunctions = getChangedFunctions;
    var node_child_process_1 = require("child_process");
    function getChangedFiles2(cwd) {
      let diffOutput;
      try {
        diffOutput = (0, node_child_process_1.execSync)("git diff HEAD --unified=0 --diff-filter=ACMR --name-only", {
          cwd,
          encoding: "utf8",
          timeout: 1e4
        });
      } catch {
        return [];
      }
      const files = diffOutput.trim().split("\n").filter(Boolean);
      const result = [];
      for (const filePath of files) {
        let fileDiff;
        try {
          const diffResult = (0, node_child_process_1.spawnSync)("git", ["diff", "HEAD", "--unified=0", "--", filePath], { cwd, encoding: "utf8", timeout: 1e4 });
          if (diffResult.status !== 0) {
            result.push({ filePath, changedLines: [] });
            continue;
          }
          fileDiff = diffResult.stdout;
        } catch {
          result.push({ filePath, changedLines: [] });
          continue;
        }
        const changedLines = [];
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
        let match;
        while ((match = hunkRegex.exec(fileDiff)) !== null) {
          const start = parseInt(match[1], 10);
          const count = match[2] ? parseInt(match[2], 10) : 1;
          changedLines.push({ start, end: start + count - 1 });
        }
        result.push({ filePath, changedLines });
      }
      return result;
    }
    function getChangedFunctions(functions, changedLines) {
      if (changedLines.length === 0) {
        return functions;
      }
      return functions.filter((fn) => changedLines.some((range) => range.start <= fn.loc.endLine && range.end >= fn.loc.startLine));
    }
  }
});

// ../common/dist/utils/assertion-sanitizer.js
var require_assertion_sanitizer = __commonJS({
  "../common/dist/utils/assertion-sanitizer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateAssertion = validateAssertion;
    exports2.validateGeneratorKey = validateGeneratorKey;
    var DANGEROUS_PATTERNS = [
      /\brequire\s*\(/,
      // Node.js require
      /\bimport\s*\(/,
      // Dynamic import
      /\bprocess\b/,
      // process object access
      /\beval\s*\(/,
      // eval()
      /\bFunction\s*\(/,
      // Function constructor
      /\b__dirname\b/,
      // Directory access
      /\b__filename\b/,
      // File access
      /\bglobal\b/,
      // Global object
      /\bglobalThis\b/,
      // GlobalThis
      /\bchild_process\b/,
      // Child process module
      /\bexecSync\b/,
      // Synchronous exec
      /\bspawnSync\b/,
      // Synchronous spawn
      /`/,
      // Template literals (can execute expressions)
      /\bfs\b\s*\./,
      // File system access
      /\bnet\b\s*\./,
      // Network access
      /\bhttp\b\s*\./,
      // HTTP access
      /\bos\b\s*\./,
      // OS module access
      /\bnew\s+Function\b/,
      // new Function()
      /;\s*\w/
      // Statement separator followed by identifier (multi-statement)
    ];
    var MAX_ASSERTION_LENGTH = 500;
    function validateAssertion(assertion) {
      if (!assertion || assertion.trim().length === 0) {
        return { valid: false, reason: "Assertion is empty" };
      }
      if (assertion.length > MAX_ASSERTION_LENGTH) {
        return { valid: false, reason: `Assertion too long (${assertion.length} chars, max ${MAX_ASSERTION_LENGTH})` };
      }
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(assertion)) {
          return { valid: false, reason: `Assertion contains disallowed pattern: ${pattern.source}` };
        }
      }
      return { valid: true };
    }
    function validateGeneratorKey(key) {
      return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
    }
  }
});

// ../common/dist/index.js
var require_dist4 = __commonJS({
  "../common/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateGeneratorKey = exports2.validateAssertion = exports2.getChangedFunctions = exports2.getChangedFiles = exports2.importPath = exports2.relativeForward = exports2.resolveForward = exports2.toForwardSlash = exports2.hashContent = exports2.EngineError = exports2.LlmError = exports2.ParseError = exports2.PropcheckError = exports2.DEFAULT_CONFIG = exports2.RUN_MODE_ITERATIONS = void 0;
    var execution_1 = require_execution();
    Object.defineProperty(exports2, "RUN_MODE_ITERATIONS", { enumerable: true, get: function() {
      return execution_1.RUN_MODE_ITERATIONS;
    } });
    var config_1 = require_config();
    Object.defineProperty(exports2, "DEFAULT_CONFIG", { enumerable: true, get: function() {
      return config_1.DEFAULT_CONFIG;
    } });
    var base_1 = require_base();
    Object.defineProperty(exports2, "PropcheckError", { enumerable: true, get: function() {
      return base_1.PropcheckError;
    } });
    var parse_error_1 = require_parse_error();
    Object.defineProperty(exports2, "ParseError", { enumerable: true, get: function() {
      return parse_error_1.ParseError;
    } });
    var llm_error_1 = require_llm_error();
    Object.defineProperty(exports2, "LlmError", { enumerable: true, get: function() {
      return llm_error_1.LlmError;
    } });
    var engine_error_1 = require_engine_error();
    Object.defineProperty(exports2, "EngineError", { enumerable: true, get: function() {
      return engine_error_1.EngineError;
    } });
    var hash_1 = require_hash();
    Object.defineProperty(exports2, "hashContent", { enumerable: true, get: function() {
      return hash_1.hashContent;
    } });
    var path_1 = require_path();
    Object.defineProperty(exports2, "toForwardSlash", { enumerable: true, get: function() {
      return path_1.toForwardSlash;
    } });
    Object.defineProperty(exports2, "resolveForward", { enumerable: true, get: function() {
      return path_1.resolveForward;
    } });
    Object.defineProperty(exports2, "relativeForward", { enumerable: true, get: function() {
      return path_1.relativeForward;
    } });
    Object.defineProperty(exports2, "importPath", { enumerable: true, get: function() {
      return path_1.importPath;
    } });
    var git_1 = require_git();
    Object.defineProperty(exports2, "getChangedFiles", { enumerable: true, get: function() {
      return git_1.getChangedFiles;
    } });
    Object.defineProperty(exports2, "getChangedFunctions", { enumerable: true, get: function() {
      return git_1.getChangedFunctions;
    } });
    var assertion_sanitizer_1 = require_assertion_sanitizer();
    Object.defineProperty(exports2, "validateAssertion", { enumerable: true, get: function() {
      return assertion_sanitizer_1.validateAssertion;
    } });
    Object.defineProperty(exports2, "validateGeneratorKey", { enumerable: true, get: function() {
      return assertion_sanitizer_1.validateGeneratorKey;
    } });
  }
});

// ../llm/dist/client.js
var require_client = __commonJS({
  "../llm/dist/client.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createLlmClient = createLlmClient2;
    var sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
    var common_1 = require_dist4();
    var RETRY_DELAYS = [1e3, 2e3, 4e3];
    function createLlmClient2(apiKey, model) {
      const client = new sdk_1.default({ apiKey });
      return {
        async call(systemPrompt, userPrompt, tools, options = {}) {
          const maxTokens = options.maxTokens ?? 4096;
          const temperature = options.temperature ?? 0.2;
          let lastError;
          for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
            try {
              const response = await client.messages.create({
                model,
                max_tokens: maxTokens,
                temperature,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
                tools,
                tool_choice: tools.length > 0 ? { type: "tool", name: tools[0].name } : void 0
              });
              const toolUse = response.content.find((block) => block.type === "tool_use");
              return {
                content: toolUse?.input ?? null,
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                model: response.model
              };
            } catch (err) {
              lastError = err;
              if (err instanceof sdk_1.default.AuthenticationError) {
                throw new common_1.LlmError("Invalid API key", {
                  code: "AUTH_ERROR",
                  status: 401
                });
              }
              const isRetryable = err instanceof sdk_1.default.RateLimitError || err instanceof sdk_1.default.InternalServerError;
              if (isRetryable && attempt < RETRY_DELAYS.length) {
                await sleep(RETRY_DELAYS[attempt]);
                continue;
              }
              break;
            }
          }
          throw new common_1.LlmError(`API call failed after ${RETRY_DELAYS.length + 1} attempts: ${String(lastError)}`, { attempts: RETRY_DELAYS.length + 1 });
        }
      };
    }
    function sleep(ms) {
      return new Promise((resolve4) => setTimeout(resolve4, ms));
    }
  }
});

// ../llm/dist/mock-client.js
var require_mock_client = __commonJS({
  "../llm/dist/mock-client.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createMockClient = createMockClient2;
    var FUNCTION_PROPERTIES = {
      // ═══════════════════════════════════════
      // cart-buggy.ts
      // ═══════════════════════════════════════
      applyDiscount: [
        {
          targetFunction: "applyDiscount",
          description: "Discounted price should be non-negative for valid inputs",
          category: "boundary",
          assertion: "applyDiscount(price, discount) >= 0",
          generators: {
            price: { type: "float", constraints: { min: 0, max: 1e4 } },
            discount: { type: "float", constraints: { min: 0, max: 200 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 100, discount: 20 } },
            { label: "boundary", value: { price: 0, discount: 100 } },
            { label: "extreme", value: { price: 0.01, discount: 150 } }
          ],
          evidence: "@param discount - Discount percentage (0-100); prices should not go negative",
          confidence: 0.92
        },
        {
          targetFunction: "applyDiscount",
          description: "Discount should not increase the price when discount is positive",
          category: "monotonic",
          assertion: "discount >= 0 ? applyDiscount(price, discount) <= price : true",
          generators: {
            price: { type: "float", constraints: { min: 0, max: 1e4 } },
            discount: { type: "float", constraints: { min: -50, max: 200 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 100, discount: 25 } },
            { label: "boundary", value: { price: 100, discount: 0 } },
            { label: "extreme", value: { price: 1, discount: 200 } }
          ],
          evidence: "Discount reduces price; @param discount - Discount percentage (0-100)",
          confidence: 0.88
        },
        {
          targetFunction: "applyDiscount",
          description: "Zero discount returns original price unchanged",
          category: "boundary",
          assertion: "applyDiscount(price, 0) === price",
          generators: {
            price: { type: "float", constraints: { min: 0, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 49.99 } },
            { label: "boundary", value: { price: 0 } },
            { label: "extreme", value: { price: 99999.99 } }
          ],
          evidence: "Zero discount means no change to price",
          confidence: 0.98
        },
        {
          targetFunction: "applyDiscount",
          description: "100% discount results in zero price",
          category: "boundary",
          assertion: "applyDiscount(price, 100) === 0",
          generators: {
            price: { type: "float", constraints: { min: 0, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 50 } },
            { label: "boundary", value: { price: 0 } },
            { label: "extreme", value: { price: 1e-3 } }
          ],
          evidence: "100% discount = free; price * (1 - 100/100) = 0",
          confidence: 0.95
        }
      ],
      calculateTotal: [
        {
          targetFunction: "calculateTotal",
          description: "Total of empty array is zero",
          category: "boundary",
          assertion: "calculateTotal([]) === 0",
          generators: {},
          seedInputs: [
            { label: "boundary", value: {} }
          ],
          evidence: "@param prices - Array of item prices; empty cart costs nothing",
          confidence: 0.95
        },
        {
          targetFunction: "calculateTotal",
          description: "Total of single-item array equals the item",
          category: "boundary",
          assertion: "calculateTotal([price]) === price",
          generators: {
            price: { type: "float", constraints: { min: 0, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 42.99 } },
            { label: "boundary", value: { price: 0 } },
            { label: "extreme", value: { price: 99999 } }
          ],
          evidence: "Single item total = the item itself",
          confidence: 0.97
        },
        {
          targetFunction: "calculateTotal",
          description: "Total is non-negative when all prices are non-negative",
          category: "boundary",
          assertion: "prices.every(p => p >= 0) ? calculateTotal(prices) >= 0 : true",
          generators: {
            prices: { type: "array", constraints: { element: "float", maxLength: 20 } }
          },
          seedInputs: [
            { label: "normal", value: { prices: [10, 20, 30] } },
            { label: "boundary", value: { prices: [] } },
            { label: "extreme", value: { prices: [0.01] } }
          ],
          evidence: "@returns Total sum; sum of non-negative numbers is non-negative",
          confidence: 0.85
        }
      ],
      formatPrice: [
        {
          targetFunction: "formatPrice",
          description: "Output always has exactly 2 decimal places",
          category: "type-preservation",
          assertion: "/^-?\\d+\\.\\d{2}$/.test(formatPrice(price))",
          generators: {
            price: { type: "float", constraints: { min: -1e4, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 42.5 } },
            { label: "boundary", value: { price: 0 } },
            { label: "extreme", value: { price: 1e6 } }
          ],
          evidence: '@returns Formatted string like "99.99"; toFixed(2) always gives 2 decimals',
          confidence: 0.93
        },
        {
          targetFunction: "formatPrice",
          description: "Parsing formatted price back gives approximately the original",
          category: "roundtrip",
          assertion: "Math.abs(parseFloat(formatPrice(price)) - price) < 0.01",
          generators: {
            price: { type: "float", constraints: { min: -1e4, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { price: 42.99 } },
            { label: "boundary", value: { price: 0 } },
            { label: "extreme", value: { price: 0.1 + 0.2 } }
          ],
          evidence: "Formatted price should round-trip within rounding tolerance",
          confidence: 0.8
        }
      ],
      // ═══════════════════════════════════════
      // sort-utils.ts
      // ═══════════════════════════════════════
      sortNumbers: [
        {
          targetFunction: "sortNumbers",
          description: "Output length equals input length",
          category: "conservation",
          assertion: "sortNumbers(arr).length === arr.length",
          generators: {
            arr: { type: "array", constraints: { element: "float", maxLength: 50 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [3, 1, 2] } },
            { label: "boundary", value: { arr: [] } },
            { label: "extreme", value: { arr: [1] } }
          ],
          evidence: "Sorting should not add or remove elements",
          confidence: 0.99
        },
        {
          targetFunction: "sortNumbers",
          description: "Output is monotonically non-decreasing",
          category: "monotonic",
          assertion: "sortNumbers(arr).every((v, i, a) => i === 0 || a[i-1] <= v)",
          generators: {
            arr: { type: "array", constraints: { element: "float", maxLength: 50 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [5, 2, 8, 1] } },
            { label: "boundary", value: { arr: [1, 1, 1] } },
            { label: "extreme", value: { arr: [100, -100, 0] } }
          ],
          evidence: "@returns New sorted array; ascending order",
          confidence: 0.99
        },
        {
          targetFunction: "sortNumbers",
          description: "Sorting is idempotent",
          category: "idempotent",
          assertion: "JSON.stringify(sortNumbers(sortNumbers(arr))) === JSON.stringify(sortNumbers(arr))",
          generators: {
            arr: { type: "array", constraints: { element: "float", maxLength: 30 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [3, 1, 2] } },
            { label: "boundary", value: { arr: [] } },
            { label: "extreme", value: { arr: [1, 2, 3] } }
          ],
          evidence: "Sorting an already sorted array should be a no-op",
          confidence: 0.97
        },
        {
          targetFunction: "sortNumbers",
          description: "Does not mutate the input array",
          category: "boundary",
          assertion: "(() => { const copy = [...arr]; sortNumbers(arr); return JSON.stringify(arr) === JSON.stringify(copy); })()",
          generators: {
            arr: { type: "array", constraints: { element: "integer", maxLength: 20 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [3, 1, 2] } },
            { label: "boundary", value: { arr: [] } },
            { label: "extreme", value: { arr: [1] } }
          ],
          evidence: "Uses [...arr].sort() \u2014 spread creates a copy",
          confidence: 0.95
        }
      ],
      unique: [
        {
          targetFunction: "unique",
          description: "Output has no duplicate elements",
          category: "boundary",
          assertion: "new Set(unique(arr)).size === unique(arr).length",
          generators: {
            arr: { type: "array", constraints: { element: "integer", maxLength: 50 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [1, 2, 2, 3] } },
            { label: "boundary", value: { arr: [] } },
            { label: "extreme", value: { arr: [1, 1, 1, 1] } }
          ],
          evidence: "Uses new Set() which removes duplicates",
          confidence: 0.99
        },
        {
          targetFunction: "unique",
          description: "Output length is at most input length",
          category: "conservation",
          assertion: "unique(arr).length <= arr.length",
          generators: {
            arr: { type: "array", constraints: { element: "integer", maxLength: 50 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [1, 2, 3] } },
            { label: "boundary", value: { arr: [] } },
            { label: "extreme", value: { arr: [5, 5, 5] } }
          ],
          evidence: "Removing duplicates can only reduce or maintain length",
          confidence: 0.98
        },
        {
          targetFunction: "unique",
          description: "Unique is idempotent",
          category: "idempotent",
          assertion: "JSON.stringify(unique(unique(arr))) === JSON.stringify(unique(arr))",
          generators: {
            arr: { type: "array", constraints: { element: "integer", maxLength: 30 } }
          },
          seedInputs: [
            { label: "normal", value: { arr: [1, 2, 2, 3] } },
            { label: "boundary", value: { arr: [] } },
            { label: "extreme", value: { arr: [1] } }
          ],
          evidence: "Applying unique to already-unique array should be a no-op",
          confidence: 0.96
        }
      ],
      mergeSorted: [
        {
          targetFunction: "mergeSorted",
          description: "Output length equals sum of input lengths",
          category: "conservation",
          assertion: "mergeSorted(a, b).length === a.length + b.length",
          generators: {
            a: { type: "array", constraints: { element: "integer", maxLength: 30 } },
            b: { type: "array", constraints: { element: "integer", maxLength: 30 } }
          },
          seedInputs: [
            { label: "normal", value: { a: [1, 3, 5], b: [2, 4, 6] } },
            { label: "boundary", value: { a: [], b: [] } },
            { label: "extreme", value: { a: [1], b: [] } }
          ],
          evidence: "Merge should include all elements from both arrays",
          confidence: 0.99
        },
        {
          targetFunction: "mergeSorted",
          description: "Output is sorted when both inputs are sorted",
          category: "monotonic",
          assertion: "(() => { const sa = [...a].sort((x,y) => x-y); const sb = [...b].sort((x,y) => x-y); return mergeSorted(sa, sb).every((v, i, r) => i === 0 || r[i-1] <= v); })()",
          generators: {
            a: { type: "array", constraints: { element: "integer", maxLength: 20 } },
            b: { type: "array", constraints: { element: "integer", maxLength: 20 } }
          },
          seedInputs: [
            { label: "normal", value: { a: [1, 3, 5], b: [2, 4, 6] } },
            { label: "boundary", value: { a: [], b: [1] } },
            { label: "extreme", value: { a: [1, 1], b: [1, 1] } }
          ],
          evidence: "@param a - First sorted array; @param b - Second sorted array; result should be sorted",
          confidence: 0.95
        }
      ],
      // ═══════════════════════════════════════
      // string-utils.ts
      // ═══════════════════════════════════════
      reverseString: [
        {
          targetFunction: "reverseString",
          description: "Reversing twice returns original",
          category: "roundtrip",
          assertion: "reverseString(reverseString(str)) === str",
          generators: {
            str: { type: "string", constraints: { maxLength: 100 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "hello" } },
            { label: "boundary", value: { str: "" } },
            { label: "extreme", value: { str: "a" } }
          ],
          evidence: "Reverse is its own inverse: reverse(reverse(x)) === x",
          confidence: 0.99
        },
        {
          targetFunction: "reverseString",
          description: "Length is preserved after reversing",
          category: "conservation",
          assertion: "reverseString(str).length === str.length",
          generators: {
            str: { type: "string", constraints: { maxLength: 100 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "test" } },
            { label: "boundary", value: { str: "" } },
            { label: "extreme", value: { str: "x" } }
          ],
          evidence: "Reversing characters does not change count",
          confidence: 0.99
        },
        {
          targetFunction: "reverseString",
          description: "First character becomes last character",
          category: "metamorphic",
          assertion: "str.length === 0 || reverseString(str)[str.length - 1] === str[0]",
          generators: {
            str: { type: "string", constraints: { maxLength: 50 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "abc" } },
            { label: "boundary", value: { str: "x" } },
            { label: "extreme", value: { str: "" } }
          ],
          evidence: "Reversing puts first element at the end",
          confidence: 0.93
        }
      ],
      truncate: [
        {
          targetFunction: "truncate",
          description: "Output length never exceeds maxLen",
          category: "boundary",
          assertion: "truncate(str, maxLen).length <= maxLen",
          generators: {
            str: { type: "string", constraints: { maxLength: 200 } },
            maxLen: { type: "integer", constraints: { min: 3, max: 200 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "hello world", maxLen: 8 } },
            { label: "boundary", value: { str: "hi", maxLen: 3 } },
            { label: "extreme", value: { str: "a".repeat(100), maxLen: 3 } }
          ],
          evidence: "@param maxLen - Maximum length; result should respect this limit",
          confidence: 0.95
        },
        {
          targetFunction: "truncate",
          description: "Short strings are returned unchanged",
          category: "boundary",
          assertion: "str.length <= maxLen ? truncate(str, maxLen) === str : true",
          generators: {
            str: { type: "string", constraints: { maxLength: 50 } },
            maxLen: { type: "integer", constraints: { min: 3, max: 100 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "hi", maxLen: 10 } },
            { label: "boundary", value: { str: "abc", maxLen: 3 } },
            { label: "extreme", value: { str: "", maxLen: 5 } }
          ],
          evidence: "if (str.length <= maxLen) return str \u2014 code returns unchanged",
          confidence: 0.97
        },
        {
          targetFunction: "truncate",
          description: "Truncated strings end with ellipsis",
          category: "type-preservation",
          assertion: "str.length > maxLen ? truncate(str, maxLen).endsWith('...') : true",
          generators: {
            str: { type: "string", constraints: { maxLength: 200 } },
            maxLen: { type: "integer", constraints: { min: 3, max: 100 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "hello world!", maxLen: 8 } },
            { label: "boundary", value: { str: "abcdef", maxLen: 3 } },
            { label: "extreme", value: { str: "a".repeat(50), maxLen: 4 } }
          ],
          evidence: "return str.slice(0, maxLen - 3) + '...' \u2014 adds ellipsis",
          confidence: 0.96
        }
      ],
      isPalindrome: [
        {
          targetFunction: "isPalindrome",
          description: "Empty string is a palindrome",
          category: "boundary",
          assertion: "isPalindrome('') === true",
          generators: {},
          seedInputs: [
            { label: "boundary", value: {} }
          ],
          evidence: "Empty string reversed equals itself",
          confidence: 0.95
        },
        {
          targetFunction: "isPalindrome",
          description: "Single characters are palindromes",
          category: "boundary",
          assertion: "isPalindrome(str) === true",
          generators: {
            str: { type: "string", constraints: { maxLength: 1 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "a" } },
            { label: "boundary", value: { str: "Z" } },
            { label: "extreme", value: { str: "5" } }
          ],
          evidence: "Any single character reads the same forwards and backwards",
          confidence: 0.95
        },
        {
          targetFunction: "isPalindrome",
          description: "Concatenating a string with its reverse is always a palindrome",
          category: "metamorphic",
          assertion: "isPalindrome(str + str.split('').reverse().join('')) === true",
          generators: {
            str: { type: "string", constraints: { maxLength: 20 } }
          },
          seedInputs: [
            { label: "normal", value: { str: "abc" } },
            { label: "boundary", value: { str: "" } },
            { label: "extreme", value: { str: "x" } }
          ],
          evidence: "str + reverse(str) is always a palindrome by construction",
          confidence: 0.88
        }
      ],
      // ═══════════════════════════════════════
      // Python: calculator.py
      // ═══════════════════════════════════════
      add: [
        {
          targetFunction: "add",
          description: "Addition is commutative",
          category: "equivalence",
          assertion: "add(a, b) === add(b, a)",
          generators: {
            a: { type: "integer", constraints: { min: -1e4, max: 1e4 } },
            b: { type: "integer", constraints: { min: -1e4, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { a: 3, b: 5 } },
            { label: "boundary", value: { a: 0, b: 0 } },
            { label: "extreme", value: { a: -9999, b: 9999 } }
          ],
          evidence: "Addition: a + b == b + a for all integers",
          confidence: 0.99
        },
        {
          targetFunction: "add",
          description: "Zero is identity element for addition",
          category: "boundary",
          assertion: "add(a, 0) === a",
          generators: {
            a: { type: "integer", constraints: { min: -1e4, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { a: 42 } },
            { label: "boundary", value: { a: 0 } },
            { label: "extreme", value: { a: -1 } }
          ],
          evidence: "a + 0 = a; additive identity",
          confidence: 0.99
        },
        {
          targetFunction: "add",
          description: "Addition is associative",
          category: "equivalence",
          assertion: "add(add(a, b), c) === add(a, add(b, c))",
          generators: {
            a: { type: "integer", constraints: { min: -1e3, max: 1e3 } },
            b: { type: "integer", constraints: { min: -1e3, max: 1e3 } },
            c: { type: "integer", constraints: { min: -1e3, max: 1e3 } }
          },
          seedInputs: [
            { label: "normal", value: { a: 1, b: 2, c: 3 } },
            { label: "boundary", value: { a: 0, b: 0, c: 0 } },
            { label: "extreme", value: { a: -999, b: 500, c: 499 } }
          ],
          evidence: "(a + b) + c == a + (b + c); associativity of addition",
          confidence: 0.97
        }
      ],
      divide: [
        {
          targetFunction: "divide",
          description: "Division by 1 returns the original number",
          category: "boundary",
          assertion: "divide(a, 1) === a",
          generators: {
            a: { type: "float", constraints: { min: -1e4, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { a: 42 } },
            { label: "boundary", value: { a: 0 } },
            { label: "extreme", value: { a: -1e-3 } }
          ],
          evidence: "a / 1 = a; division by unity identity",
          confidence: 0.98
        },
        {
          targetFunction: "divide",
          description: "Division of zero always returns zero",
          category: "boundary",
          assertion: "divide(0, b) === 0",
          generators: {
            b: { type: "float", constraints: { min: 1e-3, max: 1e4 } }
          },
          seedInputs: [
            { label: "normal", value: { b: 5 } },
            { label: "boundary", value: { b: 1 } },
            { label: "extreme", value: { b: 1e-3 } }
          ],
          evidence: "0 / b = 0 for any non-zero b",
          confidence: 0.97
        }
      ]
    };
    function createMockClient2() {
      return {
        async call(_systemPrompt, userPrompt, _tools, _options) {
          const funcNameRegex = /^### (\w+)/gm;
          const promptFuncNames = [];
          let m;
          while ((m = funcNameRegex.exec(userPrompt)) !== null) {
            promptFuncNames.push(m[1]);
          }
          const allProperties = [];
          const matchedFunctions = [];
          for (const funcName of promptFuncNames) {
            const props = FUNCTION_PROPERTIES[funcName];
            if (props) {
              allProperties.push(...props);
              matchedFunctions.push(funcName);
            }
          }
          if (matchedFunctions.length > 0) {
            console.log(`  [MOCK] Generating properties for: ${matchedFunctions.join(", ")}`);
          } else {
            console.log("  [MOCK] No specific mock found, using generic response");
            allProperties.push({
              targetFunction: promptFuncNames[0] ?? "unknown",
              description: "Output type is consistent",
              category: "type-preservation",
              assertion: "typeof result !== 'undefined'",
              generators: { x: { type: "integer" } },
              seedInputs: [
                { label: "normal", value: { x: 1 } },
                { label: "boundary", value: { x: 0 } },
                { label: "extreme", value: { x: -1 } }
              ],
              evidence: "function should return a defined value",
              confidence: 0.5
            });
          }
          const response = { properties: allProperties };
          const inputTokens = Math.floor(userPrompt.length / 4);
          const outputTokens = Math.floor(JSON.stringify(response).length / 4);
          return {
            content: response,
            inputTokens,
            outputTokens,
            model: "claude-opus-4-20250514-mock"
          };
        }
      };
    }
  }
});

// ../llm/dist/prompts/infer-properties.js
var require_infer_properties = __commonJS({
  "../llm/dist/prompts/infer-properties.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildInferPrompt = buildInferPrompt;
    exports2.getSystemPrompt = getSystemPrompt;
    exports2.getInferTool = getInferTool;
    var SYSTEM_PROMPT = `You are propcheck, an expert AI that discovers testable properties (invariants) of code.

Given a function's signature, types, and documentation, you infer properties that should ALWAYS hold true for ANY valid input.

Property categories:
- roundtrip: encode then decode returns original (decode(encode(x)) === x)
- idempotent: applying twice is same as once (f(f(x)) === f(x))
- conservation: a quantity is preserved (sum before === sum after)
- monotonic: output preserves ordering (if a <= b then f(a) <= f(b))
- equivalence: two implementations agree (f(x) === g(x))
- type-preservation: output type matches expectation
- cross-function: relationship between two functions
- boundary: edge case behavior (result >= 0, handles empty input)
- metamorphic: transformed input relates to transformed output

Rules:
1. Every property MUST be testable with random inputs
2. Every property MUST cite evidence from the code or docs
3. Prefer specific properties over generic ones
4. Include seed inputs: one normal case, one boundary, one extreme
5. Generators must cover the function's parameter types
6. Assertions must reference the target function's return value
7. Do NOT generate tautologies (always-true) or trivial type checks`;
    function formatFunction(fn) {
      const params = fn.parameters.map((p) => {
        let s = p.name;
        if (p.type)
          s += `: ${p.type}`;
        if (p.isOptional)
          s += "?";
        if (p.defaultValue)
          s += ` = ${p.defaultValue}`;
        if (p.isRest)
          s = `...${s}`;
        return s;
      }).join(", ");
      const ret = fn.returnType ? `: ${fn.returnType}` : "";
      const prefix = fn.isAsync ? "async " : "";
      return `${prefix}function ${fn.qualifiedName}(${params})${ret}`;
    }
    function buildInferPrompt(context) {
      const lines = [];
      lines.push(`File: ${context.filePath}`);
      lines.push(`Language: ${context.language}`);
      lines.push("");
      lines.push("## Source Code:");
      lines.push("```" + context.language);
      lines.push(context.sourceCode);
      lines.push("```");
      lines.push("");
      lines.push("## Functions to analyze:");
      for (const fn of context.functions) {
        lines.push(`
### ${fn.qualifiedName}`);
        lines.push(`Signature: ${formatFunction(fn)}`);
        if (fn.docstring) {
          lines.push(`Documentation: ${fn.docstring}`);
        }
        lines.push(`Visibility: ${fn.visibility}`);
      }
      if (context.types.length > 0) {
        lines.push("\n## Type definitions:");
        for (const t of context.types) {
          lines.push(`${t.kind} ${t.name} {`);
          for (const prop of t.properties) {
            const opt = prop.isOptional ? "?" : "";
            const ro = prop.isReadonly ? "readonly " : "";
            lines.push(`  ${ro}${prop.name}${opt}: ${prop.type}`);
          }
          lines.push("}");
        }
      }
      const docSignals = context.signals.doc;
      if (docSignals.length > 0) {
        lines.push("\n## Documentation signals:");
        for (const doc of docSignals) {
          const paramEntries = Object.entries(doc.paramDocs);
          if (paramEntries.length > 0) {
            lines.push(`Parameters for ${doc.functionName}:`);
            for (const [name, desc] of paramEntries) {
              lines.push(`  @param ${name} \u2014 ${desc}`);
            }
          }
          if (doc.returnDoc) {
            lines.push(`  @returns ${doc.returnDoc}`);
          }
          if (doc.throws.length > 0) {
            lines.push(`  @throws ${doc.throws.join(", ")}`);
          }
          if (doc.examples.length > 0) {
            lines.push(`Examples for ${doc.functionName}:`);
            for (const ex of doc.examples) {
              lines.push(`  ${ex}`);
            }
          }
        }
      }
      lines.push("\n## Instructions:");
      lines.push("Infer 3-5 testable properties per function.");
      lines.push("Use the infer_properties tool to return structured results.");
      return lines.join("\n");
    }
    function getSystemPrompt() {
      return SYSTEM_PROMPT;
    }
    function getInferTool() {
      return {
        name: "infer_properties",
        description: "Return inferred properties for the analyzed functions",
        input_schema: {
          type: "object",
          properties: {
            properties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  targetFunction: { type: "string", description: "Qualified function name" },
                  description: { type: "string", description: "Human-readable description" },
                  category: {
                    type: "string",
                    enum: [
                      "roundtrip",
                      "idempotent",
                      "conservation",
                      "monotonic",
                      "equivalence",
                      "type-preservation",
                      "cross-function",
                      "boundary",
                      "metamorphic"
                    ]
                  },
                  assertion: { type: "string", description: "Testable code expression" },
                  generators: {
                    type: "object",
                    description: "Map of parameter name to generator spec",
                    additionalProperties: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        constraints: { type: "object" }
                      },
                      required: ["type"]
                    }
                  },
                  seedInputs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", enum: ["normal", "boundary", "extreme"] },
                        value: {}
                      },
                      required: ["label", "value"]
                    },
                    minItems: 1,
                    maxItems: 3
                  },
                  evidence: { type: "string", description: "Code/doc evidence for this property" },
                  confidence: { type: "number", minimum: 0, maximum: 1 }
                },
                required: [
                  "targetFunction",
                  "description",
                  "category",
                  "assertion",
                  "generators",
                  "seedInputs",
                  "evidence",
                  "confidence"
                ]
              }
            }
          },
          required: ["properties"]
        }
      };
    }
  }
});

// ../llm/dist/response-parser.js
var require_response_parser = __commonJS({
  "../llm/dist/response-parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseInferResponse = parseInferResponse;
    var zod_1 = require("zod");
    var common_1 = require_dist4();
    var VALID_CATEGORIES = [
      "roundtrip",
      "idempotent",
      "conservation",
      "monotonic",
      "equivalence",
      "type-preservation",
      "cross-function",
      "boundary",
      "metamorphic"
    ];
    var SeedInputSchema = zod_1.z.object({
      label: zod_1.z.enum(["normal", "boundary", "extreme"]),
      value: zod_1.z.unknown()
    });
    var GeneratorSpecSchema = zod_1.z.object({
      type: zod_1.z.string(),
      constraints: zod_1.z.record(zod_1.z.unknown()).optional()
    });
    var RawPropertySchema = zod_1.z.object({
      targetFunction: zod_1.z.string(),
      description: zod_1.z.string(),
      category: zod_1.z.string(),
      assertion: zod_1.z.string(),
      generators: zod_1.z.record(GeneratorSpecSchema),
      seedInputs: zod_1.z.array(SeedInputSchema).min(1),
      evidence: zod_1.z.string(),
      confidence: zod_1.z.number().min(0).max(1)
    });
    var ResponseSchema = zod_1.z.object({
      properties: zod_1.z.array(RawPropertySchema)
    });
    function parseInferResponse(raw, options) {
      if (!raw || typeof raw !== "object") {
        return [];
      }
      const parsed = ResponseSchema.safeParse(raw);
      if (!parsed.success) {
        const asRecord = raw;
        if (Array.isArray(asRecord.properties)) {
          return parsePropertyArray(asRecord.properties, options);
        }
        return [];
      }
      return parsePropertyArray(parsed.data.properties, options);
    }
    function parsePropertyArray(items, options) {
      const results = [];
      let counter = 1;
      for (const item of items) {
        const parsed = RawPropertySchema.safeParse(item);
        if (!parsed.success) {
          continue;
        }
        const raw = parsed.data;
        const assertionCheck = (0, common_1.validateAssertion)(raw.assertion);
        if (!assertionCheck.valid) {
          continue;
        }
        const hasUnsafeKey = Object.keys(raw.generators).some((k) => !(0, common_1.validateGeneratorKey)(k));
        if (hasUnsafeKey) {
          continue;
        }
        const category = VALID_CATEGORIES.includes(raw.category) ? raw.category : "boundary";
        const generators = {};
        for (const [key, val] of Object.entries(raw.generators)) {
          generators[key] = {
            type: val.type,
            ...val.constraints ? { constraints: val.constraints } : {}
          };
        }
        const seedInputs = raw.seedInputs.map((s) => ({
          label: s.label,
          value: s.value
        }));
        const id = `prop_${String(counter).padStart(3, "0")}`;
        counter++;
        results.push({
          id,
          targetFunction: raw.targetFunction,
          description: raw.description,
          category,
          assertion: raw.assertion,
          generators: Object.freeze(generators),
          seedInputs: Object.freeze(seedInputs),
          score: 0,
          // Will be set by scoring
          confidence: raw.confidence,
          evidence: raw.evidence,
          sourceHash: options.sourceHash,
          inferredAt: (/* @__PURE__ */ new Date()).toISOString(),
          modelId: options.modelId
        });
      }
      return results;
    }
  }
});

// ../llm/dist/scoring.js
var require_scoring = __commonJS({
  "../llm/dist/scoring.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.scoreProperty = scoreProperty;
    exports2.isRedundant = isRedundant;
    exports2.scoreAndFilter = scoreAndFilter;
    var TAUTOLOGY_PATTERNS = [
      /^true$/i,
      /^x\s*===?\s*x$/,
      /^result\s*===?\s*result$/,
      /^typeof\s+\w+\s*(!==?|===?)\s*['"]undefined['"]\s*$/
    ];
    function scoreProperty(property) {
      let score = 0;
      const funcName = property.targetFunction.split(".").pop() ?? "";
      if (property.assertion.length > 0 && funcName.length > 0 && property.assertion.includes(funcName)) {
        score += 2;
      }
      const genCount = Object.keys(property.generators).length;
      if (genCount > 0) {
        score += 2;
      }
      if (property.confidence > 0.5) {
        score += 2;
      }
      if (property.evidence.length > 10) {
        score += 2;
      }
      const isTautology = TAUTOLOGY_PATTERNS.some((pat) => pat.test(property.assertion.trim()));
      if (!isTautology) {
        score += 2;
      }
      const isTrivial = /^typeof\s+/.test(property.assertion.trim()) && !property.assertion.includes("===");
      if (!isTrivial) {
        score += 2;
      }
      if (property.seedInputs.length >= 3) {
        score += 1;
      }
      return Math.min(score, 15);
    }
    function isRedundant(property, existing) {
      const normalized = property.assertion.replace(/\s+/g, " ").trim();
      return existing.some((p) => p.assertion.replace(/\s+/g, " ").trim() === normalized);
    }
    function scoreAndFilter(properties, minScore) {
      const scored = [];
      const kept = [];
      for (const prop of properties) {
        const score = scoreProperty(prop);
        const withScore = { ...prop, score };
        scored.push(withScore);
      }
      for (const prop of scored) {
        if (prop.score >= minScore && !isRedundant(prop, kept)) {
          kept.push(prop);
        }
      }
      return kept;
    }
  }
});

// ../llm/dist/prompts/self-repair.js
var require_self_repair = __commonJS({
  "../llm/dist/prompts/self-repair.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.REPAIR_TOOL = exports2.REPAIR_SYSTEM_PROMPT = void 0;
    exports2.repairProperty = repairProperty2;
    exports2.buildRepairPrompt = buildRepairPrompt;
    var common_1 = require_dist4();
    var zod_1 = require("zod");
    var REPAIR_SYSTEM_PROMPT = `You are propcheck's self-repair module. A property-based test was generated but failed to compile or run.

Your job: fix the property definition so the generated test code works correctly.

Common issues and fixes:
1. Invalid assertion syntax \u2192 rewrite as valid JavaScript/TypeScript expression
2. Missing function call \u2192 assertion must actually call the target function
3. Wrong parameter names \u2192 match the function signature exactly
4. Array literal in assertion \u2192 use generator instead (fc.property needs arbitraries, not literals)
5. Zero parameters \u2192 ensure at least one generator for fc.property to work
6. Type mismatch \u2192 generator type must match parameter type

Rules:
- Keep the same property intent/description
- Only fix the technical issue, don't change what's being tested
- The assertion must be a boolean expression using the function's parameters
- Every generator key must match a parameter name used in the assertion`;
    exports2.REPAIR_SYSTEM_PROMPT = REPAIR_SYSTEM_PROMPT;
    var REPAIR_TOOL = {
      name: "repair_property",
      description: "Return the repaired property definition",
      input_schema: {
        type: "object",
        properties: {
          targetFunction: { type: "string", description: "Function being tested" },
          description: { type: "string", description: "What the property tests" },
          category: {
            type: "string",
            enum: [
              "roundtrip",
              "idempotent",
              "conservation",
              "monotonic",
              "equivalence",
              "type-preservation",
              "cross-function",
              "boundary",
              "metamorphic"
            ]
          },
          assertion: { type: "string", description: "Fixed boolean expression" },
          generators: {
            type: "object",
            description: "Parameter name \u2192 { type, constraints? }",
            additionalProperties: {
              type: "object",
              properties: {
                type: { type: "string" },
                constraints: { type: "object" }
              },
              required: ["type"]
            }
          },
          confidence: { type: "number", description: "0-1 confidence in the fix" }
        },
        required: ["targetFunction", "description", "category", "assertion", "generators", "confidence"]
      }
    };
    exports2.REPAIR_TOOL = REPAIR_TOOL;
    function buildRepairPrompt(property, errorMessage, sourceCode, functionSignature) {
      return `## Property that failed

**Target function:** \`${property.targetFunction}\`
**Function signature:** \`${functionSignature}\`
**Description:** ${property.description}
**Category:** ${property.category}
**Assertion:** \`${property.assertion}\`
**Generators:** ${JSON.stringify(property.generators, null, 2)}

## Error encountered

\`\`\`
${errorMessage.slice(0, 500)}
\`\`\`

## Source code

\`\`\`typescript
${sourceCode.slice(0, 2e3)}
\`\`\`

## Task

Fix the property definition so the generated test compiles and runs correctly.
Return the repaired property via the repair_property tool.`;
    }
    async function repairProperty2(client, property, errorMessage, sourceCode, functionSignature) {
      try {
        const prompt = buildRepairPrompt(property, errorMessage, sourceCode, functionSignature);
        const response = await client.call(REPAIR_SYSTEM_PROMPT, prompt, [REPAIR_TOOL]);
        if (!response.content || typeof response.content !== "object") {
          return null;
        }
        const content = response.content;
        if (!content.assertion || !content.generators || !content.targetFunction) {
          return null;
        }
        const assertionCheck = (0, common_1.validateAssertion)(String(content.assertion));
        if (!assertionCheck.valid) {
          return null;
        }
        if (content.generators && typeof content.generators === "object") {
          const hasUnsafeKey = Object.keys(content.generators).some((k) => !(0, common_1.validateGeneratorKey)(k));
          if (hasUnsafeKey) {
            return null;
          }
        }
        const RepairGeneratorSchema = zod_1.z.record(zod_1.z.string().regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/), zod_1.z.object({
          type: zod_1.z.string(),
          constraints: zod_1.z.record(zod_1.z.unknown()).optional()
        }));
        const genParsed = RepairGeneratorSchema.safeParse(content.generators);
        if (!genParsed.success) {
          return null;
        }
        const repaired = {
          ...property,
          assertion: String(content.assertion),
          generators: Object.freeze(genParsed.data),
          category: content.category ?? property.category,
          description: String(content.description ?? property.description),
          confidence: Math.min(property.confidence, typeof content.confidence === "number" ? content.confidence : 0.5)
        };
        return repaired;
      } catch {
        return null;
      }
    }
  }
});

// ../llm/dist/mock-repair.js
var require_mock_repair = __commonJS({
  "../llm/dist/mock-repair.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.mockRepairProperty = mockRepairProperty2;
    function mockRepairProperty2(property, errorMessage) {
      const err = errorMessage.toLowerCase();
      if (err.includes("property expects at least one arbitrary") || err.includes("fc.property")) {
        const hasGenerators = Object.keys(property.generators).length > 0;
        if (!hasGenerators) {
          return {
            ...property,
            generators: { _unused: { type: "integer", constraints: { min: 0, max: 1 } } },
            assertion: property.assertion.replace(/^/, "(() => { const _unused = arguments[0]; return ") + " })()",
            confidence: property.confidence * 0.8
          };
        }
      }
      if (err.includes("unexpected token") && property.assertion.includes("[")) {
        const fixed = property.assertion.replace(/\[(\w+)\]/g, "[$1]").replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_, nums) => {
          return `[${nums}]`;
        });
        if (fixed !== property.assertion) {
          return {
            ...property,
            assertion: fixed,
            confidence: property.confidence * 0.7
          };
        }
      }
      if (err.includes("cannot find name") || err.includes("is not defined")) {
        const nameMatch = errorMessage.match(/(?:Cannot find name\s+['"](\w+)['"]|(\w+)\s+is not defined)/i);
        const missingName = nameMatch?.[1] ?? nameMatch?.[2];
        if (missingName && !property.generators[missingName]) {
          return {
            ...property,
            generators: {
              ...property.generators,
              [missingName]: { type: "number" }
            },
            confidence: property.confidence * 0.7
          };
        }
      }
      if (err.includes("type") && (err.includes("not assignable") || err.includes("expected"))) {
        const fixedGens = { ...property.generators };
        let changed = false;
        for (const [key, gen] of Object.entries(fixedGens)) {
          if (gen.type === "integer") {
            fixedGens[key] = { type: "float", constraints: gen.constraints };
            changed = true;
          }
        }
        if (changed) {
          return {
            ...property,
            generators: fixedGens,
            confidence: property.confidence * 0.8
          };
        }
      }
      if (err.includes("nan") || err.includes("not a number")) {
        const fixedGens = { ...property.generators };
        for (const [key, gen] of Object.entries(fixedGens)) {
          if (gen.type === "float" || gen.type === "number") {
            fixedGens[key] = {
              ...gen,
              constraints: { ...gen.constraints, noNaN: true, noDefaultInfinity: true }
            };
          }
        }
        return {
          ...property,
          generators: fixedGens,
          confidence: property.confidence * 0.9
        };
      }
      return null;
    }
  }
});

// ../llm/dist/prompts/refinement.js
var require_refinement = __commonJS({
  "../llm/dist/prompts/refinement.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.classifyProperties = classifyProperties2;
    exports2.buildFeedbackSummary = buildFeedbackSummary2;
    exports2.buildRefinementPrompt = buildRefinementPrompt;
    function classifyProperties2(properties, result) {
      const passedIds = new Map(result.passed.map((p) => [p.propertyId, p]));
      const failedIds = new Map(result.failed.map((f) => [f.propertyId, f]));
      const errorIds = new Map(result.errors.map((e) => [e.propertyId, e]));
      return properties.map((prop) => {
        const passed = passedIds.get(prop.id);
        if (passed) {
          if (prop.score < 12 || prop.confidence < 0.7) {
            return { kind: "weak", property: prop, reason: `low score (${prop.score}/15) or confidence (${prop.confidence})` };
          }
          return { kind: "strong", property: prop };
        }
        const failed = failedIds.get(prop.id);
        if (failed) {
          return { kind: "bug_found", property: prop, counterexample: failed.counterexample };
        }
        const error = errorIds.get(prop.id);
        if (error) {
          return { kind: "failed", property: prop, error: error.errorMessage };
        }
        return { kind: "failed", property: prop, error: "no result" };
      });
    }
    function buildFeedbackSummary2(classifications, functionNames) {
      const lines = [];
      lines.push("## Round 1 Results\n");
      const byFunction = /* @__PURE__ */ new Map();
      for (const c of classifications) {
        const fn = c.property.targetFunction;
        const list = byFunction.get(fn) ?? [];
        list.push(c);
        byFunction.set(fn, list);
      }
      for (const [fn, cls] of byFunction) {
        lines.push(`### ${fn}`);
        for (const c of cls) {
          switch (c.kind) {
            case "strong":
              lines.push(`  \u2713 STRONG: "${c.property.description}" \u2014 passed, high quality`);
              break;
            case "weak":
              lines.push(`  \u26A0 WEAK: "${c.property.description}" \u2014 ${c.reason}`);
              lines.push(`    \u2192 Please generate a STRONGER version that tests deeper behavior`);
              break;
            case "bug_found":
              lines.push(`  \u{1F41B} BUG FOUND: "${c.property.description}" \u2014 counterexample: ${JSON.stringify(c.counterexample)}`);
              lines.push(`    \u2192 Explore SIMILAR properties around this bug area`);
              break;
            case "failed":
              lines.push(`  \u2717 FAILED: "${c.property.description}" \u2014 ${c.error}`);
              break;
          }
        }
        lines.push("");
      }
      const coveredFunctions = /* @__PURE__ */ new Set();
      for (const c of classifications) {
        if (c.kind === "strong" || c.kind === "bug_found") {
          coveredFunctions.add(c.property.targetFunction);
        }
      }
      const uncovered = functionNames.filter((fn) => !coveredFunctions.has(fn));
      if (uncovered.length > 0) {
        lines.push("## Coverage Gaps");
        lines.push(`These functions have no strong properties yet: ${uncovered.join(", ")}`);
        lines.push("\u2192 Try different property categories (roundtrip, conservation, metamorphic)");
        lines.push("");
      }
      const strong = classifications.filter((c) => c.kind === "strong").length;
      const weak = classifications.filter((c) => c.kind === "weak").length;
      const bugs = classifications.filter((c) => c.kind === "bug_found").length;
      const failed = classifications.filter((c) => c.kind === "failed").length;
      lines.push("## Summary");
      lines.push(`Strong: ${strong} | Weak: ${weak} | Bugs found: ${bugs} | Failed: ${failed}`);
      lines.push("");
      lines.push("## Instructions for Round 2");
      lines.push("1. Keep all STRONG properties as-is (do not regenerate them)");
      lines.push("2. For each WEAK property, generate a stronger replacement");
      lines.push("3. For each BUG FOUND, generate 1-2 related properties exploring the same area");
      lines.push("4. For coverage gaps, try completely different property categories");
      lines.push("5. Do NOT duplicate existing strong properties");
      return lines.join("\n");
    }
    function buildRefinementPrompt(originalPrompt, feedbackSummary) {
      return `${originalPrompt}

---

${feedbackSummary}

Generate ONLY new or improved properties. Do NOT repeat the strong properties from Round 1.`;
    }
  }
});

// ../llm/dist/mock-refinement.js
var require_mock_refinement = __commonJS({
  "../llm/dist/mock-refinement.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.mockRefineProperties = mockRefineProperties2;
    function mockRefineProperties2(classifications) {
      const improved = [];
      let idCounter = 900;
      for (const c of classifications) {
        switch (c.kind) {
          case "weak": {
            const strengthened = {
              ...c.property,
              id: `prop_${idCounter++}`,
              score: Math.min(c.property.score + 2, 15),
              confidence: Math.min(c.property.confidence + 0.1, 1),
              description: c.property.description + " (strengthened)"
            };
            improved.push(strengthened);
            break;
          }
          case "bug_found": {
            const related = {
              ...c.property,
              id: `prop_${idCounter++}`,
              description: `${c.property.targetFunction}: boundary around discovered bug`,
              category: "boundary",
              confidence: 0.8,
              score: 13
            };
            improved.push(related);
            break;
          }
          case "failed": {
            break;
          }
          case "strong": {
            break;
          }
        }
      }
      return improved;
    }
  }
});

// ../llm/dist/index.js
var require_dist5 = __commonJS({
  "../llm/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.mockRefineProperties = exports2.buildRefinementPrompt = exports2.buildFeedbackSummary = exports2.classifyProperties = exports2.mockRepairProperty = exports2.repairProperty = exports2.getInferTool = exports2.getSystemPrompt = exports2.buildInferPrompt = exports2.isRedundant = exports2.scoreAndFilter = exports2.scoreProperty = exports2.parseInferResponse = exports2.createMockClient = exports2.createLlmClient = void 0;
    exports2.inferProperties = inferProperties2;
    var common_1 = require_dist4();
    var client_1 = require_client();
    var mock_client_1 = require_mock_client();
    var infer_properties_1 = require_infer_properties();
    var response_parser_1 = require_response_parser();
    var scoring_1 = require_scoring();
    var DEFAULT_OPTIONS = {
      maxProperties: 5,
      minScore: 10,
      mock: false
    };
    var INPUT_COST_PER_1M = 3;
    var OUTPUT_COST_PER_1M = 15;
    function estimateCost(inputTokens, outputTokens) {
      return inputTokens / 1e6 * INPUT_COST_PER_1M + outputTokens / 1e6 * OUTPUT_COST_PER_1M;
    }
    async function inferProperties2(apiKey, model, context, options = {}) {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const startTime = Date.now();
      const client = opts.mock ? (0, mock_client_1.createMockClient)() : (0, client_1.createLlmClient)(apiKey, model);
      const systemPrompt = (0, infer_properties_1.getSystemPrompt)();
      const userPrompt = (0, infer_properties_1.buildInferPrompt)(context);
      const tool = (0, infer_properties_1.getInferTool)();
      const response = await client.call(systemPrompt, userPrompt, [tool]);
      const sourceHash = (0, common_1.hashContent)(context.sourceCode);
      const rawProperties = (0, response_parser_1.parseInferResponse)(response.content, {
        sourceHash,
        modelId: response.model
      });
      const filtered = (0, scoring_1.scoreAndFilter)(rawProperties, opts.minScore);
      const functionGroups = /* @__PURE__ */ new Map();
      for (const prop of filtered) {
        const group = functionGroups.get(prop.targetFunction) ?? [];
        group.push(prop);
        functionGroups.set(prop.targetFunction, group);
      }
      const limited = [];
      for (const [_fn, props] of functionGroups) {
        limited.push(...props.slice(0, opts.maxProperties));
      }
      const duration = Date.now() - startTime;
      const cost = estimateCost(response.inputTokens, response.outputTokens);
      return {
        properties: limited,
        tokensUsed: response.inputTokens + response.outputTokens,
        cost,
        duration
      };
    }
    var client_2 = require_client();
    Object.defineProperty(exports2, "createLlmClient", { enumerable: true, get: function() {
      return client_2.createLlmClient;
    } });
    var mock_client_2 = require_mock_client();
    Object.defineProperty(exports2, "createMockClient", { enumerable: true, get: function() {
      return mock_client_2.createMockClient;
    } });
    var response_parser_2 = require_response_parser();
    Object.defineProperty(exports2, "parseInferResponse", { enumerable: true, get: function() {
      return response_parser_2.parseInferResponse;
    } });
    var scoring_2 = require_scoring();
    Object.defineProperty(exports2, "scoreProperty", { enumerable: true, get: function() {
      return scoring_2.scoreProperty;
    } });
    Object.defineProperty(exports2, "scoreAndFilter", { enumerable: true, get: function() {
      return scoring_2.scoreAndFilter;
    } });
    Object.defineProperty(exports2, "isRedundant", { enumerable: true, get: function() {
      return scoring_2.isRedundant;
    } });
    var infer_properties_2 = require_infer_properties();
    Object.defineProperty(exports2, "buildInferPrompt", { enumerable: true, get: function() {
      return infer_properties_2.buildInferPrompt;
    } });
    Object.defineProperty(exports2, "getSystemPrompt", { enumerable: true, get: function() {
      return infer_properties_2.getSystemPrompt;
    } });
    Object.defineProperty(exports2, "getInferTool", { enumerable: true, get: function() {
      return infer_properties_2.getInferTool;
    } });
    var self_repair_1 = require_self_repair();
    Object.defineProperty(exports2, "repairProperty", { enumerable: true, get: function() {
      return self_repair_1.repairProperty;
    } });
    var mock_repair_1 = require_mock_repair();
    Object.defineProperty(exports2, "mockRepairProperty", { enumerable: true, get: function() {
      return mock_repair_1.mockRepairProperty;
    } });
    var refinement_1 = require_refinement();
    Object.defineProperty(exports2, "classifyProperties", { enumerable: true, get: function() {
      return refinement_1.classifyProperties;
    } });
    Object.defineProperty(exports2, "buildFeedbackSummary", { enumerable: true, get: function() {
      return refinement_1.buildFeedbackSummary;
    } });
    Object.defineProperty(exports2, "buildRefinementPrompt", { enumerable: true, get: function() {
      return refinement_1.buildRefinementPrompt;
    } });
    var mock_refinement_1 = require_mock_refinement();
    Object.defineProperty(exports2, "mockRefineProperties", { enumerable: true, get: function() {
      return mock_refinement_1.mockRefineProperties;
    } });
  }
});

// ../engines/dist/fast-check/fc-codegen.js
var require_fc_codegen = __commonJS({
  "../engines/dist/fast-check/fc-codegen.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.generateFastCheckTest = generateFastCheckTest3;
    var common_1 = require_dist4();
    var path6 = __importStar(require("path"));
    function mapGenerator(spec) {
      const c = spec.constraints ?? {};
      switch (spec.type) {
        case "integer":
          if (c.min !== void 0 || c.max !== void 0) {
            const parts = [];
            if (c.min !== void 0)
              parts.push(`min: ${c.min}`);
            if (c.max !== void 0)
              parts.push(`max: ${c.max}`);
            return `fc.integer({ ${parts.join(", ")} })`;
          }
          return "fc.integer()";
        case "float":
        case "number":
          if (c.min !== void 0 || c.max !== void 0) {
            const parts = [];
            if (c.min !== void 0)
              parts.push(`min: ${c.min}`);
            if (c.max !== void 0)
              parts.push(`max: ${c.max}`);
            return `fc.double({ ${parts.join(", ")}, noNaN: true })`;
          }
          return "fc.double({ noNaN: true })";
        case "string":
          if (c.maxLength !== void 0) {
            return `fc.string({ maxLength: ${c.maxLength} })`;
          }
          return "fc.string()";
        case "boolean":
          return "fc.boolean()";
        case "array": {
          const element = c.element ? mapGenerator({ type: String(c.element) }) : "fc.anything()";
          const maxLen = c.maxLength ? `, { maxLength: ${c.maxLength} }` : "";
          return `fc.array(${element}${maxLen})`;
        }
        case "record":
          return "fc.dictionary(fc.string(), fc.anything())";
        default:
          return "fc.anything()";
      }
    }
    function generateFastCheckTest3(properties, targetFile, testDir, config) {
      const relativeImport = (0, common_1.toForwardSlash)(path6.relative(testDir, targetFile)).replace(/\.(ts|tsx|js|jsx)$/, "");
      let importPathStr;
      if (targetFile.endsWith(".ts") || targetFile.endsWith(".tsx")) {
        importPathStr = (0, common_1.toForwardSlash)(path6.relative(testDir, targetFile));
        if (!importPathStr.startsWith("."))
          importPathStr = `./${importPathStr}`;
      } else {
        const noExt = relativeImport.startsWith(".") ? relativeImport : `./${relativeImport}`;
        importPathStr = noExt;
      }
      const functionNames = [...new Set(properties.map((p) => p.targetFunction.split(".").pop()))];
      let fcRequire = `require("fast-check")`;
      try {
        const fcPath = require.resolve("fast-check");
        fcRequire = `require(${JSON.stringify((0, common_1.toForwardSlash)(fcPath))})`;
      } catch {
      }
      const lines = [];
      lines.push(`// Auto-generated by propcheck \u2014 do not edit manually`);
      lines.push(`// Target: ${(0, common_1.toForwardSlash)(targetFile)}`);
      lines.push(`// Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      lines.push(``);
      lines.push(`const fc = ${fcRequire};`);
      lines.push(`const target = require("${importPathStr}");`);
      lines.push(``);
      lines.push(`const numRuns = ${config.iterations};`);
      lines.push(``);
      for (const prop of properties) {
        const funcName = prop.targetFunction.split(".").pop();
        const generators = Object.entries(prop.generators);
        const arbNames = generators.map(([name]) => name);
        const arbExprs = generators.map(([, spec]) => mapGenerator(spec));
        const assertion = prop.assertion.replace(new RegExp(`\\b${funcName}\\(`, "g"), `target.${funcName}(`);
        lines.push(`// ${prop.id}: ${prop.description}`);
        lines.push(`// Category: ${prop.category}`);
        lines.push(`// Evidence: ${prop.evidence}`);
        lines.push(`try {`);
        if (generators.length === 0) {
          lines.push(`  const __result = ${assertion};`);
          lines.push(`  if (!__result) throw new Error("Assertion failed: ${assertion.replace(/"/g, '\\"')}");`);
          lines.push(`  console.log(JSON.stringify({ propertyId: "${prop.id}", status: "passed", iterations: 1 }));`);
        } else {
          lines.push(`  fc.assert(`);
          lines.push(`    fc.property(`);
          for (let i = 0; i < arbExprs.length; i++) {
            lines.push(`      ${arbExprs[i]},`);
          }
          lines.push(`      (${arbNames.join(", ")}) => {`);
          lines.push(`        return ${assertion};`);
          lines.push(`      }`);
          lines.push(`    ),`);
          lines.push(`    { numRuns${config.seed !== void 0 ? `, seed: ${config.seed}` : ""} }`);
          lines.push(`  );`);
          lines.push(`  console.log(JSON.stringify({ propertyId: "${prop.id}", status: "passed", iterations: numRuns }));`);
        }
        lines.push(`} catch (e) {`);
        lines.push(`  // Parse counterexample from fast-check error message`);
        lines.push(`  let counterexample = null;`);
        lines.push(`  let shrinkSteps = 0;`);
        lines.push(`  const msg = e.message ?? String(e);`);
        lines.push(`  const ceMatch = msg.match(/Counterexample: (\\[.*?\\])/);`);
        lines.push(`  if (ceMatch) { try { counterexample = JSON.parse(ceMatch[1]); } catch {} }`);
        lines.push(`  const shrinkMatch = msg.match(/Shrunk (\\d+) time/);`);
        lines.push(`  if (shrinkMatch) { shrinkSteps = parseInt(shrinkMatch[1], 10); }`);
        lines.push(`  console.log(JSON.stringify({`);
        lines.push(`    propertyId: "${prop.id}",`);
        lines.push(`    status: "failed",`);
        lines.push(`    counterexample,`);
        lines.push(`    errorMessage: msg,`);
        lines.push(`    shrinkSteps`);
        lines.push(`  }));`);
        lines.push(`}`);
        lines.push(``);
      }
      const baseName = path6.basename(targetFile, path6.extname(targetFile));
      const fileName = `${baseName}.fc.js`;
      return {
        content: lines.join("\n"),
        fileName
      };
    }
  }
});

// ../engines/dist/shared/process-runner.js
var require_process_runner = __commonJS({
  "../engines/dist/shared/process-runner.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runProcess = runProcess;
    var node_child_process_1 = require("child_process");
    var common_1 = require_dist4();
    function runProcess(command, args, options = {}) {
      const timeout = options.timeout ?? 6e4;
      return new Promise((resolve4, reject) => {
        const proc = (0, node_child_process_1.spawn)(command, args, {
          cwd: options.cwd,
          env: {
            // Only forward safe env vars — never leak API keys to generated test code
            PATH: process.env["PATH"] ?? "",
            HOME: process.env["HOME"] ?? process.env["USERPROFILE"] ?? "",
            TEMP: process.env["TEMP"] ?? process.env["TMPDIR"] ?? "/tmp",
            TMP: process.env["TMP"] ?? "",
            LANG: process.env["LANG"] ?? "",
            TERM: process.env["TERM"] ?? "",
            SHELL: process.env["SHELL"] ?? "",
            // Windows-specific
            SYSTEMROOT: process.env["SYSTEMROOT"] ?? "",
            APPDATA: process.env["APPDATA"] ?? "",
            LOCALAPPDATA: process.env["LOCALAPPDATA"] ?? "",
            PROGRAMFILES: process.env["PROGRAMFILES"] ?? "",
            COMSPEC: process.env["COMSPEC"] ?? "",
            // Python-specific
            PYTHONPATH: process.env["PYTHONPATH"] ?? "",
            VIRTUAL_ENV: process.env["VIRTUAL_ENV"] ?? "",
            // Caller overrides (e.g. NODE_PATH)
            ...options.env
          },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        let killed = false;
        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        const timer = setTimeout(() => {
          killed = true;
          proc.kill("SIGTERM");
          setTimeout(() => proc.kill("SIGKILL"), 5e3);
        }, timeout);
        proc.on("close", (code) => {
          clearTimeout(timer);
          if (killed) {
            reject(new common_1.EngineError(`Process timed out after ${timeout}ms`, {
              command,
              args,
              stdout: stdout.slice(0, 500),
              stderr: stderr.slice(0, 500)
            }));
            return;
          }
          resolve4({ stdout, stderr, exitCode: code ?? 1 });
        });
        proc.on("error", (err) => {
          clearTimeout(timer);
          reject(new common_1.EngineError(`Failed to spawn process: ${err.message}`, {
            command,
            args
          }));
        });
      });
    }
  }
});

// ../engines/dist/shared/result-parser.js
var require_result_parser = __commonJS({
  "../engines/dist/shared/result-parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseJsonLines = parseJsonLines;
    exports2.mapResults = mapResults;
    function parseJsonLines(stdout) {
      const results = [];
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{"))
          continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.propertyId && parsed.status) {
            results.push(parsed);
          }
        } catch {
        }
      }
      return results;
    }
    function mapResults(rawResults, properties, config, duration, stderrSnippet, errorPrefix) {
      const passed = [];
      const failed = [];
      const errors = [];
      const resultMap = new Map(rawResults.map((r) => [r.propertyId, r]));
      for (const prop of properties) {
        const raw = resultMap.get(prop.id);
        if (!raw) {
          errors.push({
            propertyId: prop.id,
            status: "error",
            errorMessage: stderrSnippet ? `${errorPrefix}: ${stderrSnippet.slice(0, 200)}` : "Property produced no output",
            duration: 0
          });
          continue;
        }
        if (raw.status === "passed") {
          passed.push({
            propertyId: prop.id,
            status: "passed",
            iterations: raw.iterations ?? config.iterations,
            duration: 0,
            seed: config.seed ?? 0
          });
        } else {
          failed.push({
            propertyId: prop.id,
            status: "failed",
            counterexample: raw.counterexample ?? null,
            shrinkSteps: raw.shrinkSteps ?? 0,
            originalInput: raw.counterexample,
            errorMessage: raw.errorMessage ?? "Property violated",
            seed: config.seed ?? 0,
            duration: 0
          });
        }
      }
      return {
        passed,
        failed,
        errors,
        duration,
        totalIterations: passed.reduce((sum, p) => sum + p.iterations, 0),
        properties
      };
    }
  }
});

// ../engines/dist/fast-check/fc-runner.js
var require_fc_runner = __commonJS({
  "../engines/dist/fast-check/fc-runner.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runFastCheckTest = runFastCheckTest3;
    var path6 = __importStar(require("path"));
    var process_runner_1 = require_process_runner();
    var result_parser_1 = require_result_parser();
    async function runFastCheckTest3(testFilePath, properties, config) {
      const startTime = Date.now();
      const cwd = path6.dirname(testFilePath);
      const nodeArgs = [
        "--experimental-strip-types",
        "--no-warnings",
        testFilePath
      ];
      const result = await (0, process_runner_1.runProcess)("node", nodeArgs, {
        cwd,
        timeout: config.timeout * Math.max(properties.length, 1),
        env: {
          NODE_PATH: [
            path6.join(cwd, "node_modules"),
            path6.join(cwd, "..", "..", "node_modules"),
            path6.join(cwd, "..", "..", "..", "node_modules"),
            process.env["NODE_PATH"] ?? ""
          ].join(path6.delimiter)
        }
      });
      const rawResults = (0, result_parser_1.parseJsonLines)(result.stdout);
      return (0, result_parser_1.mapResults)(rawResults, properties, config, Date.now() - startTime, result.stderr, "Test execution error");
    }
  }
});

// ../engines/dist/hypothesis/hyp-codegen.js
var require_hyp_codegen = __commonJS({
  "../engines/dist/hypothesis/hyp-codegen.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.generateHypothesisTest = generateHypothesisTest2;
    var common_1 = require_dist4();
    var path6 = __importStar(require("path"));
    function mapStrategy(spec) {
      const c = spec.constraints ?? {};
      switch (spec.type) {
        case "integer":
        case "int": {
          const parts = [];
          if (c.min !== void 0)
            parts.push(`min_value=${c.min}`);
          if (c.max !== void 0)
            parts.push(`max_value=${c.max}`);
          return parts.length > 0 ? `st.integers(${parts.join(", ")})` : "st.integers()";
        }
        case "float":
        case "number": {
          const parts = ["allow_nan=False", "allow_infinity=False"];
          if (c.min !== void 0)
            parts.push(`min_value=${c.min}`);
          if (c.max !== void 0)
            parts.push(`max_value=${c.max}`);
          return `st.floats(${parts.join(", ")})`;
        }
        case "string":
        case "str": {
          if (c.maxLength !== void 0) {
            return `st.text(max_size=${c.maxLength})`;
          }
          return "st.text()";
        }
        case "boolean":
        case "bool":
          return "st.booleans()";
        case "array":
        case "list": {
          const element = c.element ? mapStrategy({ type: String(c.element) }) : "st.integers()";
          const maxLen = c.maxLength ? `, max_size=${c.maxLength}` : "";
          return `st.lists(${element}${maxLen})`;
        }
        case "dict":
        case "record":
          return "st.dictionaries(st.text(min_size=1, max_size=10), st.integers())";
        default:
          return "st.integers()";
      }
    }
    function generateHypothesisTest2(properties, targetFile, testsDir, config) {
      const targetDir = path6.dirname(targetFile);
      const moduleName = path6.basename(targetFile, path6.extname(targetFile));
      const relTargetDir = (0, common_1.toForwardSlash)(path6.relative(testsDir, targetDir));
      const lines = [];
      lines.push(`# Auto-generated by propcheck \u2014 do not edit manually`);
      lines.push(`# Target: ${(0, common_1.toForwardSlash)(targetFile)}`);
      lines.push(`# Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      lines.push(``);
      lines.push(`import sys`);
      lines.push(`import os`);
      lines.push(`import json`);
      lines.push(`from pathlib import Path`);
      lines.push(``);
      lines.push(`# Add target directory to Python path`);
      lines.push(`sys.path.insert(0, str(Path(__file__).parent / "${relTargetDir}"))`);
      lines.push(``);
      lines.push(`from hypothesis import given, settings, assume`);
      lines.push(`from hypothesis import strategies as st`);
      lines.push(`import ${moduleName} as target`);
      lines.push(``);
      lines.push(`MAX_EXAMPLES = ${config.iterations}`);
      lines.push(``);
      for (const prop of properties) {
        const funcName = prop.targetFunction.split(".").pop();
        const generators = Object.entries(prop.generators);
        const givenArgs = generators.map(([name, spec]) => `${name}=${mapStrategy(spec)}`).join(", ");
        const paramNames = generators.map(([name]) => name).join(", ");
        let assertion = prop.assertion.replace(new RegExp(`\\b${funcName}\\(`, "g"), `target.${funcName}(`);
        assertion = assertion.replace(/===/g, "==");
        assertion = assertion.replace(/!==/g, "!=");
        assertion = assertion.replace(/\btrue\b/g, "True");
        assertion = assertion.replace(/\bfalse\b/g, "False");
        assertion = assertion.replace(/\bnull\b/g, "None");
        assertion = assertion.replace(/\bundefined\b/g, "None");
        assertion = assertion.replace(/\.length\b/g, ".__len__()");
        lines.push(`# ${prop.id}: ${prop.description}`);
        lines.push(`# Category: ${prop.category}`);
        lines.push(`# Evidence: ${prop.evidence}`);
        lines.push(`def test_${prop.id}():`);
        lines.push(`    try:`);
        if (generators.length === 0) {
          lines.push(`        assert ${assertion}`);
        } else {
          lines.push(`        @given(${givenArgs})`);
          lines.push(`        @settings(max_examples=MAX_EXAMPLES)`);
          lines.push(`        def inner(${paramNames}):`);
          lines.push(`            assert ${assertion}`);
          lines.push(`        inner()`);
        }
        lines.push(`        print(json.dumps({"propertyId": "${prop.id}", "status": "passed", "iterations": ${generators.length === 0 ? 1 : "MAX_EXAMPLES"}}))`);
        lines.push(`    except AssertionError as e:`);
        lines.push(`        print(json.dumps({"propertyId": "${prop.id}", "status": "failed", "counterexample": str(e), "errorMessage": str(e), "shrinkSteps": 0}))`);
        lines.push(`    except Exception as e:`);
        lines.push(`        msg = str(e)`);
        lines.push(`        print(json.dumps({"propertyId": "${prop.id}", "status": "failed", "counterexample": msg[:200], "errorMessage": msg[:200], "shrinkSteps": 0}))`);
        lines.push(``);
      }
      lines.push(`if __name__ == "__main__":`);
      for (const prop of properties) {
        lines.push(`    test_${prop.id}()`);
      }
      const fileName = `${moduleName}.hyp.py`;
      return {
        content: lines.join("\n"),
        fileName
      };
    }
  }
});

// ../engines/dist/hypothesis/hyp-runner.js
var require_hyp_runner = __commonJS({
  "../engines/dist/hypothesis/hyp-runner.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runHypothesisTest = runHypothesisTest2;
    var path6 = __importStar(require("path"));
    var process_runner_1 = require_process_runner();
    var result_parser_1 = require_result_parser();
    async function findPython() {
      for (const cmd of ["python", "python3"]) {
        try {
          const result = await (0, process_runner_1.runProcess)(cmd, ["--version"], { timeout: 5e3 });
          if (result.exitCode === 0)
            return cmd;
        } catch {
        }
      }
      throw new Error("Python not found. Install Python 3.8+ to use Hypothesis engine.");
    }
    async function runHypothesisTest2(testFilePath, properties, config) {
      const startTime = Date.now();
      const python = await findPython();
      const result = await (0, process_runner_1.runProcess)(python, [testFilePath], {
        cwd: path6.dirname(testFilePath),
        timeout: config.timeout * Math.max(properties.length, 1)
      });
      const rawResults = (0, result_parser_1.parseJsonLines)(result.stdout);
      return (0, result_parser_1.mapResults)(rawResults, properties, config, Date.now() - startTime, result.stderr, "Python error");
    }
  }
});

// ../engines/dist/mutation/operators.js
var require_operators = __commonJS({
  "../engines/dist/mutation/operators.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.generateMutants = generateMutants2;
    var MUTATION_OPERATORS = [
      // Arithmetic
      { name: "ARITH_PLUS_TO_MINUS", description: "+ \u2192 -", pattern: /(?<=[^+=])\+(?!=)/g, replacement: "-" },
      { name: "ARITH_MINUS_TO_PLUS", description: "- \u2192 +", pattern: /(?<=[^-=])-(?!=)/g, replacement: "+" },
      { name: "ARITH_MUL_TO_DIV", description: "* \u2192 /", pattern: /\*(?!=)/g, replacement: "/" },
      { name: "ARITH_DIV_TO_MUL", description: "/ \u2192 *", pattern: /\/(?!=)/g, replacement: "*" },
      // Relational
      { name: "REL_GT_TO_GTE", description: "> \u2192 >=", pattern: /(?<!=)>(?!=)/g, replacement: ">=" },
      { name: "REL_LT_TO_LTE", description: "< \u2192 <=", pattern: /(?<!=)<(?!=)/g, replacement: "<=" },
      { name: "REL_GTE_TO_GT", description: ">= \u2192 >", pattern: />=/g, replacement: ">" },
      { name: "REL_LTE_TO_LT", description: "<= \u2192 <", pattern: /<=/g, replacement: "<" },
      { name: "REL_EQ_TO_NEQ", description: "=== \u2192 !==", pattern: /===/g, replacement: "!==" },
      { name: "REL_NEQ_TO_EQ", description: "!== \u2192 ===", pattern: /!==/g, replacement: "===" },
      // Boundary (off-by-one)
      { name: "BOUND_ZERO_TO_ONE", description: "0 \u2192 1", pattern: /(?<=[\s(,=])0(?=[\s),;])/g, replacement: "1" },
      { name: "BOUND_ONE_TO_ZERO", description: "1 \u2192 0", pattern: /(?<=[\s(,=])1(?=[\s),;])/g, replacement: "0" },
      { name: "BOUND_100_TO_99", description: "100 \u2192 99", pattern: /\b100\b/g, replacement: "99" },
      // Logical
      { name: "LOGIC_AND_TO_OR", description: "&& \u2192 ||", pattern: /&&/g, replacement: "||" },
      { name: "LOGIC_OR_TO_AND", description: "|| \u2192 &&", pattern: /\|\|/g, replacement: "&&" },
      { name: "LOGIC_TRUE_TO_FALSE", description: "true \u2192 false", pattern: /\btrue\b/g, replacement: "false" },
      { name: "LOGIC_FALSE_TO_TRUE", description: "false \u2192 true", pattern: /\bfalse\b/g, replacement: "true" },
      // Return value
      { name: "RET_EMPTY_STRING", description: 'return "..." \u2192 return ""', pattern: /return\s+"[^"]*"/g, replacement: 'return ""' },
      { name: "RET_ZERO", description: "return N \u2192 return 0", pattern: /return\s+\d+/g, replacement: "return 0" }
    ];
    function generateMutants2(source, filePath) {
      const mutants = [];
      const lines = source.split("\n");
      let mutantId = 0;
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("import ") || trimmed.startsWith("export function") || trimmed.startsWith("export async function") || trimmed.startsWith("export type") || trimmed.startsWith("export interface") || trimmed === "" || trimmed === "}" || trimmed === "{" || trimmed.startsWith("/**")) {
          continue;
        }
        for (const op of MUTATION_OPERATORS) {
          const regex = new RegExp(op.pattern.source, op.pattern.flags);
          let match;
          while ((match = regex.exec(line)) !== null) {
            const original = match[0];
            const replacement = typeof op.replacement === "function" ? op.replacement(original) : op.replacement;
            if (original === replacement)
              continue;
            const mutatedLine = line.slice(0, match.index) + replacement + line.slice(match.index + original.length);
            const mutatedLines = [...lines];
            mutatedLines[lineIdx] = mutatedLine;
            const mutatedSource = mutatedLines.join("\n");
            mutants.push({
              id: `mut_${mutantId++}`,
              operator: op.name,
              description: `Line ${lineIdx + 1}: ${op.description} \u2014 "${original}" \u2192 "${replacement}"`,
              line: lineIdx + 1,
              original,
              replacement,
              mutatedSource
            });
          }
        }
      }
      return mutants;
    }
  }
});

// ../engines/dist/mutation/runner.js
var require_runner = __commonJS({
  "../engines/dist/mutation/runner.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runMutationTesting = runMutationTesting2;
    var fs4 = __importStar(require("fs/promises"));
    var path6 = __importStar(require("path"));
    var fc_codegen_1 = require_fc_codegen();
    var fc_runner_1 = require_fc_runner();
    var operators_1 = require_operators();
    async function runMutationTesting2(sourceFilePath, source, properties, storeDir) {
      const startTime = Date.now();
      const mutants = (0, operators_1.generateMutants)(source, sourceFilePath);
      if (mutants.length === 0) {
        return {
          totalMutants: 0,
          killed: 0,
          survived: 0,
          errors: 0,
          mutationScore: 1,
          results: [],
          survivingMutants: [],
          duration: Date.now() - startTime
        };
      }
      const testsDir = path6.join(storeDir, "tests");
      await fs4.mkdir(testsDir, { recursive: true });
      const quickConfig = {
        mode: "quick",
        iterations: 50,
        // Fewer iterations per mutant for speed
        timeout: 1e4,
        verbose: false
      };
      const results = [];
      const survivingMutants = [];
      for (const mutant of mutants) {
        const ext = path6.extname(sourceFilePath);
        const mutantFileName = `_mutant_${mutant.id}${ext}`;
        const mutantFilePath = path6.join(testsDir, mutantFileName);
        try {
          await fs4.writeFile(mutantFilePath, mutant.mutatedSource, "utf8");
          const generated = (0, fc_codegen_1.generateFastCheckTest)(properties, mutantFilePath, testsDir, quickConfig);
          const testFilePath = path6.join(testsDir, `_mut_test_${mutant.id}.js`);
          await fs4.writeFile(testFilePath, generated.content, "utf8");
          const result = await (0, fc_runner_1.runFastCheckTest)(testFilePath, properties, quickConfig);
          if (result.failed.length > 0) {
            results.push({
              mutantId: mutant.id,
              status: "killed",
              killedBy: result.failed[0].propertyId
            });
          } else if (result.errors.length > 0 && result.passed.length === 0) {
            results.push({
              mutantId: mutant.id,
              status: "killed"
            });
          } else {
            results.push({
              mutantId: mutant.id,
              status: "survived"
            });
            survivingMutants.push(mutant);
          }
          try {
            await fs4.unlink(testFilePath);
          } catch {
          }
        } catch {
          results.push({
            mutantId: mutant.id,
            status: "error"
          });
        } finally {
          try {
            await fs4.unlink(mutantFilePath);
          } catch {
          }
        }
      }
      const killed = results.filter((r) => r.status === "killed").length;
      const survived = results.filter((r) => r.status === "survived").length;
      const errors = results.filter((r) => r.status === "error").length;
      return {
        totalMutants: mutants.length,
        killed,
        survived,
        errors,
        mutationScore: killed + survived > 0 ? killed / (killed + survived) : 1,
        results,
        survivingMutants,
        duration: Date.now() - startTime
      };
    }
  }
});

// ../engines/dist/index.js
var require_dist6 = __commonJS({
  "../engines/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runMutationTesting = exports2.generateMutants = exports2.mapResults = exports2.parseJsonLines = exports2.runProcess = exports2.runHypothesisTest = exports2.generateHypothesisTest = exports2.runFastCheckTest = exports2.generateFastCheckTest = void 0;
    var fc_codegen_1 = require_fc_codegen();
    Object.defineProperty(exports2, "generateFastCheckTest", { enumerable: true, get: function() {
      return fc_codegen_1.generateFastCheckTest;
    } });
    var fc_runner_1 = require_fc_runner();
    Object.defineProperty(exports2, "runFastCheckTest", { enumerable: true, get: function() {
      return fc_runner_1.runFastCheckTest;
    } });
    var hyp_codegen_1 = require_hyp_codegen();
    Object.defineProperty(exports2, "generateHypothesisTest", { enumerable: true, get: function() {
      return hyp_codegen_1.generateHypothesisTest;
    } });
    var hyp_runner_1 = require_hyp_runner();
    Object.defineProperty(exports2, "runHypothesisTest", { enumerable: true, get: function() {
      return hyp_runner_1.runHypothesisTest;
    } });
    var process_runner_1 = require_process_runner();
    Object.defineProperty(exports2, "runProcess", { enumerable: true, get: function() {
      return process_runner_1.runProcess;
    } });
    var result_parser_1 = require_result_parser();
    Object.defineProperty(exports2, "parseJsonLines", { enumerable: true, get: function() {
      return result_parser_1.parseJsonLines;
    } });
    Object.defineProperty(exports2, "mapResults", { enumerable: true, get: function() {
      return result_parser_1.mapResults;
    } });
    var operators_1 = require_operators();
    Object.defineProperty(exports2, "generateMutants", { enumerable: true, get: function() {
      return operators_1.generateMutants;
    } });
    var runner_1 = require_runner();
    Object.defineProperty(exports2, "runMutationTesting", { enumerable: true, get: function() {
      return runner_1.runMutationTesting;
    } });
  }
});

// ../reporter/dist/formatters/property-table.js
var require_property_table = __commonJS({
  "../reporter/dist/formatters/property-table.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatPropertyLine = formatPropertyLine;
    var chalk_1 = __importDefault(require("chalk"));
    function formatPropertyLine(property, outcome) {
      const desc = `${property.targetFunction}: ${property.description}`;
      const padded = desc.padEnd(50);
      if (!outcome) {
        const cat = chalk_1.default.dim(`[${property.category}]`);
        const score = chalk_1.default.dim(`score: ${property.score}/15`);
        return `  ${chalk_1.default.cyan("*")} ${padded} ${cat}  ${score}`;
      }
      switch (outcome.status) {
        case "passed": {
          const iters = `(${outcome.iterations}/${outcome.iterations})`;
          const dur = `${(outcome.duration / 1e3).toFixed(1)}s`;
          return `  ${chalk_1.default.green("\u2713")} ${padded} ${chalk_1.default.green("PASS")} ${chalk_1.default.dim(iters)}  ${chalk_1.default.dim(dur)}`;
        }
        case "failed": {
          return `  ${chalk_1.default.red("\u2717")} ${padded} ${chalk_1.default.red("FAIL")}`;
        }
        case "error": {
          return `  ${chalk_1.default.yellow("\u26A0")} ${padded} ${chalk_1.default.yellow("ERROR")}`;
        }
      }
    }
  }
});

// ../reporter/dist/formatters/counterexample.js
var require_counterexample = __commonJS({
  "../reporter/dist/formatters/counterexample.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatCounterexample = formatCounterexample;
    var chalk_1 = __importDefault(require("chalk"));
    function prettyValue(value) {
      if (value === void 0)
        return "undefined";
      if (value === null)
        return "null";
      if (typeof value === "string")
        return `"${value}"`;
      if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    }
    function formatCounterexample(failure, property) {
      const lines = [];
      let args;
      if (Array.isArray(failure.counterexample)) {
        args = failure.counterexample.map((v) => prettyValue(v)).join(", ");
      } else if (failure.counterexample != null) {
        args = prettyValue(failure.counterexample);
      } else {
        args = "...";
      }
      const funcName = property.targetFunction.split(".").pop() ?? property.targetFunction;
      lines.push(chalk_1.default.red(`    Counterexample: ${funcName}(${args})`));
      if (failure.shrinkSteps > 0) {
        lines.push(chalk_1.default.dim(`    Shrunk to minimal case (${failure.shrinkSteps} shrink steps)`));
      }
      if (failure.errorMessage) {
        const firstLine = failure.errorMessage.split("\n")[0].trim();
        lines.push(chalk_1.default.dim(`    Error: ${firstLine}`));
      }
      lines.push(chalk_1.default.dim(`    Seed: ${failure.seed} (reproduce with --seed ${failure.seed})`));
      return lines.join("\n");
    }
  }
});

// ../reporter/dist/formatters/summary.js
var require_summary = __commonJS({
  "../reporter/dist/formatters/summary.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatSummary = formatSummary;
    exports2.formatCost = formatCost;
    var chalk_1 = __importDefault(require("chalk"));
    function formatSummary(result) {
      const total = result.passed.length + result.failed.length + result.errors.length;
      const passCount = result.passed.length;
      const failCount = result.failed.length;
      const errorCount = result.errors.length;
      const duration = (result.duration / 1e3).toFixed(1);
      const parts = [
        `Properties: ${total}`,
        chalk_1.default.green(`Passed: ${passCount}`)
      ];
      if (failCount > 0) {
        parts.push(chalk_1.default.red(`Failed: ${failCount}`));
      }
      if (errorCount > 0) {
        parts.push(chalk_1.default.yellow(`Errors: ${errorCount}`));
      }
      parts.push(`Duration: ${duration}s`);
      return parts.join(" | ");
    }
    function formatCost(tokensUsed, cost) {
      return chalk_1.default.dim(`Tokens: ${tokensUsed.toLocaleString()} | Cost: $${cost.toFixed(4)}`);
    }
  }
});

// ../reporter/dist/cli-reporter.js
var require_cli_reporter = __commonJS({
  "../reporter/dist/cli-reporter.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.reportInferResult = reportInferResult2;
    exports2.reportRunSummary = reportRunSummary2;
    var chalk_1 = __importDefault(require("chalk"));
    var property_table_1 = require_property_table();
    var counterexample_1 = require_counterexample();
    var summary_1 = require_summary();
    function reportInferResult2(result, filePath) {
      const dur = (result.duration / 1e3).toFixed(1);
      console.log("");
      console.log(chalk_1.default.bold(`  Inferred ${result.properties.length} properties for ${filePath}`) + chalk_1.default.dim(` ($${result.cost.toFixed(4)}, ${dur}s)`));
      console.log("");
      for (const prop of result.properties) {
        console.log((0, property_table_1.formatPropertyLine)(prop));
      }
      console.log("");
      console.log(`  ${(0, summary_1.formatCost)(result.tokensUsed, result.cost)}`);
      console.log("");
    }
    function reportRunSummary2(result, filePath) {
      console.log("");
      console.log(chalk_1.default.bold(`  ${filePath}`));
      const outcomeMap = /* @__PURE__ */ new Map();
      for (const r of result.passed)
        outcomeMap.set(r.propertyId, r);
      for (const f of result.failed)
        outcomeMap.set(f.propertyId, f);
      for (const e of result.errors)
        outcomeMap.set(e.propertyId, e);
      for (const prop of result.properties) {
        const outcome = outcomeMap.get(prop.id);
        console.log((0, property_table_1.formatPropertyLine)(prop, outcome));
        if (outcome && outcome.status === "failed") {
          console.log((0, counterexample_1.formatCounterexample)(outcome, prop));
        }
        if (outcome && outcome.status === "error") {
          console.log(chalk_1.default.yellow(`    ${outcome.errorMessage}`));
        }
      }
      console.log("");
      console.log(`  ${(0, summary_1.formatSummary)(result)}`);
      console.log("");
    }
  }
});

// ../reporter/dist/json-reporter.js
var require_json_reporter = __commonJS({
  "../reporter/dist/json-reporter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.reportAsJson = reportAsJson2;
    function reportAsJson2(result) {
      const report = {
        passed: result.passed.map((p) => ({
          propertyId: p.propertyId,
          iterations: p.iterations,
          duration: p.duration
        })),
        failed: result.failed.map((f) => ({
          propertyId: f.propertyId,
          counterexample: f.counterexample,
          errorMessage: f.errorMessage,
          seed: f.seed
        })),
        errors: result.errors.map((e) => ({
          propertyId: e.propertyId,
          errorMessage: e.errorMessage
        })),
        summary: {
          total: result.passed.length + result.failed.length + result.errors.length,
          passed: result.passed.length,
          failed: result.failed.length,
          errors: result.errors.length,
          duration: result.duration
        }
      };
      return JSON.stringify(report, null, 2);
    }
  }
});

// ../reporter/dist/index.js
var require_dist7 = __commonJS({
  "../reporter/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatPropertyLine = exports2.formatCounterexample = exports2.formatCost = exports2.formatSummary = exports2.reportAsJson = exports2.reportRunSummary = exports2.reportInferResult = void 0;
    var cli_reporter_1 = require_cli_reporter();
    Object.defineProperty(exports2, "reportInferResult", { enumerable: true, get: function() {
      return cli_reporter_1.reportInferResult;
    } });
    Object.defineProperty(exports2, "reportRunSummary", { enumerable: true, get: function() {
      return cli_reporter_1.reportRunSummary;
    } });
    var json_reporter_1 = require_json_reporter();
    Object.defineProperty(exports2, "reportAsJson", { enumerable: true, get: function() {
      return json_reporter_1.reportAsJson;
    } });
    var summary_1 = require_summary();
    Object.defineProperty(exports2, "formatSummary", { enumerable: true, get: function() {
      return summary_1.formatSummary;
    } });
    Object.defineProperty(exports2, "formatCost", { enumerable: true, get: function() {
      return summary_1.formatCost;
    } });
    var counterexample_1 = require_counterexample();
    Object.defineProperty(exports2, "formatCounterexample", { enumerable: true, get: function() {
      return counterexample_1.formatCounterexample;
    } });
    var property_table_1 = require_property_table();
    Object.defineProperty(exports2, "formatPropertyLine", { enumerable: true, get: function() {
      return property_table_1.formatPropertyLine;
    } });
  }
});

// src/index.ts
var import_commander = require("commander");

// src/commands/init.ts
var path = __toESM(require("path"));
var import_store = __toESM(require_dist());
async function initCommand() {
  const projectRoot = process.cwd();
  try {
    const result = await (0, import_store.initStore)(projectRoot);
    if (result.created) {
      console.log(`
  Created ${path.relative(projectRoot, result.path)}/`);
      console.log("  Directory structure:");
      console.log("    .propcheck/");
      console.log("    .propcheck/properties.json");
      console.log("    .propcheck/tests/");
      console.log("    .propcheck/corpus/");
      console.log("    .propcheck/reports/");
      console.log("\n  Next steps:");
      console.log("    1. Add .propcheck/config.json to .gitignore");
      console.log("    2. Run: propcheck infer src/yourfile.ts");
      console.log("");
    } else {
      console.log("\n  .propcheck/ already exists \u2014 validated structure.");
      console.log("");
    }
  } catch (err) {
    console.error(`
  Error initializing: ${err.message}
`);
    process.exit(2);
  }
}

// src/commands/infer.ts
var fs = __toESM(require("fs/promises"));
var path2 = __toESM(require("path"));
var import_config = __toESM(require_dist2());
var import_parser = __toESM(require_dist3());
var import_llm = __toESM(require_dist5());
var import_store2 = __toESM(require_dist());
var import_engines = __toESM(require_dist6());
var import_reporter = __toESM(require_dist7());
var import_common = __toESM(require_dist4());
var MAX_REPAIR_ROUNDS = 3;
async function trialRunValidation(properties, targetPath, storeDir, sourceCode, llmClient, isMock) {
  const testsDir = path2.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });
  const trialConfig = {
    mode: "quick",
    iterations: 100,
    timeout: 15e3,
    verbose: false
  };
  let currentProperties = [...properties];
  const validated = [];
  const dropped = [];
  let totalRepaired = 0;
  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    if (currentProperties.length === 0) break;
    const generated = (0, import_engines.generateFastCheckTest)(currentProperties, targetPath, testsDir, trialConfig);
    const testFilePath = path2.join(testsDir, generated.fileName);
    await fs.writeFile(testFilePath, generated.content, "utf8");
    const result = await (0, import_engines.runFastCheckTest)(testFilePath, currentProperties, trialConfig);
    try {
      await fs.unlink(testFilePath);
    } catch {
    }
    const passedIds = new Set(result.passed.map((p) => p.propertyId));
    const failedIds = new Set(result.failed.map((f) => f.propertyId));
    const errorIds = new Set(result.errors.map((e) => e.propertyId));
    const needsRepair = [];
    for (const prop of currentProperties) {
      if (passedIds.has(prop.id)) {
        validated.push(prop);
      } else if (failedIds.has(prop.id)) {
        validated.push(prop);
      } else if (errorIds.has(prop.id)) {
        const err = result.errors.find((e) => e.propertyId === prop.id);
        const errorMsg = err?.errorMessage ?? "unknown error";
        if (round < MAX_REPAIR_ROUNDS) {
          const funcSig = `${prop.targetFunction}(...)`;
          let repaired = null;
          if (isMock) {
            repaired = (0, import_llm.mockRepairProperty)(prop, errorMsg);
          } else if (llmClient) {
            repaired = await (0, import_llm.repairProperty)(llmClient, prop, errorMsg, sourceCode, funcSig);
          }
          if (repaired) {
            needsRepair.push(repaired);
            totalRepaired++;
            console.log(`    \u21BB Repairing: ${prop.targetFunction}: ${prop.description} (round ${round + 1})`);
          } else {
            dropped.push({ prop, reason: `codegen error (repair failed round ${round + 1}): ${errorMsg.slice(0, 60)}` });
          }
        } else {
          dropped.push({ prop, reason: `codegen error (max ${MAX_REPAIR_ROUNDS} repairs): ${errorMsg.slice(0, 60)}` });
        }
      } else {
        dropped.push({ prop, reason: "no output from trial run" });
      }
    }
    currentProperties = needsRepair;
  }
  return { validated, dropped, repaired: totalRepaired };
}
async function inferCommand(target, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config.loadConfig)(projectRoot, {
    mock: options.mock,
    model: options.model
  });
  const errors = (0, import_config.validateConfig)(config, "infer");
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`
  Error: ${err}
`);
    }
    process.exit(2);
  }
  await (0, import_store2.initStore)(projectRoot, config.storeDir);
  const storeDir = path2.join(projectRoot, config.storeDir);
  const targetPath = path2.resolve(projectRoot, target);
  if (!targetPath.startsWith(projectRoot + path2.sep) && targetPath !== projectRoot) {
    console.error(`
  Error: Target file must be within the project root.
`);
    process.exit(2);
  }
  try {
    await fs.access(targetPath);
  } catch {
    console.error(`
  Error: File not found: ${target}
`);
    process.exit(2);
  }
  const language = (0, import_parser.detectLanguage)(targetPath);
  if (!language || !["typescript", "javascript", "python"].includes(language)) {
    console.error(`
  Error: Unsupported file type. Supported: .ts, .tsx, .js, .jsx, .py
`);
    process.exit(2);
  }
  const MAX_SOURCE_BYTES = 5e5;
  const stat2 = await fs.stat(targetPath);
  if (stat2.size > MAX_SOURCE_BYTES) {
    console.error(`
  Error: File too large (${stat2.size} bytes). Max: ${MAX_SOURCE_BYTES} bytes.
`);
    process.exit(2);
  }
  const source = await fs.readFile(targetPath, "utf8");
  const context = language === "python" ? (0, import_parser.analyzePythonFile)(targetPath, source) : (0, import_parser.analyzeFile)(targetPath, source, language);
  if (context.functions.length === 0) {
    console.log(`
  No exported functions found in ${target}
`);
    return;
  }
  console.log(`
  Analyzing ${context.functions.length} functions in ${target}...`);
  const result = await (0, import_llm.inferProperties)(config.apiKey, config.model, context, {
    maxProperties: (() => {
      const n = parseInt(options.maxProperties ?? "5", 10);
      return Number.isNaN(n) ? 5 : n;
    })(),
    minScore: (() => {
      const n = parseInt(options.minScore ?? "10", 10);
      return Number.isNaN(n) ? 10 : n;
    })(),
    mock: config.mock
  });
  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }
  let finalProperties = result.properties;
  if (!options.skipValidation && language !== "python") {
    const testsDir = path2.join(storeDir, "tests");
    await fs.mkdir(testsDir, { recursive: true });
    console.log(`  Validating ${result.properties.length} properties (trial run, 100 iterations)...`);
    const llmClient = config.mock ? null : config.apiKey ? (0, import_llm.createLlmClient)(config.apiKey, config.model) : null;
    const { validated, dropped, repaired } = await trialRunValidation(
      result.properties,
      targetPath,
      storeDir,
      source,
      llmClient,
      config.mock
    );
    if (repaired > 0) {
      console.log(`  Self-repaired ${repaired} properties.`);
    }
    if (dropped.length > 0) {
      console.log(`  Dropped ${dropped.length} properties during validation:`);
      for (const { prop, reason } of dropped) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason}]`);
      }
    }
    finalProperties = validated;
    if (finalProperties.length === 0) {
      console.log("  No properties survived validation.\n");
      return;
    }
    if (options.refine && finalProperties.length > 0) {
      console.log(`
  Refinement Round 2: analyzing ${finalProperties.length} properties...`);
      const fullConfig = { mode: "quick", iterations: 100, timeout: 15e3, verbose: false };
      const execGenerated = (0, import_engines.generateFastCheckTest)(finalProperties, targetPath, testsDir, fullConfig);
      const execTestPath = path2.join(testsDir, execGenerated.fileName);
      await fs.writeFile(execTestPath, execGenerated.content, "utf8");
      const execResult = await (0, import_engines.runFastCheckTest)(execTestPath, finalProperties, fullConfig);
      try {
        await fs.unlink(execTestPath);
      } catch {
      }
      const classifications = (0, import_llm.classifyProperties)(finalProperties, execResult);
      const functionNames = context.functions.map((f) => f.qualifiedName);
      const feedback = (0, import_llm.buildFeedbackSummary)(classifications, functionNames);
      const strong = classifications.filter((c) => c.kind === "strong");
      const weak = classifications.filter((c) => c.kind === "weak");
      const bugs = classifications.filter((c) => c.kind === "bug_found");
      console.log(`    Strong: ${strong.length} | Weak: ${weak.length} | Bugs: ${bugs.length}`);
      if (weak.length > 0 || bugs.length > 0) {
        let improvedProperties;
        if (config.mock) {
          improvedProperties = (0, import_llm.mockRefineProperties)(classifications);
        } else if (llmClient) {
          const refineResult = await (0, import_llm.inferProperties)(config.apiKey, config.model, context, {
            maxProperties: parseInt(options.maxProperties ?? "5", 10),
            minScore: parseInt(options.minScore ?? "10", 10),
            mock: false
          });
          improvedProperties = refineResult.properties;
        } else {
          improvedProperties = [];
        }
        if (improvedProperties.length > 0) {
          console.log(`    Generated ${improvedProperties.length} improved properties`);
          const { validated: improvedValidated } = await trialRunValidation(
            improvedProperties,
            targetPath,
            storeDir,
            source,
            llmClient,
            config.mock
          );
          const strongProps = classifications.filter((c) => c.kind === "strong" || c.kind === "bug_found").map((c) => c.property);
          const existingAssertions = new Set(strongProps.map((p) => p.assertion));
          const newUnique = improvedValidated.filter((p) => !existingAssertions.has(p.assertion));
          finalProperties = [...strongProps, ...newUnique];
          console.log(`    Final: ${finalProperties.length} properties after refinement`);
        }
      } else {
        console.log(`    All properties are strong \u2014 no refinement needed`);
      }
    }
  }
  const moduleKey = (0, import_common.toForwardSlash)(path2.relative(projectRoot, targetPath));
  const propertySet = {
    module: moduleKey,
    filePath: moduleKey,
    properties: finalProperties,
    sourceHash: (0, import_common.hashContent)(source),
    inferredAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await (0, import_store2.setProperties)(storeDir, moduleKey, propertySet);
  const finalResult = { ...result, properties: finalProperties };
  (0, import_reporter.reportInferResult)(finalResult, moduleKey);
}

// src/commands/run.ts
var fs2 = __toESM(require("fs/promises"));
var path3 = __toESM(require("path"));
var import_config2 = __toESM(require_dist2());
var import_store3 = __toESM(require_dist());
var import_engines2 = __toESM(require_dist6());
var import_reporter2 = __toESM(require_dist7());
var import_common2 = __toESM(require_dist4());
async function runCommand(target, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config2.loadConfig)(projectRoot);
  const storeDir = path3.join(projectRoot, config.storeDir);
  const mode = options.quick ? "quick" : options.thorough ? "thorough" : "default";
  const runConfig = {
    mode,
    iterations: import_common2.RUN_MODE_ITERATIONS[mode],
    timeout: config.timeout,
    seed: options.seed ? Number.isNaN(parseInt(options.seed, 10)) ? void 0 : parseInt(options.seed, 10) : void 0,
    verbose: false
  };
  let propertySets;
  if (options.changed) {
    const changedFiles = (0, import_common2.getChangedFiles)(projectRoot);
    const changedPaths = new Set(changedFiles.map((f) => (0, import_common2.toForwardSlash)(f.filePath)));
    if (changedPaths.size === 0) {
      console.log("\n  No changes detected (git diff is clean).\n");
      process.exit(0);
    }
    const allSets = await (0, import_store3.getAllProperties)(storeDir);
    propertySets = allSets.filter((ps) => changedPaths.has(ps.filePath));
    if (propertySets.length === 0) {
      console.log(`
  No properties found for changed files: ${[...changedPaths].join(", ")}`);
      console.log("  Run: propcheck infer <file> first.\n");
      process.exit(0);
    }
    console.log(`
  Running properties for ${propertySets.length} changed file(s)...
`);
  } else if (target) {
    const targetPath = path3.resolve(projectRoot, target);
    const moduleKey = (0, import_common2.toForwardSlash)(path3.relative(projectRoot, targetPath));
    const ps = await (0, import_store3.getProperties)(storeDir, moduleKey);
    if (!ps) {
      console.error(`
  No properties found for ${target}`);
      console.error("  Run: propcheck infer " + target + "\n");
      process.exit(2);
    }
    propertySets = [ps];
  } else {
    propertySets = await (0, import_store3.getAllProperties)(storeDir);
    if (propertySets.length === 0) {
      console.error("\n  No properties found. Run: propcheck infer <file>\n");
      process.exit(2);
    }
  }
  let exitCode = 0;
  for (const ps of propertySets) {
    const filePath = path3.resolve(projectRoot, ps.filePath);
    try {
      const currentSource = await fs2.readFile(filePath, "utf8");
      const currentHash = (0, import_common2.hashContent)(currentSource);
      if (ps.sourceHash !== currentHash) {
        console.log(`
  Warning: ${ps.filePath} has changed since properties were inferred.`);
        console.log("  Run: propcheck infer " + ps.filePath + " to re-infer.\n");
      }
    } catch {
      console.error(`
  Warning: Cannot read ${ps.filePath} \u2014 file may have been moved.
`);
    }
    const testsDir = path3.join(storeDir, "tests");
    await fs2.mkdir(testsDir, { recursive: true });
    const isPython = ps.filePath.endsWith(".py");
    const generated = isPython ? (0, import_engines2.generateHypothesisTest)(ps.properties, filePath, testsDir, runConfig) : (0, import_engines2.generateFastCheckTest)(ps.properties, filePath, testsDir, runConfig);
    const testFilePath = path3.join(testsDir, generated.fileName);
    await fs2.writeFile(testFilePath, generated.content, "utf8");
    const result = isPython ? await (0, import_engines2.runHypothesisTest)(testFilePath, ps.properties, runConfig) : await (0, import_engines2.runFastCheckTest)(testFilePath, ps.properties, runConfig);
    if (options.json) {
      console.log((0, import_reporter2.reportAsJson)(result));
    } else {
      (0, import_reporter2.reportRunSummary)(result, ps.filePath);
    }
    if (result.failed.length > 0 || result.errors.length > 0) {
      exitCode = 1;
    }
  }
  process.exit(exitCode);
}

// src/commands/badge.ts
var path4 = __toESM(require("path"));
var import_config3 = __toESM(require_dist2());
var import_store4 = __toESM(require_dist());
async function badgeCommand() {
  const projectRoot = process.cwd();
  const config = (0, import_config3.loadConfig)(projectRoot);
  const storeDir = path4.join(projectRoot, config.storeDir);
  const allProps = await (0, import_store4.getAllProperties)(storeDir);
  const totalProperties = allProps.reduce(
    (sum, ps) => sum + ps.properties.length,
    0
  );
  if (totalProperties === 0) {
    console.error("\n  No properties found. Run: propcheck infer <file> first.\n");
    process.exit(2);
  }
  const encoded = encodeURIComponent(`${totalProperties} properties verified`);
  const badge = `[![propcheck](https://img.shields.io/badge/propcheck-${encoded}-brightgreen)](https://github.com/propcheck/propcheck)`;
  console.log("\n  Add this badge to your README.md:\n");
  console.log(`  ${badge}`);
  console.log("");
}

// src/commands/quality.ts
var fs3 = __toESM(require("fs/promises"));
var path5 = __toESM(require("path"));
var import_config4 = __toESM(require_dist2());
var import_store5 = __toESM(require_dist());
var import_engines3 = __toESM(require_dist6());
var import_common3 = __toESM(require_dist4());
var import_chalk = __toESM(require("chalk"));
async function qualityCommand(target) {
  const projectRoot = process.cwd();
  const config = (0, import_config4.loadConfig)(projectRoot);
  const storeDir = path5.join(projectRoot, config.storeDir);
  const targetPath = path5.resolve(projectRoot, target);
  try {
    await fs3.access(targetPath);
  } catch {
    console.error(`
  Error: File not found: ${target}
`);
    process.exit(2);
  }
  const moduleKey = (0, import_common3.toForwardSlash)(path5.relative(projectRoot, targetPath));
  const ps = await (0, import_store5.getProperties)(storeDir, moduleKey);
  if (!ps || ps.properties.length === 0) {
    console.error(`
  No properties found for ${target}`);
    console.error("  Run: propcheck infer " + target + " first\n");
    process.exit(2);
  }
  const source = await fs3.readFile(targetPath, "utf8");
  const mutants = (0, import_engines3.generateMutants)(source, targetPath);
  console.log(`
  ${import_chalk.default.bold("Mutation Testing")}: ${target}`);
  console.log(`  Generated ${import_chalk.default.cyan(String(mutants.length))} mutants from ${mutants.length > 0 ? new Set(mutants.map((m) => m.operator)).size : 0} operators`);
  console.log(`  Testing against ${import_chalk.default.cyan(String(ps.properties.length))} properties...
`);
  if (mutants.length === 0) {
    console.log("  No mutants generated (file may be too simple).\n");
    return;
  }
  const report = await (0, import_engines3.runMutationTesting)(targetPath, source, ps.properties, storeDir);
  printReport(report, target);
  process.exit(report.mutationScore >= 0.8 ? 0 : 1);
}
function printReport(report, target) {
  const scoreColor = report.mutationScore >= 0.8 ? import_chalk.default.green : report.mutationScore >= 0.6 ? import_chalk.default.yellow : import_chalk.default.red;
  const scorePercent = (report.mutationScore * 100).toFixed(1);
  console.log(`  ${import_chalk.default.bold("Results")}:`);
  console.log(`    Total mutants:  ${report.totalMutants}`);
  console.log(`    ${import_chalk.default.green("Killed")}:         ${report.killed} (${(report.killed / report.totalMutants * 100).toFixed(1)}%)`);
  console.log(`    ${import_chalk.default.red("Survived")}:       ${report.survived} (${(report.survived / report.totalMutants * 100).toFixed(1)}%)`);
  if (report.errors > 0) {
    console.log(`    ${import_chalk.default.yellow("Errors")}:         ${report.errors}`);
  }
  console.log(`    ${import_chalk.default.bold("Mutation score")}: ${scoreColor(scorePercent + "%")}`);
  console.log(`    Duration:       ${(report.duration / 1e3).toFixed(1)}s`);
  if (report.survivingMutants.length > 0) {
    console.log(`
  ${import_chalk.default.yellow("Surviving mutants")} (properties missed these):`);
    for (const mutant of report.survivingMutants.slice(0, 10)) {
      console.log(`    ${import_chalk.default.dim("\u2022")} ${mutant.description}`);
    }
    if (report.survivingMutants.length > 10) {
      console.log(`    ${import_chalk.default.dim(`... and ${report.survivingMutants.length - 10} more`)}`);
    }
    console.log(`
  ${import_chalk.default.yellow("\u2192")} These surviving mutants indicate areas where your properties could be stronger.`);
    console.log(`  ${import_chalk.default.yellow("\u2192")} Consider adding properties that would catch these changes.
`);
  } else {
    console.log(`
  ${import_chalk.default.green("\u2713")} All mutants killed! Your properties are comprehensive.
`);
  }
}

// src/index.ts
var program = new import_commander.Command();
program.name("propcheck").description("AI-powered property-based testing \u2014 find bugs your tests miss").version("0.1.0");
program.command("init").description("Initialize .propcheck/ directory in the current project").action(initCommand);
program.command("infer <target>").description("Infer testable properties for target file(s) using LLM").option("--mock", "Use mock LLM client (no API key needed)").option("--model <model>", "LLM model to use", "claude-sonnet-4-20250514").option("--max-properties <n>", "Max properties per function", "5").option("--min-score <n>", "Minimum quality score (0-15)", "10").option("--skip-validation", "Skip trial-run validation of inferred properties").option("--refine", "Enable refinement loop (Round 2): strengthen weak properties").action(inferCommand);
program.command("run [target]").description("Run property tests against target file(s)").option("--quick", "Quick mode: 100 iterations").option("--thorough", "Thorough mode: 10,000 iterations").option("--seed <n>", "Random seed for reproducibility").option("--json", "Output results as JSON").option("--changed", "Only run properties for git-changed files").action(runCommand);
program.command("badge").description("Output markdown badge snippet for your README").action(badgeCommand);
program.command("quality <target>").description("Measure property effectiveness via mutation testing").action(qualityCommand);
program.parse();
//# sourceMappingURL=index.js.map