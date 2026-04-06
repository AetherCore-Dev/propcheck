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
    exports2.getProperties = getProperties6;
    exports2.getAllProperties = getAllProperties4;
    exports2.setProperties = setProperties3;
    exports2.isStale = isStale;
    exports2.removeProperties = removeProperties;
    var fs6 = __importStar(require("fs/promises"));
    var path10 = __importStar(require("path"));
    var crypto2 = __importStar(require("crypto"));
    var PROPERTIES_FILE = "properties.json";
    var FILE_VERSION = 2;
    var LEGACY_RISK_PENALTIES = {
      float_exact_equality: 3,
      tiny_abs_tolerance: 2,
      missing_precondition: 1,
      wide_numeric_domain: 2,
      doc_domain_mismatch: 2,
      roundtrip_numeric_fragility: 3,
      metamorphic_scale_risk: 1
    };
    function propertiesPath(storeDir) {
      return path10.join(storeDir, PROPERTIES_FILE);
    }
    function computeLegacyRiskScore(score, riskTags) {
      const penalty = riskTags.reduce((sum, tag) => sum + LEGACY_RISK_PENALTIES[tag], 0);
      return Math.max(0, score - penalty);
    }
    function normalizeProperty(property) {
      const riskTags = Object.freeze([...property.riskTags ?? []]);
      return {
        ...property,
        riskScore: property.riskScore ?? computeLegacyRiskScore(property.score, riskTags),
        riskTags,
        status: property.status ?? "accepted",
        ...property.validation ? { validation: property.validation } : {},
        ...property.humanVerified !== void 0 ? { humanVerified: property.humanVerified } : {}
      };
    }
    function normalizePropertySet(propertySet) {
      return {
        schemaVersion: 2,
        module: propertySet.module,
        filePath: propertySet.filePath,
        properties: Object.freeze(propertySet.properties.map(normalizeProperty)),
        sourceHash: propertySet.sourceHash,
        inferredAt: propertySet.inferredAt
      };
    }
    function normalizePropertiesFile(file) {
      const version = file.version ?? 1;
      if (version > FILE_VERSION) {
        throw new Error(`Unsupported properties file version ${version}. Current CLI supports up to ${FILE_VERSION}.`);
      }
      return {
        version: FILE_VERSION,
        modules: Object.fromEntries(Object.entries(file.modules ?? {}).map(([module3, propertySet]) => [module3, normalizePropertySet(propertySet)]))
      };
    }
    async function readPropertiesFile(storeDir) {
      const filePath = propertiesPath(storeDir);
      try {
        const content = await fs6.readFile(filePath, "utf8");
        return normalizePropertiesFile(JSON.parse(content));
      } catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
          return { version: FILE_VERSION, modules: {} };
        }
        throw new Error(`Failed to read properties file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    async function writePropertiesFile(storeDir, data) {
      const filePath = propertiesPath(storeDir);
      const tmpName = `.tmp-${crypto2.randomBytes(8).toString("hex")}.json`;
      const tmpPath = path10.join(storeDir, tmpName);
      const content = JSON.stringify(data, null, 2);
      await fs6.writeFile(tmpPath, content, "utf8");
      await fs6.rename(tmpPath, filePath);
    }
    async function getProperties6(storeDir, module3) {
      const file = await readPropertiesFile(storeDir);
      return file.modules[module3] ?? null;
    }
    async function getAllProperties4(storeDir) {
      const file = await readPropertiesFile(storeDir);
      return Object.values(file.modules);
    }
    async function setProperties3(storeDir, module3, propertySet) {
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
    var fs6 = __importStar(require("fs/promises"));
    var path10 = __importStar(require("path"));
    var TESTS_DIR = "tests";
    function testsPath(storeDir) {
      return path10.join(storeDir, TESTS_DIR);
    }
    async function writeTestFile(storeDir, fileName, content) {
      const dir = testsPath(storeDir);
      await fs6.mkdir(dir, { recursive: true });
      const filePath = path10.join(dir, fileName);
      await fs6.writeFile(filePath, content, "utf8");
      return filePath;
    }
    async function readTestFile(storeDir, fileName) {
      const filePath = path10.join(testsPath(storeDir), fileName);
      return fs6.readFile(filePath, "utf8");
    }
    async function listTestFiles(storeDir) {
      const dir = testsPath(storeDir);
      try {
        const entries = await fs6.readdir(dir);
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
    var fs6 = __importStar(require("fs/promises"));
    var path10 = __importStar(require("path"));
    var CORPUS_DIR = "corpus";
    function corpusPath(storeDir, functionName) {
      const safeName = functionName.replace(/[^a-zA-Z0-9._-]/g, "_");
      return path10.join(storeDir, CORPUS_DIR, `${safeName}.json`);
    }
    async function getSeeds(storeDir, functionName) {
      const filePath = corpusPath(storeDir, functionName);
      try {
        const content = await fs6.readFile(filePath, "utf8");
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
      const dir = path10.join(storeDir, CORPUS_DIR);
      await fs6.mkdir(dir, { recursive: true });
      await fs6.writeFile(corpusPath(storeDir, functionName), JSON.stringify(merged, null, 2), "utf8");
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
    var fs6 = __importStar(require("fs/promises"));
    var path10 = __importStar(require("path"));
    var SUBDIRS = ["tests", "corpus", "reports"];
    async function initStore3(projectRoot, storeDir = ".propcheck") {
      const storePath = path10.join(projectRoot, storeDir);
      try {
        const stat3 = await fs6.stat(storePath);
        if (stat3.isDirectory()) {
          for (const sub of SUBDIRS) {
            await fs6.mkdir(path10.join(storePath, sub), { recursive: true });
          }
          return { created: false, path: storePath };
        }
      } catch {
      }
      await fs6.mkdir(storePath, { recursive: true });
      for (const sub of SUBDIRS) {
        await fs6.mkdir(path10.join(storePath, sub), { recursive: true });
      }
      const propertiesPath = path10.join(storePath, "properties.json");
      await fs6.writeFile(propertiesPath, JSON.stringify({ version: 2, modules: {} }, null, 2), "utf8");
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
      provider: "anthropic",
      baseURL: null,
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
    exports2.loadConfig = loadConfig8;
    exports2.validateConfig = validateConfig3;
    var fs6 = __importStar(require("fs"));
    var path10 = __importStar(require("path"));
    var zod_1 = require("zod");
    var defaults_1 = require_defaults();
    var PropcheckRcSchema = zod_1.z.object({
      apiKey: zod_1.z.string().optional(),
      model: zod_1.z.string().optional(),
      provider: zod_1.z.enum(["anthropic", "openai-compatible"]).optional(),
      baseURL: zod_1.z.string().url().optional(),
      maxPropertiesPerFunction: zod_1.z.number().int().min(1).max(20).optional(),
      minScore: zod_1.z.number().int().min(0).max(13).optional(),
      defaultMode: zod_1.z.enum(["quick", "default", "thorough"]).optional(),
      timeout: zod_1.z.number().int().min(1e3).max(3e5).optional(),
      storeDir: zod_1.z.string().regex(/^[a-zA-Z0-9_][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9_][a-zA-Z0-9._-]*)*$/, "storeDir must be a relative path without traversal (no '..' components)").optional(),
      mock: zod_1.z.boolean().optional()
    }).strict();
    function loadConfig8(projectRoot, overrides = {}) {
      let config = { ...defaults_1.DEFAULTS };
      const rcPath = path10.join(projectRoot, ".propcheckrc");
      if (fs6.existsSync(rcPath)) {
        try {
          const rcContent = fs6.readFileSync(rcPath, "utf8");
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
      const envApiKey = process.env["PROPCHECK_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? process.env["OPENAI_API_KEY"];
      const envMock = process.env["PROPCHECK_MOCK"];
      const envBaseURL = process.env["PROPCHECK_BASE_URL"] ?? process.env["ANTHROPIC_BASE_URL"] ?? process.env["OPENAI_BASE_URL"];
      const envProvider = process.env["PROPCHECK_PROVIDER"];
      if (envApiKey) {
        config = { ...config, apiKey: envApiKey };
      }
      if (envMock === "true" || envMock === "1") {
        config = { ...config, mock: true };
      }
      if (envBaseURL) {
        config = { ...config, baseURL: envBaseURL };
      }
      if (envProvider === "anthropic" || envProvider === "openai-compatible") {
        config = { ...config, provider: envProvider };
      }
      if (config.baseURL && !envProvider && !overrides.provider) {
        const url = config.baseURL.toLowerCase();
        if (url.includes("openrouter.ai") || url.includes("openai.com")) {
          config = { ...config, provider: "openai-compatible" };
        }
      }
      if (overrides.apiKey !== void 0) {
        config = { ...config, apiKey: overrides.apiKey };
      }
      if (overrides.model !== void 0) {
        config = { ...config, model: overrides.model };
      }
      if (overrides.provider !== void 0) {
        config = { ...config, provider: overrides.provider };
      }
      if (overrides.baseURL !== void 0) {
        config = { ...config, baseURL: overrides.baseURL };
      }
      if (overrides.mock !== void 0) {
        config = { ...config, mock: overrides.mock };
      }
      if (overrides.mode !== void 0) {
        config = { ...config, defaultMode: overrides.mode };
      }
      return Object.freeze(config);
    }
    function validateConfig3(config, command) {
      const errors = [];
      if ((command === "infer" || command === "fix") && !config.mock && !config.apiKey) {
        errors.push('API key is required for property inference.\nSet it via one of:\n  export PROPCHECK_API_KEY=sk-...      # any provider\n  export ANTHROPIC_API_KEY=sk-ant-...  # Anthropic direct\n  export OPENAI_API_KEY=sk-or-...      # OpenRouter / OpenAI-compatible\nOr add "apiKey" to .propcheckrc\nOr use --mock for offline testing with canned responses.');
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
      provider: "anthropic",
      baseURL: null,
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
    exports2.hashContent = hashContent4;
    var node_crypto_1 = require("crypto");
    function hashContent4(content) {
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
    exports2.toForwardSlash = toForwardSlash7;
    exports2.resolveForward = resolveForward;
    exports2.relativeForward = relativeForward;
    exports2.importPath = importPath;
    var path10 = __importStar(require("path"));
    function toForwardSlash7(filePath) {
      return filePath.replace(/\\/g, "/");
    }
    function resolveForward(...segments) {
      return toForwardSlash7(path10.resolve(...segments));
    }
    function relativeForward(from, to) {
      const rel = path10.relative(from, to);
      return toForwardSlash7(rel);
    }
    function importPath(fromFile, toFile) {
      const fromDir = path10.dirname(fromFile);
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
        const diffResult = (0, node_child_process_1.spawnSync)("git", ["diff", "HEAD", "--unified=0", "--diff-filter=ACMR", "--name-only"], { cwd, encoding: "utf8", timeout: 1e4 });
        if (diffResult.status !== 0) {
          return {
            status: "git_error",
            files: [],
            errorMessage: diffResult.stderr?.trim() || `git diff exited with code ${diffResult.status}`
          };
        }
        diffOutput = diffResult.stdout;
      } catch (err) {
        return {
          status: "git_error",
          files: [],
          errorMessage: err instanceof Error ? err.message : "git not available"
        };
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
      return { status: "ok", files: result };
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
      /\bfetch\s*\(/,
      // fetch() API — async data exfiltration
      /\bXMLHttpRequest\b/,
      // XHR constructor
      /\bWebSocket\b/,
      // WebSocket constructor
      /\bsetTimeout\s*\(/,
      // Async side-effect via timer
      /\bsetInterval\s*\(/,
      // Async side-effect via timer
      /\bPromise\s*\./,
      // Promise chain (can wrap exfil calls)
      /\bnew\s+Function\b/,
      // new Function()
      /;\s*\w/,
      // Statement separator followed by identifier (multi-statement)
      /[\r\n\u2028\u2029]/,
      // Newlines / line separators (multi-statement via newline)
      /\/\//,
      // Single-line comment (could prematurely end assertion line)
      /\/\*/
      // Block comment open (could swallow surrounding code)
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

// ../common/dist/utils/file-scanner.js
var require_file_scanner = __commonJS({
  "../common/dist/utils/file-scanner.js"(exports2) {
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
    exports2.findSourceFiles = findSourceFiles3;
    var fs6 = __importStar(require("fs"));
    var path10 = __importStar(require("path"));
    var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);
    var IGNORED_DIRS = /* @__PURE__ */ new Set([
      "node_modules",
      ".propcheck",
      "dist",
      "dist-bundle",
      "build",
      ".git",
      ".next",
      ".nuxt",
      "__pycache__",
      ".venv",
      "venv",
      "coverage",
      ".turbo",
      ".cache"
    ]);
    function findSourceFiles3(dir) {
      const results = [];
      function walk(currentDir) {
        let entries;
        try {
          entries = fs6.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
              walk(path10.join(currentDir, entry.name));
            }
          } else if (entry.isFile()) {
            const ext = path10.extname(entry.name);
            if (SOURCE_EXTENSIONS.has(ext) && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".spec.ts") && !entry.name.endsWith(".test.js") && !entry.name.endsWith(".spec.js")) {
              results.push(path10.join(currentDir, entry.name));
            }
          }
        }
      }
      walk(dir);
      return results;
    }
  }
});

// ../common/dist/utils/deep-equal.js
var require_deep_equal = __commonJS({
  "../common/dist/utils/deep-equal.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.deepEqual = deepEqual2;
    function deepEqual2(a, b) {
      if (a === b)
        return true;
      if (a === null || b === null)
        return false;
      if (typeof a !== typeof b)
        return false;
      if (typeof a !== "object")
        return false;
      if (Array.isArray(a)) {
        if (!Array.isArray(b))
          return false;
        if (a.length !== b.length)
          return false;
        return a.every((val, i) => deepEqual2(val, b[i]));
      }
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length)
        return false;
      return keysA.every((key) => deepEqual2(a[key], b[key]));
    }
  }
});

// ../common/dist/index.js
var require_dist4 = __commonJS({
  "../common/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.deepEqual = exports2.findSourceFiles = exports2.validateGeneratorKey = exports2.validateAssertion = exports2.getChangedFunctions = exports2.getChangedFiles = exports2.importPath = exports2.relativeForward = exports2.resolveForward = exports2.toForwardSlash = exports2.hashContent = exports2.EngineError = exports2.LlmError = exports2.ParseError = exports2.PropcheckError = exports2.DEFAULT_CONFIG = exports2.RUN_MODE_ITERATIONS = void 0;
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
    var file_scanner_1 = require_file_scanner();
    Object.defineProperty(exports2, "findSourceFiles", { enumerable: true, get: function() {
      return file_scanner_1.findSourceFiles;
    } });
    var deep_equal_1 = require_deep_equal();
    Object.defineProperty(exports2, "deepEqual", { enumerable: true, get: function() {
      return deep_equal_1.deepEqual;
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
    exports2.createLlmClient = createLlmClient;
    var sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
    var common_1 = require_dist4();
    var RETRY_DELAYS = [1e3, 2e3, 4e3];
    function createLlmClient(apiKey, model, baseURL) {
      const client = new sdk_1.default({
        apiKey,
        ...baseURL ? { baseURL } : {}
      });
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
      return new Promise((resolve7) => setTimeout(resolve7, ms));
    }
  }
});

// ../llm/dist/openai-client.js
var require_openai_client = __commonJS({
  "../llm/dist/openai-client.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createOpenAIClient = createOpenAIClient;
    var common_1 = require_dist4();
    var RETRY_DELAYS = [1e3, 2e3, 4e3];
    function toOpenAITools(tools) {
      return tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }
      }));
    }
    function createOpenAIClient(apiKey, model, baseURL = "https://openrouter.ai/api/v1") {
      const base = baseURL.replace(/\/+$/, "");
      const endpoint = `${base}/chat/completions`;
      return {
        async call(systemPrompt, userPrompt, tools, options = {}) {
          const maxTokens = options.maxTokens ?? 4096;
          const temperature = options.temperature ?? 0.2;
          const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ];
          const openaiTools = toOpenAITools(tools);
          const body = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature
          };
          if (openaiTools.length > 0) {
            body.tools = openaiTools;
            body.tool_choice = {
              type: "function",
              function: { name: tools[0].name }
            };
          }
          let lastError;
          for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
            try {
              const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                  // OpenRouter-specific headers (harmless for other providers)
                  "HTTP-Referer": "https://github.com/AetherCore-Dev/propcheck",
                  "X-Title": "propcheck"
                },
                body: JSON.stringify(body)
              });
              if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                if (response.status === 401 || response.status === 403) {
                  throw new common_1.LlmError("Invalid API key", {
                    code: "AUTH_ERROR",
                    status: response.status
                  });
                }
                if ((response.status === 429 || response.status >= 500) && attempt < RETRY_DELAYS.length) {
                  await sleep(RETRY_DELAYS[attempt]);
                  continue;
                }
                throw new common_1.LlmError(`API request failed: ${response.status} ${response.statusText} - ${errorText.slice(0, 500)}`, { status: response.status });
              }
              const data = await response.json();
              const choice = data.choices?.[0];
              const toolCall = choice?.message?.tool_calls?.[0];
              let content = null;
              if (toolCall) {
                try {
                  content = JSON.parse(toolCall.function.arguments);
                } catch {
                  content = toolCall.function.arguments;
                }
              }
              return {
                content,
                inputTokens: data.usage?.prompt_tokens ?? 0,
                outputTokens: data.usage?.completion_tokens ?? 0,
                model: data.model ?? model
              };
            } catch (err) {
              if (err instanceof common_1.LlmError) {
                throw err;
              }
              lastError = err;
              if (attempt < RETRY_DELAYS.length) {
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
      return new Promise((resolve7) => setTimeout(resolve7, ms));
    }
  }
});

// ../llm/dist/mock-client.js
var require_mock_client = __commonJS({
  "../llm/dist/mock-client.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createMockClient = createMockClient;
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
    function createMockClient() {
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
          if (matchedFunctions.length === 0) {
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
7. Do NOT generate tautologies (always-true) or trivial type checks
8. Avoid fragile assertions:
   - Do NOT use exact equality (===) for floating-point comparisons; use tolerance-based checks
   - Do NOT use tiny absolute tolerances (< 1e-9) for sums or scaled values
   - If a property depends on business constraints (e.g. price >= 0), make the precondition explicit
   - Prefer metamorphic or relation-style properties over arbitrary free-form assertions
9. For parameters that are custom types/interfaces, use type "object" with a "fields" constraint:
   - Each field maps to a generator spec: { type: "string", constraints: { maxLength: 100 } }
   - For optional fields, use type "optional" with an "inner" constraint: { type: "optional", constraints: { inner: { type: "string" } } }
   - For enum types, use type "enum" with a "values" constraint: { type: "enum", constraints: { values: ["a", "b"] } }
   - Nest "object" types for fields that are themselves custom interfaces
   - Example: { type: "object", constraints: { fields: { name: { type: "string" }, price: { type: "float", constraints: { min: 0 } } } } }`;
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
                        constraints: {
                          type: "object",
                          description: "Generator constraints. For 'object' type, include 'fields' mapping field names to nested generator specs. For 'optional', include 'inner' with the wrapped generator spec. For 'enum', include 'values' array."
                        }
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
      type: zod_1.z.string().max(50),
      constraints: zod_1.z.object({
        min: zod_1.z.number().finite().optional(),
        max: zod_1.z.number().finite().optional(),
        maxLength: zod_1.z.number().int().nonnegative().optional(),
        element: zod_1.z.string().max(50).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(),
        elementConstraints: zod_1.z.object({
          min: zod_1.z.number().finite().optional(),
          max: zod_1.z.number().finite().optional(),
          maxLength: zod_1.z.number().int().nonnegative().optional()
        }).passthrough().optional()
      }).passthrough().optional()
    });
    var RawPropertySchema = zod_1.z.object({
      targetFunction: zod_1.z.string().max(200),
      description: zod_1.z.string().max(500),
      category: zod_1.z.string().max(50),
      assertion: zod_1.z.string().max(500),
      generators: zod_1.z.record(GeneratorSpecSchema),
      seedInputs: zod_1.z.array(SeedInputSchema).min(1).max(20),
      evidence: zod_1.z.string().max(500),
      confidence: zod_1.z.number().min(0).max(1)
    });
    var ResponseSchema = zod_1.z.object({
      properties: zod_1.z.array(RawPropertySchema)
    });
    function splitTopLevelArgs(s) {
      const parts = [];
      let start = 0;
      let depth = 0;
      let quote = null;
      let escaped = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quote) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (ch === quote) {
            quote = null;
          }
          continue;
        }
        if (ch === "'" || ch === '"' || ch === "`") {
          quote = ch;
          continue;
        }
        if (ch === "(" || ch === "[" || ch === "{") {
          depth++;
          continue;
        }
        if (ch === ")" || ch === "]" || ch === "}") {
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (ch === "," && depth === 0) {
          parts.push(s.slice(start, i).trim());
          start = i + 1;
        }
      }
      parts.push(s.slice(start).trim());
      return parts.filter(Boolean);
    }
    function parseStringGenerator(s) {
      const funcMatch = s.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
      if (!funcMatch) {
        return { type: s.replace(/[^a-zA-Z0-9_]/g, "") || "any" };
      }
      const typeName = funcMatch[1];
      const args = splitTopLevelArgs(funcMatch[2]);
      if (typeName === "array") {
        if (args.length >= 1) {
          const elementParsed = parseStringGenerator(args[0]);
          const maxLength = args.length >= 3 && !isNaN(Number(args[2])) ? Number(args[2]) : void 0;
          return {
            type: "array",
            constraints: {
              element: elementParsed.type,
              ...elementParsed.constraints ? { elementConstraints: elementParsed.constraints } : {},
              ...maxLength !== void 0 ? { maxLength } : {}
            }
          };
        }
        return { type: "array" };
      }
      if (args.length === 2 && !isNaN(Number(args[0])) && !isNaN(Number(args[1]))) {
        return { type: typeName, constraints: { min: Number(args[0]), max: Number(args[1]) } };
      }
      if (args.length === 1 && !isNaN(Number(args[0]))) {
        const value = Number(args[0]);
        if (typeName === "string") {
          return { type: typeName, constraints: { maxLength: value } };
        }
        if (typeName === "integer" || typeName === "float" || typeName === "number") {
          return { type: typeName, constraints: { max: value } };
        }
      }
      return { type: typeName };
    }
    function normalizeGeneratorObject(raw) {
      const type = typeof raw.type === "string" ? raw.type : "any";
      const constraints = raw.constraints && typeof raw.constraints === "object" ? { ...raw.constraints } : void 0;
      if (type === "array" && constraints) {
        const itemType = typeof constraints.itemType === "string" ? constraints.itemType : void 0;
        const itemMin = typeof constraints.itemMin === "number" ? constraints.itemMin : void 0;
        const itemMax = typeof constraints.itemMax === "number" ? constraints.itemMax : void 0;
        const maxItems = typeof constraints.maxItems === "number" ? constraints.maxItems : void 0;
        if (itemType && constraints.element === void 0) {
          constraints.element = itemType;
        }
        if ((itemMin !== void 0 || itemMax !== void 0) && constraints.elementConstraints === void 0) {
          constraints.elementConstraints = {
            ...itemMin !== void 0 ? { min: itemMin } : {},
            ...itemMax !== void 0 ? { max: itemMax } : {}
          };
        }
        if (maxItems !== void 0 && constraints.maxLength === void 0) {
          constraints.maxLength = maxItems;
        }
      }
      const KNOWN_GENERATOR_TYPES = /* @__PURE__ */ new Set([
        "constant",
        "integer",
        "int",
        "float",
        "number",
        "string",
        "boolean",
        "array",
        "record",
        "object",
        "optional",
        "enum",
        "dict",
        "list",
        "str",
        "bool",
        "any"
      ]);
      if (!KNOWN_GENERATOR_TYPES.has(type) && constraints?.fields && typeof constraints.fields === "object") {
        return {
          ...raw,
          type: "object",
          ...constraints ? { constraints } : {}
        };
      }
      return {
        ...raw,
        type,
        ...constraints ? { constraints } : {}
      };
    }
    function normalizeGenerators(raw) {
      if (!raw || typeof raw !== "object")
        return raw;
      const result = {};
      for (const [key, val] of Object.entries(raw)) {
        if (typeof val === "string") {
          result[key] = parseStringGenerator(val);
        } else if (val && typeof val === "object") {
          result[key] = normalizeGeneratorObject(val);
        } else {
          result[key] = val;
        }
      }
      return result;
    }
    function normalizeRawProperty(item) {
      if (!item || typeof item !== "object")
        return item;
      const obj = item;
      if (obj.generators && typeof obj.generators === "object") {
        obj.generators = normalizeGenerators(obj.generators);
      }
      return obj;
    }
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
        const normalized = normalizeRawProperty(item);
        const parsed = RawPropertySchema.safeParse(normalized);
        if (!parsed.success) {
          continue;
        }
        const raw = parsed.data;
        const assertionCheck = (0, common_1.validateAssertion)(raw.assertion);
        if (!assertionCheck.valid) {
          console.warn(`[propcheck] Dropped unsafe property "${raw.targetFunction}": ${assertionCheck.reason}`);
          continue;
        }
        const generatorKeys = Object.keys(raw.generators);
        if (generatorKeys.length > 20) {
          console.warn(`[propcheck] Dropped property "${raw.targetFunction}": too many generators (${generatorKeys.length})`);
          continue;
        }
        const hasUnsafeKey = generatorKeys.some((k) => !(0, common_1.validateGeneratorKey)(k));
        if (hasUnsafeKey) {
          console.warn(`[propcheck] Dropped property "${raw.targetFunction}": unsafe generator key`);
          continue;
        }
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(raw.targetFunction)) {
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
          riskScore: 0,
          riskTags: Object.freeze([]),
          status: "accepted",
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
    exports2.detectRiskTags = detectRiskTags2;
    exports2.computeRiskScore = computeRiskScore2;
    exports2.scoreProperty = scoreProperty;
    exports2.isRedundant = isRedundant;
    exports2.scoreAndFilter = scoreAndFilter;
    var TAUTOLOGY_PATTERNS = [
      /^true$/i,
      /^x\s*===?\s*x$/,
      /^result\s*===?\s*result$/,
      /^typeof\s+\w+\s*(!==?|===?)\s*['"]undefined['"]\s*$/
    ];
    function hasFloatLikeGenerator(property) {
      return Object.values(property.generators).some((spec) => {
        if (spec.type === "float" || spec.type === "number") {
          return true;
        }
        if (spec.type === "array") {
          const c = spec.constraints ?? {};
          return c.element === "float" || c.element === "number" || c.elementType === "float" || c.elementType === "number";
        }
        return false;
      });
    }
    var FRAGILITY_PENALTIES = {
      float_exact_equality: 2,
      tiny_abs_tolerance: 1,
      missing_precondition: 0,
      wide_numeric_domain: 0,
      doc_domain_mismatch: 0,
      roundtrip_numeric_fragility: 2,
      metamorphic_scale_risk: 0
    };
    var RISK_PENALTIES = {
      float_exact_equality: 3,
      tiny_abs_tolerance: 2,
      missing_precondition: 1,
      wide_numeric_domain: 2,
      doc_domain_mismatch: 2,
      roundtrip_numeric_fragility: 3,
      metamorphic_scale_risk: 1
    };
    function hasWideNumericDomain(property) {
      return Object.values(property.generators).some((spec) => {
        const c = spec.constraints ?? {};
        if (spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int") {
          if (c.min === void 0 && c.max === void 0)
            return true;
          if (typeof c.min === "number" && typeof c.max === "number") {
            return Math.abs(c.max - c.min) > 1e6;
          }
          return false;
        }
        if (spec.type === "array") {
          const elementType = c.element ?? c.elementType;
          const min = c.elementMin ?? c.min;
          const max = c.elementMax ?? c.max;
          if (elementType === "float" || elementType === "number" || elementType === "integer" || elementType === "int") {
            if (min === void 0 && max === void 0)
              return true;
            if (typeof min === "number" && typeof max === "number") {
              return Math.abs(max - min) > 1e6;
            }
          }
        }
        return false;
      });
    }
    function detectRiskTags2(property) {
      const assertion = property.assertion.trim();
      const tags = /* @__PURE__ */ new Set();
      if (hasFloatLikeGenerator(property) && /(===|!==)/.test(assertion) && !assertion.includes("Math.abs(") && !assertion.includes("approxEqual(")) {
        tags.add("float_exact_equality");
      }
      if (/(<|<=)\s*1e-(9|[1-9]\d+)/i.test(assertion)) {
        tags.add("tiny_abs_tolerance");
      }
      if (/(parseFloat|parseInt|JSON\.parse)\s*\(/.test(assertion) && /(===|!==)/.test(assertion)) {
        tags.add("roundtrip_numeric_fragility");
      }
      if (hasWideNumericDomain(property)) {
        tags.add("wide_numeric_domain");
      }
      if (property.category === "boundary" && /(>=\s*0|>\s*0|<=\s*0|<\s*0|between|within)/i.test(assertion) && !/(requires|precondition|assume|if\s*\()/i.test(assertion)) {
        tags.add("missing_precondition");
      }
      if (property.category === "metamorphic" && hasFloatLikeGenerator(property) && !/(Math\.abs|approx|tolerance|epsilon)/i.test(assertion)) {
        tags.add("metamorphic_scale_risk");
      }
      return [...tags];
    }
    function detectFragility(property) {
      return detectRiskTags2(property).reduce((sum, tag) => sum + FRAGILITY_PENALTIES[tag], 0);
    }
    function computeRiskScore2(property, score, riskTags) {
      const penalty = riskTags.reduce((sum, tag) => sum + RISK_PENALTIES[tag], 0);
      return Math.max(0, score - penalty);
    }
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
      score -= detectFragility(property);
      return Math.max(0, Math.min(score, 13));
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
        const riskTags = detectRiskTags2(prop);
        const withScore = {
          ...prop,
          score,
          riskTags,
          riskScore: computeRiskScore2(prop, score, riskTags)
        };
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

// ../llm/dist/prompts/fix.js
var require_fix = __commonJS({
  "../llm/dist/prompts/fix.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FIX_TOOL = exports2.FIX_SYSTEM_PROMPT = exports2.DIAGNOSE_TOOL = exports2.DIAGNOSE_SYSTEM_PROMPT = void 0;
    exports2.buildDiagnosePrompt = buildDiagnosePrompt;
    exports2.diagnoseViolation = diagnoseViolation2;
    exports2.buildFixPrompt = buildFixPrompt;
    exports2.generateFix = generateFix2;
    exports2.DIAGNOSE_SYSTEM_PROMPT = `You are propcheck's violation analyzer. A property-based test found a counterexample that violates a property. Your job: determine if this is a real bug in the source code or a flawed property.

Rules:
- A violation is a REAL BUG if the property correctly describes intended behavior and the source code produces wrong output for the given counterexample
- A violation is a FALSE POSITIVE if the property is too strict, makes wrong assumptions, or tests unintended behavior
- Consider the function's docstring, parameter names, return type, and surrounding code as signals of intent
- Provide a clear explanation of WHY this is or isn't a bug
- If it IS a bug, suggest what the fix should look like (high-level, not code)`;
    exports2.DIAGNOSE_TOOL = {
      name: "diagnose_violation",
      description: "Analyze whether a property violation indicates a real bug in the source code",
      input_schema: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "ID of the violated property" },
          isBug: { type: "boolean", description: "true if this is a real bug in the source code" },
          explanation: { type: "string", description: "Why this is or isn't a bug" },
          suggestedFix: {
            type: ["string", "null"],
            description: "High-level description of the fix (null if not a bug)"
          },
          confidence: { type: "number", description: "0-1 confidence in the diagnosis" },
          rootCause: {
            type: "string",
            description: "Root cause category: boundary, logic, type, overflow, edge-case, validation"
          }
        },
        required: ["propertyId", "isBug", "explanation", "suggestedFix", "confidence", "rootCause"]
      }
    };
    function buildDiagnosePrompt(sourceCode, property, failure, language) {
      const counterexampleStr = typeof failure.counterexample === "string" ? failure.counterexample : JSON.stringify(failure.counterexample, null, 2);
      return `## Source Code

\`\`\`${language}
${sourceCode.slice(0, 8e3)}
\`\`\`

## Property that was violated
- **ID:** ${property.id}
- **Function:** ${property.targetFunction}
- **Description:** ${property.description}
- **Category:** ${property.category}
- **Assertion:** \`${property.assertion}\`
- **Evidence:** ${property.evidence}

## Counterexample (shrunk to minimal case)
- **Input:** ${counterexampleStr}
- **Error:** ${failure.errorMessage.slice(0, 500)}
- **Shrink steps:** ${failure.shrinkSteps}
- **Seed:** ${failure.seed}

Analyze this violation. Is this a real bug in the source code, or is the property flawed?`;
    }
    async function diagnoseViolation2(client, sourceCode, property, failure, language) {
      try {
        const prompt = buildDiagnosePrompt(sourceCode, property, failure, language);
        const response = await client.call(exports2.DIAGNOSE_SYSTEM_PROMPT, prompt, [exports2.DIAGNOSE_TOOL]);
        if (!response.content || typeof response.content !== "object") {
          return null;
        }
        const content = response.content;
        if (typeof content.isBug !== "boolean" || typeof content.explanation !== "string") {
          return null;
        }
        return {
          propertyId: String(content.propertyId ?? property.id),
          isBug: content.isBug,
          explanation: content.explanation,
          suggestedFix: content.suggestedFix ? String(content.suggestedFix) : null,
          confidence: typeof content.confidence === "number" ? content.confidence : 0.5
        };
      } catch {
        return null;
      }
    }
    exports2.FIX_SYSTEM_PROMPT = `You are propcheck's code fix generator. Property-based testing found real bugs in the source code. Your job: generate a minimal, correct fix.

Rules:
- Fix ONLY the bug(s) identified \u2014 do not refactor or change unrelated code
- The fix must make ALL listed properties pass, not just the violated one(s)
- Prefer the smallest possible change (minimal diff)
- Preserve function signatures (parameter names, types, return type)
- Preserve code style (indentation, naming conventions, comment style)
- Do NOT add new dependencies or imports unless absolutely necessary
- The counterexample shows the EXACT input that triggers the bug \u2014 use it to understand the edge case
- Consider ALL properties listed (both passing and failing) to ensure no regressions
- Return the COMPLETE source file with fixes applied`;
    exports2.FIX_TOOL = {
      name: "generate_fix",
      description: "Generate a fixed version of the source code",
      input_schema: {
        type: "object",
        properties: {
          fixedSource: { type: "string", description: "The complete fixed source code" },
          explanation: { type: "string", description: "What was changed and why" },
          changedFunctions: {
            type: "array",
            items: { type: "string" },
            description: "Names of functions that were modified"
          },
          confidence: { type: "number", description: "0-1 confidence the fix is correct" }
        },
        required: ["fixedSource", "explanation", "changedFunctions", "confidence"]
      }
    };
    function buildFixPrompt(sourceCode, diagnoses, properties, failures, language, retryFeedback) {
      const bugSections = diagnoses.filter((d) => d.isBug).map((d) => {
        const failure = failures.find((f) => f.propertyId === d.propertyId);
        const property = properties.find((p) => p.id === d.propertyId);
        const counterexampleStr = failure ? typeof failure.counterexample === "string" ? failure.counterexample : JSON.stringify(failure.counterexample, null, 2) : "N/A";
        return `### Bug in \`${property?.targetFunction ?? "unknown"}\`
- **Property:** ${property?.description ?? d.propertyId}
- **Counterexample:** ${counterexampleStr}
- **Explanation:** ${d.explanation}
- **Suggested fix:** ${d.suggestedFix ?? "N/A"}`;
      }).join("\n\n");
      const propertySummary = properties.map((p) => {
        const failed = failures.some((f) => f.propertyId === p.id);
        const status = failed ? "FAILING" : "PASSING";
        return `- [${status}] ${p.targetFunction}: ${p.description}
  Assertion: \`${p.assertion}\``;
      }).join("\n");
      let prompt = `## Source Code (with bug)

\`\`\`${language}
${sourceCode.slice(0, 1e4)}
\`\`\`

## Bug Diagnosis

${bugSections}

## ALL Properties (fix must not break any)

${propertySummary}

## Task

Generate a fixed version of the source code that:
1. Fixes the bug(s) described above
2. Passes ALL listed properties (including the currently-passing ones)
3. Makes the MINIMAL change necessary

Return the complete fixed source code via the generate_fix tool.`;
      if (retryFeedback) {
        prompt += `

## Previous Attempt Feedback

${retryFeedback}

Please fix the issues above and try again.`;
      }
      return prompt;
    }
    async function generateFix2(client, sourceCode, diagnoses, properties, failures, language, retryFeedback) {
      try {
        const prompt = buildFixPrompt(sourceCode, diagnoses, properties, failures, language, retryFeedback);
        const response = await client.call(exports2.FIX_SYSTEM_PROMPT, prompt, [exports2.FIX_TOOL]);
        if (!response.content || typeof response.content !== "object") {
          return null;
        }
        const content = response.content;
        if (typeof content.fixedSource !== "string" || !content.fixedSource.trim()) {
          return null;
        }
        return {
          fixedSource: content.fixedSource,
          explanation: typeof content.explanation === "string" ? content.explanation : "",
          changedFunctions: Array.isArray(content.changedFunctions) ? content.changedFunctions.map(String) : [],
          confidence: typeof content.confidence === "number" ? content.confidence : 0.5
        };
      } catch {
        return null;
      }
    }
  }
});

// ../llm/dist/mock-fix.js
var require_mock_fix = __commonJS({
  "../llm/dist/mock-fix.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.mockDiagnoseViolation = mockDiagnoseViolation2;
    exports2.mockGenerateFix = mockGenerateFix2;
    function mockDiagnoseViolation2(property, failure) {
      return {
        propertyId: property.id,
        isBug: true,
        explanation: `Mock diagnosis: the counterexample ${JSON.stringify(failure.counterexample)} triggers a bug in ${property.targetFunction}. The property "${property.description}" is violated.`,
        suggestedFix: `Add input validation or boundary check in ${property.targetFunction}`,
        confidence: 0.85
      };
    }
    function mockGenerateFix2(sourceCode, diagnoses) {
      let fixedSource = sourceCode;
      const changedFunctions = [];
      for (const d of diagnoses) {
        if (!d.isBug)
          continue;
        const funcPattern = new RegExp(`((?:export\\s+)?function\\s+${escapeRegExp(d.propertyId.split("_")[0] ?? "")}\\s*\\()`);
        const match = fixedSource.match(funcPattern);
        if (!match) {
          fixedSource = `// [propcheck fix] Applied mock fix for ${d.propertyId}
${fixedSource}`;
        }
      }
      return {
        fixedSource,
        explanation: `Mock fix: applied guards for ${diagnoses.filter((d) => d.isBug).length} diagnosed bug(s)`,
        changedFunctions,
        confidence: 0.7
      };
    }
    function escapeRegExp(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
});

// ../llm/dist/index.js
var require_dist5 = __commonJS({
  "../llm/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.mockGenerateFix = exports2.mockDiagnoseViolation = exports2.buildFixPrompt = exports2.buildDiagnosePrompt = exports2.FIX_TOOL = exports2.FIX_SYSTEM_PROMPT = exports2.DIAGNOSE_TOOL = exports2.DIAGNOSE_SYSTEM_PROMPT = exports2.generateFix = exports2.diagnoseViolation = exports2.mockRefineProperties = exports2.buildRefinementPrompt = exports2.buildFeedbackSummary = exports2.classifyProperties = exports2.mockRepairProperty = exports2.repairProperty = exports2.getInferTool = exports2.getSystemPrompt = exports2.buildInferPrompt = exports2.computeRiskScore = exports2.detectRiskTags = exports2.isRedundant = exports2.scoreAndFilter = exports2.scoreProperty = exports2.parseInferResponse = exports2.createMockClient = exports2.createOpenAIClient = exports2.createLlmClient = void 0;
    exports2.createClient = createClient3;
    exports2.inferProperties = inferProperties2;
    exports2.refineProperties = refineProperties2;
    var common_1 = require_dist4();
    var client_1 = require_client();
    var openai_client_1 = require_openai_client();
    var mock_client_1 = require_mock_client();
    var infer_properties_1 = require_infer_properties();
    var refinement_1 = require_refinement();
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
    function limitPropertiesPerFunction(properties, maxProperties) {
      const functionGroups = /* @__PURE__ */ new Map();
      for (const prop of properties) {
        const group = functionGroups.get(prop.targetFunction) ?? [];
        group.push(prop);
        functionGroups.set(prop.targetFunction, group);
      }
      const limited = [];
      for (const [_fn, props] of functionGroups) {
        limited.push(...props.slice(0, maxProperties));
      }
      return limited;
    }
    function toInferResult(response, context, opts, startedAt) {
      const sourceHash = (0, common_1.hashContent)(context.sourceCode);
      const rawProperties = (0, response_parser_1.parseInferResponse)(response.content, {
        sourceHash,
        modelId: response.model
      });
      const filtered = (0, scoring_1.scoreAndFilter)(rawProperties, opts.minScore);
      const limited = limitPropertiesPerFunction(filtered, opts.maxProperties);
      return {
        properties: limited,
        tokensUsed: response.inputTokens + response.outputTokens,
        cost: estimateCost(response.inputTokens, response.outputTokens),
        duration: Date.now() - startedAt
      };
    }
    function createClient3(apiKey, model, provider = "anthropic", baseURL) {
      if (provider === "openai-compatible") {
        return (0, openai_client_1.createOpenAIClient)(apiKey, model, baseURL ?? void 0);
      }
      return (0, client_1.createLlmClient)(apiKey, model, baseURL);
    }
    async function inferProperties2(apiKey, model, context, options = {}) {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const startTime = Date.now();
      const client = opts.mock ? (0, mock_client_1.createMockClient)() : createClient3(apiKey, model, opts.provider, opts.baseURL);
      const systemPrompt = (0, infer_properties_1.getSystemPrompt)();
      const userPrompt = (0, infer_properties_1.buildInferPrompt)(context);
      const tool = (0, infer_properties_1.getInferTool)();
      const response = await client.call(systemPrompt, userPrompt, [tool]);
      return toInferResult(response, context, opts, startTime);
    }
    async function refineProperties2(apiKey, model, context, feedbackSummary, options = {}) {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const startTime = Date.now();
      const client = opts.mock ? (0, mock_client_1.createMockClient)() : createClient3(apiKey, model, opts.provider, opts.baseURL);
      const systemPrompt = (0, infer_properties_1.getSystemPrompt)();
      const originalPrompt = (0, infer_properties_1.buildInferPrompt)(context);
      const userPrompt = (0, refinement_1.buildRefinementPrompt)(originalPrompt, feedbackSummary);
      const tool = (0, infer_properties_1.getInferTool)();
      const response = await client.call(systemPrompt, userPrompt, [tool]);
      return toInferResult(response, context, opts, startTime);
    }
    var client_2 = require_client();
    Object.defineProperty(exports2, "createLlmClient", { enumerable: true, get: function() {
      return client_2.createLlmClient;
    } });
    var openai_client_2 = require_openai_client();
    Object.defineProperty(exports2, "createOpenAIClient", { enumerable: true, get: function() {
      return openai_client_2.createOpenAIClient;
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
    Object.defineProperty(exports2, "detectRiskTags", { enumerable: true, get: function() {
      return scoring_2.detectRiskTags;
    } });
    Object.defineProperty(exports2, "computeRiskScore", { enumerable: true, get: function() {
      return scoring_2.computeRiskScore;
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
    var refinement_2 = require_refinement();
    Object.defineProperty(exports2, "classifyProperties", { enumerable: true, get: function() {
      return refinement_2.classifyProperties;
    } });
    Object.defineProperty(exports2, "buildFeedbackSummary", { enumerable: true, get: function() {
      return refinement_2.buildFeedbackSummary;
    } });
    Object.defineProperty(exports2, "buildRefinementPrompt", { enumerable: true, get: function() {
      return refinement_2.buildRefinementPrompt;
    } });
    var mock_refinement_1 = require_mock_refinement();
    Object.defineProperty(exports2, "mockRefineProperties", { enumerable: true, get: function() {
      return mock_refinement_1.mockRefineProperties;
    } });
    var fix_1 = require_fix();
    Object.defineProperty(exports2, "diagnoseViolation", { enumerable: true, get: function() {
      return fix_1.diagnoseViolation;
    } });
    Object.defineProperty(exports2, "generateFix", { enumerable: true, get: function() {
      return fix_1.generateFix;
    } });
    Object.defineProperty(exports2, "DIAGNOSE_SYSTEM_PROMPT", { enumerable: true, get: function() {
      return fix_1.DIAGNOSE_SYSTEM_PROMPT;
    } });
    Object.defineProperty(exports2, "DIAGNOSE_TOOL", { enumerable: true, get: function() {
      return fix_1.DIAGNOSE_TOOL;
    } });
    Object.defineProperty(exports2, "FIX_SYSTEM_PROMPT", { enumerable: true, get: function() {
      return fix_1.FIX_SYSTEM_PROMPT;
    } });
    Object.defineProperty(exports2, "FIX_TOOL", { enumerable: true, get: function() {
      return fix_1.FIX_TOOL;
    } });
    Object.defineProperty(exports2, "buildDiagnosePrompt", { enumerable: true, get: function() {
      return fix_1.buildDiagnosePrompt;
    } });
    Object.defineProperty(exports2, "buildFixPrompt", { enumerable: true, get: function() {
      return fix_1.buildFixPrompt;
    } });
    var mock_fix_1 = require_mock_fix();
    Object.defineProperty(exports2, "mockDiagnoseViolation", { enumerable: true, get: function() {
      return mock_fix_1.mockDiagnoseViolation;
    } });
    Object.defineProperty(exports2, "mockGenerateFix", { enumerable: true, get: function() {
      return mock_fix_1.mockGenerateFix;
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
    var RISK_LABELS = {
      float_exact_equality: "float ===",
      tiny_abs_tolerance: "tight tolerance",
      missing_precondition: "no precondition",
      wide_numeric_domain: "wide range",
      doc_domain_mismatch: "doc mismatch",
      roundtrip_numeric_fragility: "roundtrip fragile",
      metamorphic_scale_risk: "scale risk"
    };
    function formatRiskTags(tags) {
      if (tags.length === 0)
        return "";
      const labels = tags.map((t) => RISK_LABELS[t] ?? t);
      return ` ${chalk_1.default.yellow(`(${labels.join(", ")})`)}`;
    }
    function formatStatus(property) {
      const statusLabel = (() => {
        switch (property.status) {
          case "risky":
            return chalk_1.default.yellow("[risky]");
          case "refined":
            return chalk_1.default.cyan("[refined]");
          case "quarantined":
          case "dropped":
            return chalk_1.default.gray(`[${property.status}]`);
          default:
            return "";
        }
      })();
      const status = statusLabel ? ` ${statusLabel}` : "";
      const risk = formatRiskTags(property.riskTags);
      return `${status}${risk}`;
    }
    function formatPropertyLine(property, outcome) {
      const desc = `${property.targetFunction}: ${property.description}`;
      const padded = desc.padEnd(50);
      const id = chalk_1.default.dim(`[${property.id}]`);
      const meta = formatStatus(property);
      if (!outcome) {
        const scoreNum = property.score;
        const quality = scoreNum >= 12 ? chalk_1.default.green("\u2605") : scoreNum >= 9 ? chalk_1.default.yellow("\u2605") : chalk_1.default.red("\u2605");
        return `  ${chalk_1.default.cyan("*")} ${padded} ${quality} ${chalk_1.default.dim(`${scoreNum}/13`)}${meta}`;
      }
      switch (outcome.status) {
        case "passed": {
          const iters = `(${outcome.iterations}/${outcome.iterations})`;
          const dur = `${(outcome.duration / 1e3).toFixed(1)}s`;
          return `  ${chalk_1.default.green("\u2713")} ${id} ${padded} ${chalk_1.default.green("PASS")} ${chalk_1.default.dim(iters)}  ${chalk_1.default.dim(dur)}${meta}`;
        }
        case "failed": {
          return `  ${chalk_1.default.red("\u2717")} ${id} ${padded} ${chalk_1.default.red("FAIL")}${meta}`;
        }
        case "error": {
          return `  ${chalk_1.default.yellow("\u26A0")} ${id} ${padded} ${chalk_1.default.yellow("ERROR")}${meta}`;
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
      const skippedCount = result.skipped.length;
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
      if (skippedCount > 0) {
        parts.push(chalk_1.default.gray(`Skipped: ${skippedCount}`));
      }
      parts.push(`Duration: ${duration}s`);
      return parts.join(" | ");
    }
    function formatCost(tokensUsed, cost) {
      return chalk_1.default.dim(`AI usage: ${tokensUsed.toLocaleString()} tokens | Cost: $${cost.toFixed(4)}`);
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
      console.log(chalk_1.default.bold(`  Discovered ${result.properties.length} rules for ${filePath}`) + chalk_1.default.dim(` ($${result.cost.toFixed(4)}, ${dur}s)`));
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
      if (result.failed.length > 0) {
        const failedIds = result.failed.map((f) => f.propertyId).join(",");
        console.log("");
        console.log(chalk_1.default.dim(`  Next steps:`));
        console.log(chalk_1.default.dim(`    \u2022 Review the counterexample above \u2014 is this a real bug or a false positive?`));
        console.log(chalk_1.default.dim(`    \u2022 Fix the bug:     propcheck fix ${filePath}`));
        console.log(chalk_1.default.dim(`    \u2022 Skip this rule:  propcheck run --skip ${failedIds} ${filePath}`));
        console.log(chalk_1.default.dim(`    \u2022 Quarantine it:   propcheck property ${filePath} ${result.failed[0].propertyId} --status quarantined`));
      }
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
    function reportAsJson2(result, filePath) {
      const report = {
        version: "1.0.0",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        filePath: filePath ?? null,
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
        skipped: result.skipped.map((s) => ({
          propertyId: s.propertyId,
          reason: s.reason,
          propertyStatus: s.propertyStatus
        })),
        summary: {
          total: result.passed.length + result.failed.length + result.errors.length,
          passed: result.passed.length,
          failed: result.failed.length,
          errors: result.errors.length,
          skipped: result.skipped.length,
          duration: result.duration
        }
      };
      return JSON.stringify(report, null, 2);
    }
  }
});

// ../reporter/dist/property-workflow-reporter.js
var require_property_workflow_reporter = __commonJS({
  "../reporter/dist/property-workflow-reporter.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.reportPropertiesOverview = reportPropertiesOverview2;
    exports2.reportPropertiesOverviewAsJson = reportPropertiesOverviewAsJson2;
    exports2.reportPropertyDetail = reportPropertyDetail2;
    exports2.reportPropertyDetailAsJson = reportPropertyDetailAsJson2;
    exports2.reportStatusUpdate = reportStatusUpdate2;
    var chalk_1 = __importDefault(require("chalk"));
    var RISK_LABELS = {
      float_exact_equality: "float ===",
      tiny_abs_tolerance: "tight tolerance",
      missing_precondition: "no precondition",
      wide_numeric_domain: "wide range",
      doc_domain_mismatch: "doc mismatch",
      roundtrip_numeric_fragility: "roundtrip fragile",
      metamorphic_scale_risk: "scale risk"
    };
    function formatRiskTags(tags) {
      if (tags.length === 0)
        return "";
      const labels = tags.map((t) => RISK_LABELS[t] ?? t);
      return chalk_1.default.yellow(` (${labels.join(", ")})`);
    }
    function statusIcon(status) {
      switch (status) {
        case "accepted":
          return chalk_1.default.green("\u25CF");
        case "risky":
          return chalk_1.default.yellow("\u25CF");
        case "refined":
          return chalk_1.default.cyan("\u25CF");
        case "quarantined":
          return chalk_1.default.gray("\u25CB");
        case "dropped":
          return chalk_1.default.strikethrough(chalk_1.default.gray("\u25CB"));
      }
    }
    function statusBadge(status) {
      switch (status) {
        case "accepted":
          return chalk_1.default.green(status);
        case "risky":
          return chalk_1.default.yellow(status);
        case "refined":
          return chalk_1.default.cyan(status);
        case "quarantined":
          return chalk_1.default.gray(status);
        case "dropped":
          return chalk_1.default.strikethrough(chalk_1.default.gray(status));
      }
    }
    function summarize(text, maxLen) {
      return text.length > maxLen ? text.slice(0, maxLen - 1) + "\u2026" : text;
    }
    function reportPropertiesOverview2(propertySets, statusFilter) {
      if (propertySets.length === 0) {
        console.log("\n  No properties found. Run: propcheck infer <file>\n");
        return;
      }
      for (const ps of propertySets) {
        const props = statusFilter ? ps.properties.filter((p) => p.status === statusFilter) : ps.properties;
        if (props.length === 0)
          continue;
        console.log("");
        console.log(chalk_1.default.bold(`  ${ps.filePath}`));
        for (const p of props) {
          const icon = statusIcon(p.status);
          const desc = summarize(`${p.targetFunction}: ${p.description}`, 50);
          const badge = statusBadge(p.status);
          const verified = p.humanVerified ? chalk_1.default.green(" \u2714 verified") : "";
          const risk = formatRiskTags(p.riskTags);
          console.log(`    ${icon} ${chalk_1.default.dim(p.id)} ${desc}  ${badge}${verified}${risk}`);
        }
        const counts = countByStatus(ps.properties);
        const parts = [];
        parts.push(`${ps.properties.length} total`);
        if (counts.accepted > 0)
          parts.push(chalk_1.default.green(`${counts.accepted} accepted`));
        if (counts.risky > 0)
          parts.push(chalk_1.default.yellow(`${counts.risky} risky`));
        if (counts.refined > 0)
          parts.push(chalk_1.default.cyan(`${counts.refined} refined`));
        if (counts.quarantined > 0)
          parts.push(chalk_1.default.gray(`${counts.quarantined} quarantined`));
        if (counts.dropped > 0)
          parts.push(chalk_1.default.gray(`${counts.dropped} dropped`));
        console.log(chalk_1.default.dim(`    \u2500\u2500 ${parts.join(" | ")}`));
      }
      console.log("");
    }
    function reportPropertiesOverviewAsJson2(propertySets, statusFilter) {
      const modules = propertySets.map((ps) => {
        const props = statusFilter ? ps.properties.filter((p) => p.status === statusFilter) : ps.properties;
        return {
          filePath: ps.filePath,
          properties: props.map((p) => ({
            id: p.id,
            targetFunction: p.targetFunction,
            description: p.description,
            status: p.status,
            humanVerified: p.humanVerified ?? false,
            riskScore: p.riskScore,
            riskTags: p.riskTags
          })),
          summary: countByStatus(props)
        };
      }).filter((m) => m.properties.length > 0);
      const json = { modules };
      return JSON.stringify(json, null, 2);
    }
    function reportPropertyDetail2(property, filePath) {
      console.log("");
      console.log(chalk_1.default.bold(`  ${filePath} \u2014 ${property.id}`));
      console.log("");
      console.log(`  Function   : ${property.targetFunction}`);
      console.log(`  Description: ${property.description}`);
      console.log(`  Category   : ${property.category}`);
      console.log(`  Status     : ${statusBadge(property.status)}${property.humanVerified ? chalk_1.default.green(" \u2714 verified") : ""}`);
      console.log(`  Score      : ${property.score}/13  risk: ${property.riskScore}`);
      if (property.riskTags.length > 0) {
        console.log(`  Risk tags  : ${chalk_1.default.yellow(property.riskTags.map((t) => RISK_LABELS[t] ?? t).join(", "))}`);
      }
      console.log(`  Confidence : ${(property.confidence * 100).toFixed(0)}%`);
      console.log(`  Evidence   : ${property.evidence}`);
      console.log("");
      console.log(chalk_1.default.dim("  Assertion:"));
      console.log(`    ${property.assertion}`);
      console.log("");
      console.log(chalk_1.default.dim(`  Inferred: ${property.inferredAt}  model: ${property.modelId}`));
      if (property.validation) {
        const v = property.validation;
        console.log(chalk_1.default.dim(`  Validated: smoke=${v.smokePasses} canary=${v.canaryPasses} seeds=[${v.seedsTested.join(",")}] at ${v.lastValidatedAt}`));
      }
      console.log("");
    }
    function reportPropertyDetailAsJson2(property, filePath) {
      const json = {
        filePath,
        property: {
          id: property.id,
          targetFunction: property.targetFunction,
          description: property.description,
          category: property.category,
          assertion: property.assertion,
          status: property.status,
          humanVerified: property.humanVerified ?? false,
          score: property.score,
          riskScore: property.riskScore,
          riskTags: property.riskTags,
          confidence: property.confidence,
          evidence: property.evidence,
          inferredAt: property.inferredAt,
          modelId: property.modelId
        }
      };
      return JSON.stringify(json, null, 2);
    }
    function reportStatusUpdate2(propertyId, filePath, oldStatus, newStatus) {
      console.log("");
      console.log(`  ${chalk_1.default.bold(propertyId)} in ${filePath}: ${statusBadge(oldStatus)} \u2192 ${statusBadge(newStatus)}` + chalk_1.default.green(" \u2714 humanVerified"));
      console.log("");
    }
    function countByStatus(properties) {
      const counts = { total: 0, accepted: 0, risky: 0, refined: 0, quarantined: 0, dropped: 0 };
      for (const p of properties) {
        counts.total++;
        counts[p.status]++;
      }
      return counts;
    }
  }
});

// ../reporter/dist/index.js
var require_dist6 = __commonJS({
  "../reporter/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.reportStatusUpdate = exports2.reportPropertyDetailAsJson = exports2.reportPropertyDetail = exports2.reportPropertiesOverviewAsJson = exports2.reportPropertiesOverview = exports2.formatPropertyLine = exports2.formatCounterexample = exports2.formatCost = exports2.formatSummary = exports2.reportAsJson = exports2.reportRunSummary = exports2.reportInferResult = void 0;
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
    var property_workflow_reporter_1 = require_property_workflow_reporter();
    Object.defineProperty(exports2, "reportPropertiesOverview", { enumerable: true, get: function() {
      return property_workflow_reporter_1.reportPropertiesOverview;
    } });
    Object.defineProperty(exports2, "reportPropertiesOverviewAsJson", { enumerable: true, get: function() {
      return property_workflow_reporter_1.reportPropertiesOverviewAsJson;
    } });
    Object.defineProperty(exports2, "reportPropertyDetail", { enumerable: true, get: function() {
      return property_workflow_reporter_1.reportPropertyDetail;
    } });
    Object.defineProperty(exports2, "reportPropertyDetailAsJson", { enumerable: true, get: function() {
      return property_workflow_reporter_1.reportPropertyDetailAsJson;
    } });
    Object.defineProperty(exports2, "reportStatusUpdate", { enumerable: true, get: function() {
      return property_workflow_reporter_1.reportStatusUpdate;
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
    exports2.generateFastCheckTest = generateFastCheckTest4;
    var common_1 = require_dist4();
    var fs6 = __importStar(require("fs"));
    var path10 = __importStar(require("path"));
    function toSafeComment(s) {
      return s.replace(/[\r\n\u2028\u2029]/g, " ").slice(0, 200);
    }
    function isTypeModuleProject(targetFile) {
      let dir = path10.dirname(targetFile);
      while (true) {
        const packageJsonPath = path10.join(dir, "package.json");
        if (fs6.existsSync(packageJsonPath)) {
          try {
            const raw = fs6.readFileSync(packageJsonPath, "utf8");
            const pkg = JSON.parse(raw);
            return pkg.type === "module";
          } catch {
            return false;
          }
        }
        const parent = path10.dirname(dir);
        if (parent === dir)
          break;
        dir = parent;
      }
      return false;
    }
    function isExplicitCJSProject(targetFile) {
      let dir = path10.dirname(targetFile);
      while (true) {
        const packageJsonPath = path10.join(dir, "package.json");
        if (fs6.existsSync(packageJsonPath)) {
          try {
            const raw = fs6.readFileSync(packageJsonPath, "utf8");
            const pkg = JSON.parse(raw);
            return pkg.type === "commonjs";
          } catch {
            return false;
          }
        }
        const parent = path10.dirname(dir);
        if (parent === dir)
          break;
        dir = parent;
      }
      return false;
    }
    var MAX_GENERATOR_DEPTH = 10;
    function mapGenerator(spec, depth = 0) {
      if (depth > MAX_GENERATOR_DEPTH) {
        return "fc.anything()";
      }
      const c = spec.constraints ?? {};
      switch (spec.type) {
        case "constant":
          return `fc.constant(${JSON.stringify(c.value ?? null)})`;
        case "integer":
        case "int":
          if (c.min !== void 0 || c.max !== void 0) {
            const parts = [];
            if (c.min !== void 0)
              parts.push(`min: ${Number(c.min)}`);
            if (c.max !== void 0)
              parts.push(`max: ${Number(c.max)}`);
            return `fc.integer({ ${parts.join(", ")} })`;
          }
          return "fc.integer()";
        case "float":
        case "number":
          if (c.min !== void 0 || c.max !== void 0) {
            const parts = [];
            if (c.min !== void 0)
              parts.push(`min: ${Number(c.min)}`);
            if (c.max !== void 0)
              parts.push(`max: ${Number(c.max)}`);
            return `fc.double({ ${parts.join(", ")}, noNaN: true, noDefaultInfinity: true })`;
          }
          return "fc.double({ min: 0, noNaN: true, noDefaultInfinity: true })";
        case "string":
          if (c.maxLength !== void 0) {
            return `fc.string({ maxLength: ${Number(c.maxLength)} })`;
          }
          return "fc.string()";
        case "boolean":
          return "fc.boolean()";
        case "array": {
          const items = c.items;
          const elementType = c.element ?? c.elementType;
          let element;
          if (items && typeof items === "object" && typeof items.type === "string") {
            element = mapGenerator({ type: items.type, constraints: items.constraints }, depth + 1);
          } else if (elementType) {
            const nestedConstraints = c.elementConstraints && typeof c.elementConstraints === "object" ? c.elementConstraints : {
              ...(c.elementMin ?? c.min) !== void 0 ? { min: c.elementMin ?? c.min } : {},
              ...(c.elementMax ?? c.max) !== void 0 ? { max: c.elementMax ?? c.max } : {},
              ...c.elementMaxLength !== void 0 ? { maxLength: c.elementMaxLength } : {}
            };
            element = mapGenerator({
              type: String(elementType).replace(/[^a-zA-Z0-9_]/g, ""),
              ...Object.keys(nestedConstraints).length > 0 ? { constraints: nestedConstraints } : {}
            }, depth + 1);
          } else {
            element = "fc.anything()";
          }
          const maxLen = c.maxLength ? `, { maxLength: ${Number(c.maxLength)} }` : "";
          return `fc.array(${element}${maxLen})`;
        }
        case "record":
          return "fc.dictionary(fc.string(), fc.anything())";
        case "object": {
          const fields = c.fields;
          if (fields && typeof fields === "object") {
            const entries = Object.entries(fields);
            if (entries.length === 0) {
              return "fc.record({})";
            }
            const fieldExprs = entries.map(([name, fieldSpec]) => {
              const fs7 = fieldSpec;
              const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
              return `${safeName}: ${mapGenerator({ type: fs7.type, constraints: fs7.constraints }, depth + 1)}`;
            });
            return `fc.record({ ${fieldExprs.join(", ")} })`;
          }
          return "fc.dictionary(fc.string(), fc.anything())";
        }
        case "optional": {
          const inner = c.inner;
          if (inner && typeof inner === "object" && typeof inner.type === "string") {
            return `fc.option(${mapGenerator({ type: inner.type, constraints: inner.constraints }, depth + 1)})`;
          }
          return "fc.option(fc.anything())";
        }
        case "enum": {
          const values = c.values;
          if (Array.isArray(values) && values.length > 0) {
            return `fc.constantFrom(${values.map((v) => JSON.stringify(v)).join(", ")})`;
          }
          return "fc.anything()";
        }
        default: {
          const fields = c.fields;
          if (fields && typeof fields === "object" && Object.keys(fields).length > 0) {
            return mapGenerator({ type: "object", constraints: spec.constraints }, depth);
          }
          return "fc.anything()";
        }
      }
    }
    function normalizeAssertionSyntax(assertion) {
      let depth = 0;
      let quote = null;
      let escaped = false;
      for (let i = 0; i < assertion.length; i++) {
        const ch = assertion[i];
        if (quote) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (ch === quote) {
            quote = null;
          }
          continue;
        }
        if (ch === "'" || ch === '"' || ch === "`") {
          quote = ch;
          continue;
        }
        if (ch === "(" || ch === "[" || ch === "{") {
          depth++;
          continue;
        }
        if (ch === ")" || ch === "]" || ch === "}") {
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (depth === 0 && assertion.startsWith("implies", i) && /\s/.test(assertion[i - 1] ?? "") && /\s/.test(assertion[i + "implies".length] ?? "")) {
          const left = assertion.slice(0, i).trim();
          const right = assertion.slice(i + "implies".length).trim();
          if (!left || !right) {
            return assertion;
          }
          return `!(${normalizeAssertionSyntax(left)}) || (${normalizeAssertionSyntax(right)})`;
        }
      }
      return assertion;
    }
    function generateFastCheckTest4(properties, targetFile, testDir, config) {
      const isTS = targetFile.endsWith(".ts") || targetFile.endsWith(".tsx");
      const explicitCJS = isExplicitCJSProject(targetFile);
      const needsMtsCopy = isTS && explicitCJS;
      const useESM = needsMtsCopy;
      const relativeImport = (0, common_1.toForwardSlash)(path10.relative(testDir, targetFile)).replace(/\.(ts|tsx|js|jsx)$/, "");
      let importPathStr;
      if (useESM) {
        const mtsTarget = targetFile.replace(/\.ts$/, ".mts").replace(/\.tsx$/, ".mtsx");
        importPathStr = (0, common_1.toForwardSlash)(path10.relative(testDir, mtsTarget));
        if (!importPathStr.startsWith("."))
          importPathStr = `./${importPathStr}`;
      } else if (isTS) {
        importPathStr = (0, common_1.toForwardSlash)(path10.relative(testDir, targetFile));
        if (!importPathStr.startsWith("."))
          importPathStr = `./${importPathStr}`;
      } else {
        const noExt = relativeImport.startsWith(".") ? relativeImport : `./${relativeImport}`;
        importPathStr = noExt;
      }
      const functionNames = [...new Set(properties.map((p) => p.targetFunction.split(".").pop()))];
      let fcImport;
      if (useESM) {
        try {
          const fcPath = require.resolve("fast-check");
          fcImport = `const { default: fc } = await import(${JSON.stringify("file:///" + (0, common_1.toForwardSlash)(fcPath))});`;
        } catch {
          fcImport = `const { default: fc } = await import("fast-check");`;
        }
      } else {
        let fcRequire = `require("fast-check")`;
        try {
          const fcPath = require.resolve("fast-check");
          fcRequire = `require(${JSON.stringify((0, common_1.toForwardSlash)(fcPath))})`;
        } catch {
        }
        fcImport = `const fc = ${fcRequire};`;
      }
      const lines = [];
      lines.push(`// Auto-generated by propcheck \u2014 do not edit manually`);
      lines.push(`// Target: ${(0, common_1.toForwardSlash)(targetFile)}`);
      lines.push(`// Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      lines.push(``);
      if (useESM) {
        lines.push(`import { pathToFileURL, fileURLToPath } from "node:url";`);
        lines.push(`import { resolve, dirname } from "node:path";`);
        lines.push(``);
        lines.push(fcImport);
        lines.push(`const __dirname = dirname(fileURLToPath(import.meta.url));`);
        lines.push(`const __targetPath = resolve(__dirname, "${importPathStr}");`);
        lines.push(`const target = await import(pathToFileURL(__targetPath).href);`);
      } else {
        lines.push(fcImport);
        lines.push(`const target = require("${importPathStr}");`);
      }
      lines.push(``);
      lines.push(`function approxEqual(a, b, absTol = 1e-9, relTol = 1e-6) {`);
      lines.push(`  return Math.abs(a - b) <= absTol + relTol * Math.max(1, Math.abs(a), Math.abs(b));`);
      lines.push(`}`);
      lines.push(``);
      lines.push(`const numRuns = ${config.iterations};`);
      lines.push(``);
      for (const prop of properties) {
        const generators = Object.entries(prop.generators);
        const arbNames = generators.map(([name]) => name);
        const arbExprs = generators.map(([, spec]) => mapGenerator(spec));
        let assertion = normalizeAssertionSyntax(prop.assertion);
        for (const fn of functionNames) {
          assertion = assertion.replace(new RegExp(`(?<!\\.)\\b${fn}\\(`, "g"), `target.${fn}(`);
        }
        lines.push(`// ${prop.id}: ${toSafeComment(prop.description)}`);
        lines.push(`// Category: ${toSafeComment(prop.category)}`);
        lines.push(`// Evidence: ${toSafeComment(prop.evidence)}`);
        lines.push(`try {`);
        if (generators.length === 0) {
          lines.push(`  fc.assert(`);
          lines.push(`    fc.property(`);
          lines.push(`      fc.constant(null),`);
          lines.push(`      () => {`);
          lines.push(`        return ${assertion};`);
          lines.push(`      }`);
          lines.push(`    ),`);
          lines.push(`    { numRuns: 1 }`);
          lines.push(`  );`);
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
      const baseName = path10.basename(targetFile, path10.extname(targetFile));
      let fileExt;
      if (useESM) {
        fileExt = ".fc.mjs";
      } else if (isTypeModuleProject(targetFile)) {
        fileExt = ".fc.cjs";
      } else {
        fileExt = ".fc.js";
      }
      const fileName = `${baseName}${fileExt}`;
      return {
        content: lines.join("\n"),
        fileName,
        needsMtsCopy: needsMtsCopy || void 0
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
    var MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
    function runProcess(command, args, options = {}) {
      const timeout = options.timeout ?? 6e4;
      return new Promise((resolve7, reject) => {
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
          if (stdout.length < MAX_OUTPUT_BYTES) {
            stdout += data.toString();
          }
        });
        proc.stderr.on("data", (data) => {
          if (stderr.length < MAX_OUTPUT_BYTES) {
            stderr += data.toString();
          }
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
          resolve7({ stdout, stderr, exitCode: code ?? 1 });
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
          if (parsed.propertyId && (parsed.status === "passed" || parsed.status === "failed")) {
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
        } else if (raw.status === "failed") {
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
        } else {
          errors.push({
            propertyId: prop.id,
            status: "error",
            errorMessage: `Unexpected status in test output: "${String(raw.status)}"`,
            duration: 0
          });
        }
      }
      return {
        passed,
        failed,
        errors,
        skipped: [],
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
    exports2.runFastCheckTest = runFastCheckTest4;
    var fs6 = __importStar(require("fs"));
    var path10 = __importStar(require("path"));
    var process_runner_1 = require_process_runner();
    var result_parser_1 = require_result_parser();
    async function runFastCheckTest4(testFilePath, properties, config, options) {
      const startTime = Date.now();
      const cwd = path10.dirname(testFilePath);
      const isESM = testFilePath.endsWith(".mjs");
      let mtsPath = null;
      if (options?.needsMtsCopy && options.targetFile) {
        mtsPath = options.targetFile.replace(/\.ts$/, ".mts").replace(/\.tsx$/, ".mtsx");
        fs6.copyFileSync(options.targetFile, mtsPath);
      }
      try {
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
              path10.join(cwd, "node_modules"),
              path10.join(cwd, "..", "..", "node_modules"),
              path10.join(cwd, "..", "..", "..", "node_modules"),
              process.env["NODE_PATH"] ?? ""
            ].join(path10.delimiter)
          }
        });
        const rawResults = (0, result_parser_1.parseJsonLines)(result.stdout);
        return (0, result_parser_1.mapResults)(rawResults, properties, config, Date.now() - startTime, result.stderr, "Test execution error");
      } finally {
        if (mtsPath) {
          try {
            fs6.unlinkSync(mtsPath);
          } catch {
          }
        }
      }
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
    exports2.generateHypothesisTest = generateHypothesisTest3;
    var common_1 = require_dist4();
    var path10 = __importStar(require("path"));
    function toSafeComment(s) {
      return s.replace(/[\r\n\u2028\u2029]/g, " ").slice(0, 200);
    }
    function toPythonLiteral(value) {
      if (value === null || value === void 0)
        return "None";
      if (typeof value === "number") {
        if (Number.isNaN(value))
          return 'float("nan")';
        if (!Number.isFinite(value))
          return value > 0 ? 'float("inf")' : 'float("-inf")';
        return Object.is(value, -0) ? "-0.0" : String(value);
      }
      if (typeof value === "boolean")
        return value ? "True" : "False";
      if (typeof value === "string")
        return JSON.stringify(value);
      if (Array.isArray(value))
        return `[${value.map((item) => toPythonLiteral(item)).join(", ")}]`;
      if (typeof value === "object") {
        return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${toPythonLiteral(item)}`).join(", ")}}`;
      }
      return JSON.stringify(value);
    }
    var MAX_GENERATOR_DEPTH = 10;
    function mapStrategy(spec, depth = 0) {
      if (depth > MAX_GENERATOR_DEPTH) {
        return "st.integers()";
      }
      const c = spec.constraints ?? {};
      switch (spec.type) {
        case "constant":
          return `st.just(${toPythonLiteral(c.value ?? null)})`;
        case "integer":
        case "int": {
          const parts = [];
          if (c.min !== void 0)
            parts.push(`min_value=${Number(c.min)}`);
          if (c.max !== void 0)
            parts.push(`max_value=${Number(c.max)}`);
          return parts.length > 0 ? `st.integers(${parts.join(", ")})` : "st.integers()";
        }
        case "float":
        case "number": {
          const parts = ["allow_nan=False", "allow_infinity=False"];
          if (c.min !== void 0)
            parts.push(`min_value=${Number(c.min)}`);
          if (c.max !== void 0)
            parts.push(`max_value=${Number(c.max)}`);
          return `st.floats(${parts.join(", ")})`;
        }
        case "string":
        case "str": {
          if (c.maxLength !== void 0) {
            return `st.text(max_size=${Number(c.maxLength)})`;
          }
          return "st.text()";
        }
        case "boolean":
        case "bool":
          return "st.booleans()";
        case "array":
        case "list": {
          const items = c.items;
          const elementType = c.element ?? c.elementType;
          let element;
          if (items && typeof items === "object" && typeof items.type === "string") {
            element = mapStrategy({ type: items.type, constraints: items.constraints }, depth + 1);
          } else if (elementType) {
            const nestedConstraints = c.elementConstraints && typeof c.elementConstraints === "object" ? c.elementConstraints : {
              ...(c.elementMin ?? c.min) !== void 0 ? { min: c.elementMin ?? c.min } : {},
              ...(c.elementMax ?? c.max) !== void 0 ? { max: c.elementMax ?? c.max } : {},
              ...c.elementMaxLength !== void 0 ? { maxLength: c.elementMaxLength } : {}
            };
            element = mapStrategy({
              type: String(elementType).replace(/[^a-zA-Z0-9_]/g, ""),
              ...Object.keys(nestedConstraints).length > 0 ? { constraints: nestedConstraints } : {}
            }, depth + 1);
          } else {
            element = "st.integers()";
          }
          const maxLen = c.maxLength ? `, max_size=${Number(c.maxLength)}` : "";
          return `st.lists(${element}${maxLen})`;
        }
        case "dict":
        case "record":
          return "st.dictionaries(st.text(min_size=1, max_size=10), st.integers())";
        case "object": {
          const fields = c.fields;
          if (fields && typeof fields === "object") {
            const entries = Object.entries(fields);
            if (entries.length === 0) {
              return "st.fixed_dictionaries({})";
            }
            const fieldExprs = entries.map(([name, fieldSpec]) => {
              const fs6 = fieldSpec;
              return `${JSON.stringify(name)}: ${mapStrategy({ type: fs6.type, constraints: fs6.constraints }, depth + 1)}`;
            });
            return `st.fixed_dictionaries({${fieldExprs.join(", ")}})`;
          }
          return "st.dictionaries(st.text(min_size=1, max_size=10), st.integers())";
        }
        case "optional": {
          const inner = c.inner;
          if (inner && typeof inner === "object" && typeof inner.type === "string") {
            return `st.one_of(st.just(None), ${mapStrategy({ type: inner.type, constraints: inner.constraints }, depth + 1)})`;
          }
          return "st.one_of(st.just(None), st.integers())";
        }
        case "enum": {
          const values = c.values;
          if (Array.isArray(values) && values.length > 0) {
            return `st.sampled_from([${values.map((v) => toPythonLiteral(v)).join(", ")}])`;
          }
          return "st.integers()";
        }
        default: {
          const fields = c.fields;
          if (fields && typeof fields === "object" && Object.keys(fields).length > 0) {
            return mapStrategy({ type: "object", constraints: spec.constraints }, depth);
          }
          return "st.integers()";
        }
      }
    }
    function translateAssertionToPython(assertion) {
      let translated = assertion;
      translated = translated.replace(/!==/g, "!=");
      translated = translated.replace(/===/g, "==");
      translated = translated.replace(/\btrue\b/g, "True");
      translated = translated.replace(/\bfalse\b/g, "False");
      translated = translated.replace(/\bnull\b/g, "None");
      translated = translated.replace(/\bundefined\b/g, "None");
      translated = translated.replace(/\bMath\.abs\s*\(/g, "abs(");
      translated = translated.replace(/\bparseFloat\s*\(/g, "float(");
      translated = translated.replace(/\bparseInt\s*\(/g, "int(");
      translated = translated.replace(/\bapproxEqual\s*\(/g, "approx_equal(");
      translated = translated.replace(/\s*&&\s*/g, " and ");
      translated = translated.replace(/\s*\|\|\s*/g, " or ");
      translated = translated.replace(/!\s*(?!=)\(/g, "not (");
      translated = translated.replace(/!\s*(?!=)([A-Za-z_][\w.]*(?:\([^()\n]*\))?)/g, "not $1");
      translated = translated.replace(/([A-Za-z_][\w.]*(?:\([^()\n]*\))?)\.length\b/g, "len($1)");
      return translated;
    }
    function generateHypothesisTest3(properties, targetFile, testsDir, config) {
      const targetDir = path10.dirname(targetFile);
      const moduleName = path10.basename(targetFile, path10.extname(targetFile));
      const relTargetDir = (0, common_1.toForwardSlash)(path10.relative(testsDir, targetDir));
      const lines = [];
      lines.push(`# Auto-generated by propcheck \u2014 do not edit manually`);
      lines.push(`# Target: ${(0, common_1.toForwardSlash)(targetFile)}`);
      lines.push(`# Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      lines.push(``);
      lines.push(`import sys`);
      lines.push(`import json`);
      lines.push(`from pathlib import Path`);
      lines.push(``);
      lines.push(`# Add target directory to Python path`);
      lines.push(`sys.path.insert(0, str(Path(__file__).parent / ${JSON.stringify(relTargetDir)}))`);
      lines.push(``);
      lines.push(`from hypothesis import given, settings`);
      lines.push(`from hypothesis import strategies as st`);
      lines.push(`import ${moduleName} as target`);
      lines.push(``);
      lines.push(`def approx_equal(a, b, abs_tol=1e-9, rel_tol=1e-6):`);
      lines.push(`    return abs(a - b) <= abs_tol + rel_tol * max(1, abs(a), abs(b))`);
      lines.push(``);
      lines.push(`MAX_EXAMPLES = ${config.iterations}`);
      lines.push(``);
      for (const prop of properties) {
        const funcName = prop.targetFunction.split(".").pop();
        const generators = Object.entries(prop.generators);
        const givenArgs = generators.map(([name, spec]) => `${name}=${mapStrategy(spec)}`).join(", ");
        const paramNames = generators.map(([name]) => name).join(", ");
        let assertion = prop.assertion.replace(new RegExp(`\\b${funcName}\\(`, "g"), `target.${funcName}(`);
        assertion = translateAssertionToPython(assertion);
        lines.push(`# ${prop.id}: ${toSafeComment(prop.description)}`);
        lines.push(`# Category: ${toSafeComment(prop.category)}`);
        lines.push(`# Evidence: ${toSafeComment(prop.evidence)}`);
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
    exports2.runHypothesisTest = runHypothesisTest3;
    var path10 = __importStar(require("path"));
    var process_runner_1 = require_process_runner();
    var result_parser_1 = require_result_parser();
    var _cachedPythonCmd = null;
    async function findPython() {
      if (_cachedPythonCmd !== null)
        return _cachedPythonCmd;
      for (const cmd of ["python", "python3"]) {
        try {
          const result = await (0, process_runner_1.runProcess)(cmd, ["--version"], { timeout: 5e3 });
          if (result.exitCode === 0) {
            _cachedPythonCmd = cmd;
            return cmd;
          }
        } catch {
        }
      }
      throw new Error("Python not found. Install Python 3.8+ to use Hypothesis engine.");
    }
    async function runHypothesisTest3(testFilePath, properties, config) {
      const startTime = Date.now();
      const python = await findPython();
      const result = await (0, process_runner_1.runProcess)(python, [testFilePath], {
        cwd: path10.dirname(testFilePath),
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
    var fs6 = __importStar(require("fs/promises"));
    var path10 = __importStar(require("path"));
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
      const testsDir = path10.join(storeDir, "tests");
      await fs6.mkdir(testsDir, { recursive: true });
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
        const ext = path10.extname(sourceFilePath);
        const mutantFileName = `_mutant_${mutant.id}${ext}`;
        const mutantFilePath = path10.join(testsDir, mutantFileName);
        try {
          await fs6.writeFile(mutantFilePath, mutant.mutatedSource, "utf8");
          const generated = (0, fc_codegen_1.generateFastCheckTest)(properties, mutantFilePath, testsDir, quickConfig);
          const testFilePath = path10.join(testsDir, `_mut_test_${mutant.id}.js`);
          await fs6.writeFile(testFilePath, generated.content, "utf8");
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
            await fs6.unlink(testFilePath);
          } catch {
          }
        } catch {
          results.push({
            mutantId: mutant.id,
            status: "error"
          });
        } finally {
          try {
            await fs6.unlink(mutantFilePath);
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
var require_dist7 = __commonJS({
  "../engines/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runMutationTesting = exports2.generateMutants = exports2.runProcess = exports2.runHypothesisTest = exports2.generateHypothesisTest = exports2.runFastCheckTest = exports2.generateFastCheckTest = void 0;
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
var fs2 = __toESM(require("fs/promises"));
var path3 = __toESM(require("path"));
var import_config = __toESM(require_dist2());
var import_parser = __toESM(require_dist3());
var import_llm3 = __toESM(require_dist5());
var import_store2 = __toESM(require_dist());
var import_reporter = __toESM(require_dist6());
var import_common2 = __toESM(require_dist4());

// src/commands/infer/weakening.ts
var import_common = __toESM(require_dist4());
var import_llm = __toESM(require_dist5());
function isNumericSpec(spec) {
  return spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int";
}
function getNumericBounds(spec) {
  const c = spec.constraints ?? {};
  const min = typeof c.min === "number" ? c.min : void 0;
  const max = typeof c.max === "number" ? c.max : void 0;
  return { ...min !== void 0 ? { min } : {}, ...max !== void 0 ? { max } : {} };
}
function findTopLevelOperator(expression, operators) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      for (const operator of operators) {
        if (expression.startsWith(operator, i)) {
          return { left: expression.slice(0, i).trim(), operator, right: expression.slice(i + operator.length).trim() };
        }
      }
    }
  }
  return null;
}
function weakenExactEquality(assertion) {
  const match = findTopLevelOperator(assertion.trim(), ["!==", "==="]);
  if (!match || !match.left || !match.right) return null;
  return match.operator === "!==" ? `!approxEqual(${match.left}, ${match.right})` : `approxEqual(${match.left}, ${match.right})`;
}
function parseTinyTolerance(assertion) {
  const trimmed = assertion.trim();
  if (!trimmed.startsWith("Math.abs(")) return null;
  const start = "Math.abs(".length;
  let depth = 0;
  let closeIndex = -1;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    if (ch === ")") {
      if (depth === 0) {
        closeIndex = i;
        break;
      }
      depth--;
    }
  }
  if (closeIndex === -1) return null;
  const body = trimmed.slice(start, closeIndex).trim();
  const remainder = trimmed.slice(closeIndex + 1).trim();
  if (!/^(?:<|<=)\s*1e-(?:9|[1-9]\d+)$/i.test(remainder)) return null;
  const diff = findTopLevelOperator(body, ["-"]);
  if (!diff || !diff.left || !diff.right) return null;
  return { left: diff.left, right: diff.right };
}
function weakenTinyTolerance(assertion) {
  const parsed = parseTinyTolerance(assertion);
  if (!parsed) return null;
  return `approxEqual(${parsed.left}, ${parsed.right}, 1e-6, 1e-6)`;
}
function weakenMissingPrecondition(assertion) {
  const trimmed = assertion.trim();
  if (!trimmed) return null;
  if (/\btry\b|\bcatch\b/.test(trimmed)) return null;
  return `(() => { try { return ${trimmed}; } catch { return true; } })()`;
}
function tightenWideNumericGenerators(generators) {
  const next = Object.fromEntries(Object.entries(generators).map(([name, spec]) => {
    if (isNumericSpec(spec)) {
      const { min, max } = getNumericBounds(spec);
      if (min === void 0 && max === void 0) {
        return [name, { ...spec, constraints: { ...spec.constraints ?? {}, min: 0, max: 1e6 } }];
      }
      if (min !== void 0 && max !== void 0 && Math.abs(max - min) > 1e6) {
        return [name, { ...spec, constraints: { ...spec.constraints ?? {}, min: Math.max(min, 0), max: Math.min(max, 1e6) } }];
      }
    }
    if (spec.type === "array") {
      const c = spec.constraints ?? {};
      const elementType = c.element ?? c.elementType;
      if (elementType === "float" || elementType === "number" || elementType === "integer" || elementType === "int") {
        const eMin = typeof (c.elementMin ?? c.min) === "number" ? Number(c.elementMin ?? c.min) : void 0;
        const eMax = typeof (c.elementMax ?? c.max) === "number" ? Number(c.elementMax ?? c.max) : void 0;
        if (eMin === void 0 && eMax === void 0) {
          return [name, { ...spec, constraints: { ...c, elementMin: 0, elementMax: 1e6 } }];
        }
        if (eMin !== void 0 && eMax !== void 0 && Math.abs(eMax - eMin) > 1e6) {
          return [name, { ...spec, constraints: { ...c, elementMin: Math.max(eMin, 0), elementMax: Math.min(eMax, 1e6) } }];
        }
      }
    }
    return [name, spec];
  }));
  return Object.freeze(next);
}
function refreshRiskMetadata(property) {
  const preservedTags = property.riskTags.filter((tag) => tag === "doc_domain_mismatch" || tag === "missing_precondition");
  const riskTags = [.../* @__PURE__ */ new Set([...(0, import_llm.detectRiskTags)(property), ...preservedTags])];
  return { ...property, riskTags, riskScore: (0, import_llm.computeRiskScore)(property, property.score, riskTags) };
}
function autoWeakenProperty(property) {
  if (property.status === "refined") return null;
  let assertion = property.assertion;
  let generators = property.generators;
  let changed = false;
  if (property.riskTags.includes("float_exact_equality")) {
    const weakened = weakenExactEquality(assertion);
    if (weakened && weakened !== assertion) {
      assertion = weakened;
      changed = true;
    }
  }
  if (property.riskTags.includes("tiny_abs_tolerance")) {
    const weakened = weakenTinyTolerance(assertion);
    if (weakened && weakened !== assertion) {
      assertion = weakened;
      changed = true;
    }
  }
  if (property.riskTags.includes("wide_numeric_domain")) {
    const tightened = tightenWideNumericGenerators(generators);
    if (!(0, import_common.deepEqual)(tightened, generators)) {
      generators = tightened;
      changed = true;
    }
  }
  if (property.riskTags.includes("missing_precondition")) {
    const weakened = weakenMissingPrecondition(assertion);
    if (weakened && weakened !== assertion) {
      assertion = weakened;
      changed = true;
    }
  }
  if (!changed) return null;
  return refreshRiskMetadata({ ...property, assertion, generators, status: "refined" });
}
function detectDocDomainRiskTags(property, context) {
  const functionName = property.targetFunction.split(".").pop() ?? property.targetFunction;
  const doc = context.signals.doc.find((entry) => entry.functionName === property.targetFunction || entry.functionName === functionName);
  if (!doc) return [];
  for (const [paramName, spec] of Object.entries(property.generators)) {
    const docText = doc.paramDocs[paramName]?.toLowerCase();
    if (!docText || !isNumericSpec(spec)) continue;
    const { min, max } = getNumericBounds(spec);
    if (/0\s*(?:-|to)\s*100|0-100|0 to 100|percentage|percent/.test(docText) && (min !== 0 || max !== 100)) return ["doc_domain_mismatch"];
    if (/non-negative|nonnegative|>=\s*0|positive/.test(docText) && min === void 0) return ["doc_domain_mismatch"];
  }
  return [];
}
function applyRiskMetadata(properties, context) {
  return properties.map((property) => {
    const riskTags = [.../* @__PURE__ */ new Set([...property.riskTags, ...detectDocDomainRiskTags(property, context)])];
    return { ...property, riskTags, riskScore: (0, import_llm.computeRiskScore)(property, property.score, riskTags), status: riskTags.length > 0 ? "risky" : "accepted" };
  });
}

// src/commands/infer/validation.ts
var fs = __toESM(require("fs/promises"));
var path2 = __toESM(require("path"));
var import_engines = __toESM(require_dist7());
var import_llm2 = __toESM(require_dist5());
var MAX_CANARY_CASES = 8;
var MAX_REPAIR_ROUNDS = 3;
async function ensureTestsDir(storeDir) {
  const testsDir = path2.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });
  return testsDir;
}
function buildValidationEvidence(smokePasses, canaryPasses) {
  return { smokePasses, canaryPasses, seedsTested: [], lastValidatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function buildCandidateValues(spec) {
  const c = spec.constraints ?? {};
  if (spec.type === "boolean") return [false, true];
  if (spec.type === "string") {
    const maxSize = typeof c.maxLength === "number" ? Math.max(1, c.maxLength) : 1;
    return ["", "x", "0".slice(0, maxSize)];
  }
  if (isNumericSpec(spec)) {
    const defaults = spec.type === "integer" || spec.type === "int" ? [0, 1, -1, 42, -42, Number.MAX_SAFE_INTEGER - 1] : [0, Number.EPSILON, 0.1, 0.2, 0.3, 1e-12, 1e6];
    const { min, max } = getNumericBounds(spec);
    const filtered = defaults.filter((v) => {
      if (!Number.isFinite(v)) return false;
      if (min !== void 0 && v < min) return false;
      if (max !== void 0 && v > max) return false;
      return true;
    });
    if (filtered.length > 0) {
      return [...new Set(filtered.map((v) => spec.type === "integer" || spec.type === "int" ? Math.trunc(v) : v))];
    }
    const fallback = [];
    if (min !== void 0) fallback.push(spec.type === "integer" || spec.type === "int" ? Math.trunc(min) : min);
    if (max !== void 0) fallback.push(spec.type === "integer" || spec.type === "int" ? Math.trunc(max) : max);
    return fallback.length > 0 ? [...new Set(fallback)] : [spec.type === "integer" || spec.type === "int" ? 0 : 0];
  }
  if (spec.type === "array") {
    const elementType = c.element ?? c.elementType;
    const nestedSpec = {
      type: typeof elementType === "string" ? elementType : "integer",
      constraints: {
        ...(c.elementMin ?? c.min) !== void 0 ? { min: c.elementMin ?? c.min } : {},
        ...(c.elementMax ?? c.max) !== void 0 ? { max: c.elementMax ?? c.max } : {},
        ...c.elementMaxLength !== void 0 ? { maxLength: c.elementMaxLength } : {}
      }
    };
    const elementValues = buildCandidateValues(nestedSpec);
    const singleton = elementValues[0] ?? 0;
    const second = elementValues[1] ?? singleton;
    const maxLength = typeof c.maxLength === "number" ? c.maxLength : void 0;
    const arrays = [];
    if (maxLength === void 0 || maxLength >= 0) arrays.push([]);
    if (maxLength === void 0 || maxLength >= 1) arrays.push([singleton]);
    if (maxLength === void 0 || maxLength >= 2) arrays.push([singleton, singleton]);
    if (maxLength === void 0 || maxLength >= 2) arrays.push([singleton, second]);
    return arrays;
  }
  if (spec.type === "object") {
    const fields = c.fields;
    if (fields && typeof fields === "object") {
      const entries = Object.entries(fields);
      const obj = {};
      for (const [name, fieldSpec] of entries) {
        const fSpec = fieldSpec;
        const vals = buildCandidateValues({ type: fSpec.type, constraints: fSpec.constraints });
        obj[name] = vals[0] ?? null;
      }
      return [obj];
    }
    return [{}];
  }
  if (spec.type === "optional") {
    const inner = c.inner;
    if (inner && typeof inner === "object" && typeof inner.type === "string") {
      const vals = buildCandidateValues({ type: inner.type, constraints: inner.constraints });
      return [void 0, vals[0] ?? null];
    }
    return [void 0, null];
  }
  if (spec.type === "enum") {
    const values = c.values;
    if (Array.isArray(values) && values.length > 0) return values;
    return [];
  }
  return [];
}
function buildCanaryCases(property) {
  const entries = Object.entries(property.generators);
  if (entries.length === 0) return [{}];
  const candidates = entries.map(([name, spec]) => [name, buildCandidateValues(spec)]);
  if (candidates.some(([, values]) => values.length === 0)) return [];
  const baseline = Object.fromEntries(candidates.map(([name, values]) => [name, values[0]]));
  const cases = [baseline];
  const seen = /* @__PURE__ */ new Set([JSON.stringify(baseline)]);
  for (const [name, values] of candidates) {
    for (const value of values.slice(1)) {
      const nextCase = { ...baseline, [name]: value };
      const key = JSON.stringify(nextCase);
      if (!seen.has(key)) {
        seen.add(key);
        cases.push(nextCase);
      }
      if (cases.length >= MAX_CANARY_CASES) return cases;
    }
  }
  return cases;
}
function buildConstantGenerators(input) {
  return Object.freeze(Object.fromEntries(
    Object.entries(input).map(([name, value]) => [name, { type: "constant", constraints: { value } }])
  ));
}
async function executeTrialRun(properties, targetPath, testsDir, config, language) {
  const generated = language === "python" ? (0, import_engines.generateHypothesisTest)(properties, targetPath, testsDir, config) : (0, import_engines.generateFastCheckTest)(properties, targetPath, testsDir, config);
  const testFilePath = path2.join(testsDir, generated.fileName);
  await fs.writeFile(testFilePath, generated.content, "utf8");
  try {
    const fcGenerated = language !== "python" ? generated : null;
    return language === "python" ? await (0, import_engines.runHypothesisTest)(testFilePath, properties, config) : await (0, import_engines.runFastCheckTest)(testFilePath, properties, config, {
      targetFile: targetPath,
      needsMtsCopy: fcGenerated?.needsMtsCopy
    });
  } finally {
    try {
      await fs.unlink(testFilePath);
    } catch {
    }
  }
}
async function canaryValidateProperties(properties, targetPath, storeDir, language) {
  const testsDir = await ensureTestsDir(storeDir);
  const canaryConfig = { mode: "quick", iterations: 1, timeout: 15e3, verbose: false };
  const validated = [];
  const quarantined = [];
  for (const property of properties) {
    if (property.riskTags.length === 0) {
      validated.push({ ...property, validation: buildValidationEvidence(100, 0) });
      continue;
    }
    const canaryCases = buildCanaryCases(property);
    if (canaryCases.length === 0) {
      validated.push({ ...property, status: property.status === "refined" ? "refined" : "risky", validation: buildValidationEvidence(100, 0) });
      continue;
    }
    let canaryPasses = 0;
    let failureReason = null;
    for (const input of canaryCases) {
      const canaryProperty = { ...property, generators: buildConstantGenerators(input) };
      const result = await executeTrialRun([canaryProperty], targetPath, testsDir, canaryConfig, language);
      const failed = result.failed[0];
      const error = result.errors[0];
      if (failed || error) {
        failureReason = failed?.errorMessage ?? error?.errorMessage ?? `canary failed for ${JSON.stringify(input)}`;
        break;
      }
      canaryPasses++;
    }
    if (failureReason) {
      const weakened = autoWeakenProperty(property);
      if (weakened) {
        const rerun = await canaryValidateProperties([weakened], targetPath, storeDir, language);
        if (rerun.validated.length > 0) {
          validated.push(rerun.validated[0]);
          continue;
        }
        if (rerun.quarantined.length > 0) {
          quarantined.push(rerun.quarantined[0]);
          continue;
        }
      }
      quarantined.push({ prop: { ...property, status: "quarantined", validation: buildValidationEvidence(100, canaryPasses) }, reason: failureReason });
      continue;
    }
    validated.push({ ...property, status: property.status === "refined" ? "refined" : "risky", validation: buildValidationEvidence(100, canaryPasses) });
  }
  return { validated, quarantined };
}
async function trialRunValidation(properties, targetPath, storeDir, sourceCode, llmClient, isMock, language) {
  const testsDir = await ensureTestsDir(storeDir);
  const trialConfig = { mode: "quick", iterations: 100, timeout: 15e3, verbose: false };
  let currentProperties = [...properties];
  const validated = [];
  const dropped = [];
  let totalRepaired = 0;
  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    if (currentProperties.length === 0) break;
    const result = await executeTrialRun(currentProperties, targetPath, testsDir, trialConfig, language);
    const passedIds = new Set(result.passed.map((p) => p.propertyId));
    const failedIds = new Set(result.failed.map((f) => f.propertyId));
    const errorIds = new Set(result.errors.map((e) => e.propertyId));
    const needsRepair = [];
    for (const prop of currentProperties) {
      if (passedIds.has(prop.id)) {
        validated.push(prop);
      } else if (failedIds.has(prop.id)) {
        if (round < MAX_REPAIR_ROUNDS) {
          const weakened = autoWeakenProperty(prop);
          if (weakened) {
            needsRepair.push(weakened);
            totalRepaired++;
            console.log(`    \u21BB Adjusting: ${prop.targetFunction}: ${prop.description} \u2014 too strict, relaxing... (attempt ${round + 1})`);
            continue;
          }
        }
        validated.push(prop);
      } else if (errorIds.has(prop.id)) {
        const err = result.errors.find((e) => e.propertyId === prop.id);
        const errorMsg = err?.errorMessage ?? "unknown error";
        if (round < MAX_REPAIR_ROUNDS) {
          const funcSig = `${prop.targetFunction}(...)`;
          let repaired = null;
          if (isMock) {
            repaired = (0, import_llm2.mockRepairProperty)(prop, errorMsg);
          } else if (llmClient) {
            repaired = await (0, import_llm2.repairProperty)(llmClient, prop, errorMsg, sourceCode, funcSig);
          }
          if (repaired) {
            needsRepair.push(repaired);
            totalRepaired++;
            console.log(`    \u21BB Repairing: ${prop.targetFunction}: ${prop.description} (round ${round + 1})`);
          } else {
            dropped.push({ prop, reason: `codegen error (repair failed round ${round + 1}): ${errorMsg}` });
          }
        } else {
          dropped.push({ prop, reason: `codegen error (max ${MAX_REPAIR_ROUNDS} repairs): ${errorMsg}` });
        }
      } else {
        dropped.push({ prop, reason: "no output from trial run" });
      }
    }
    currentProperties = needsRepair;
  }
  return { validated, dropped, repaired: totalRepaired };
}

// src/commands/infer.ts
function isSupportedLanguage(lang) {
  return lang === "typescript" || lang === "javascript" || lang === "python";
}
function findReferencedTypeNames(functions, allTypes) {
  const typeNames = new Set(allTypes.map((t) => t.name));
  const referenced = /* @__PURE__ */ new Set();
  for (const fn of functions) {
    for (const typeName of typeNames) {
      if (fn.returnType?.includes(typeName)) {
        referenced.add(typeName);
      }
      for (const param of fn.parameters) {
        if (param.type?.includes(typeName)) {
          referenced.add(typeName);
        }
      }
      if (fn.docstring?.includes(typeName)) {
        referenced.add(typeName);
      }
    }
  }
  return referenced;
}
function trimSourceCode(fullSource, matchedFunctions, referencedTypes) {
  const lines = fullSource.split("\n");
  const ranges = [];
  const allStarts = [
    ...matchedFunctions.map((f) => f.loc.startLine),
    ...referencedTypes.map((t) => t.loc.startLine)
  ];
  if (allStarts.length > 0) {
    const firstDeclLine = Math.min(...allStarts);
    if (firstDeclLine > 1) {
      ranges.push([1, firstDeclLine - 1]);
    }
  }
  for (const fn of matchedFunctions) {
    ranges.push([fn.loc.startLine, fn.loc.endLine]);
  }
  for (const t of referencedTypes) {
    ranges.push([t.loc.startLine, t.loc.endLine]);
  }
  if (ranges.length === 0) return fullSource;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }
  const parts = [];
  for (const [start, end] of merged) {
    const s = Math.max(0, start - 1);
    const e = Math.min(lines.length, end);
    parts.push(lines.slice(s, e).join("\n"));
  }
  return parts.join("\n\n// ... (trimmed)\n\n");
}
function matchesFunctionName(fn, name) {
  return fn.name === name || fn.qualifiedName === name || fn.qualifiedName.endsWith("." + name);
}
function filterContextByFunctions(context, functionNames) {
  const matchedFunctions = context.functions.filter(
    (fn) => functionNames.some((name) => matchesFunctionName(fn, name))
  );
  const refTypeNames = findReferencedTypeNames(matchedFunctions, context.types);
  const matchedTypes = context.types.filter((t) => refTypeNames.has(t.name));
  const trimmedSource = trimSourceCode(
    context.sourceCode,
    matchedFunctions,
    matchedTypes
  );
  const matchedQualNames = new Set(matchedFunctions.map((f) => f.qualifiedName));
  const matchedNames = new Set(matchedFunctions.map((f) => f.name));
  const filteredDoc = context.signals.doc.filter(
    (d) => matchedQualNames.has(d.functionName) || matchedNames.has(d.functionName)
  );
  const filteredType = context.signals.type.filter(
    (t) => matchedQualNames.has(t.functionName) || matchedNames.has(t.functionName)
  );
  return {
    filePath: context.filePath,
    language: context.language,
    sourceCode: trimmedSource,
    functions: matchedFunctions,
    types: matchedTypes,
    imports: context.imports,
    signals: {
      ast: context.signals.ast,
      type: filteredType,
      doc: filteredDoc
    }
  };
}
async function inferCommand(target, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config.loadConfig)(projectRoot, {
    mock: options.mock,
    model: options.model,
    provider: options.provider,
    baseURL: options.baseUrl
  });
  const targetPath = path3.resolve(projectRoot, target);
  if (!targetPath.startsWith(projectRoot + path3.sep) && targetPath !== projectRoot) {
    console.error(`
  Error: Target file must be within the project root.
`);
    process.exit(2);
  }
  let targetStat;
  try {
    targetStat = await fs2.stat(targetPath);
  } catch {
    console.error(`
  Error: File not found: ${target}
`);
    process.exit(2);
  }
  if (targetStat.isDirectory()) {
    const sourceFiles = (0, import_common2.findSourceFiles)(targetPath);
    if (sourceFiles.length === 0) {
      console.error(`
  No source files found in ${target}/
`);
      process.exit(2);
    }
    console.log(`
  Found ${sourceFiles.length} source file(s) in ${target}/
`);
    for (const filePath of sourceFiles) {
      const relPath = path3.relative(projectRoot, filePath);
      await inferCommand(relPath, options);
    }
    return;
  }
  const language = (0, import_parser.detectLanguage)(targetPath);
  if (!isSupportedLanguage(language)) {
    console.error(`
  Error: Unsupported file type. Supported: .ts, .tsx, .js, .jsx, .py
`);
    process.exit(2);
  }
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
  const storeDir = path3.join(projectRoot, config.storeDir);
  const MAX_SOURCE_BYTES = 5e5;
  const stat3 = await fs2.stat(targetPath);
  if (stat3.size > MAX_SOURCE_BYTES) {
    console.error(`
  Error: File too large (${stat3.size} bytes). Max: ${MAX_SOURCE_BYTES} bytes.
`);
    process.exit(2);
  }
  const source = await fs2.readFile(targetPath, "utf8");
  const context = language === "python" ? (0, import_parser.analyzePythonFile)(targetPath, source) : (0, import_parser.analyzeFile)(targetPath, source, language);
  let inferContext = context;
  if (options.function) {
    const names = options.function.split(",").map((n) => n.trim()).filter(Boolean);
    const missing = names.filter(
      (name) => !context.functions.some((fn) => matchesFunctionName(fn, name))
    );
    if (missing.length > 0) {
      const available = context.functions.map((fn) => fn.qualifiedName).join(", ");
      console.error(`
  Error: Function(s) not found: ${missing.join(", ")}`);
      console.error(`  Available: ${available}
`);
      process.exit(2);
    }
    inferContext = filterContextByFunctions(context, names);
  }
  if (inferContext.functions.length === 0) {
    console.log(`
  No exported functions found in ${target}
`);
    return;
  }
  console.log(`
  Analyzing ${inferContext.functions.length} function${inferContext.functions.length === 1 ? "" : "s"} in ${target}...`);
  const maxPropsRaw = parseInt(options.maxProperties ?? "5", 10);
  if (options.maxProperties !== void 0 && isNaN(maxPropsRaw)) {
    console.error(`
  Error: --max-properties must be a number, got "${options.maxProperties}"
`);
    process.exit(2);
  }
  const maxProperties = Math.min(Math.max(1, maxPropsRaw || 5), 20);
  const minScoreRaw = parseInt(options.minScore ?? "10", 10);
  if (options.minScore !== void 0 && isNaN(minScoreRaw)) {
    console.error(`
  Error: --min-score must be a number, got "${options.minScore}"
`);
    process.exit(2);
  }
  const minScore = Math.min(Math.max(0, minScoreRaw || 10), 15);
  let result;
  try {
    result = await (0, import_llm3.inferProperties)(config.apiKey, config.model, inferContext, {
      maxProperties,
      minScore,
      mock: config.mock,
      provider: config.provider,
      baseURL: config.baseURL
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API key") || msg.includes("AUTH_ERROR")) {
      console.error(`
  Error: Invalid API key. Check your PROPCHECK_API_KEY or ANTHROPIC_API_KEY.
`);
    } else {
      console.error(`
  Error: LLM API call failed: ${msg}
`);
    }
    process.exit(1);
  }
  result = {
    ...result,
    properties: applyRiskMetadata(result.properties, inferContext)
  };
  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }
  let finalProperties = result.properties;
  if (!options.skipValidation) {
    const testsDir = await ensureTestsDir(storeDir);
    console.log(`  Validating ${result.properties.length} rules (quick test, 100 random inputs each)...`);
    const llmClient = config.mock ? null : config.apiKey ? (0, import_llm3.createClient)(config.apiKey, config.model, config.provider, config.baseURL) : null;
    const { validated, dropped, repaired } = await trialRunValidation(
      result.properties,
      targetPath,
      storeDir,
      source,
      llmClient,
      config.mock,
      language
    );
    if (repaired > 0) {
      console.log(`  Fixed ${repaired} rule${repaired === 1 ? "" : "s"} that ${repaired === 1 ? "was" : "were"} too strict.`);
    }
    if (dropped.length > 0) {
      console.log(`  Dropped ${dropped.length} properties during validation:`);
      for (const { prop, reason } of dropped) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason}]`);
      }
    }
    const { validated: canaryValidated, quarantined } = await canaryValidateProperties(
      validated,
      targetPath,
      storeDir,
      language
    );
    if (quarantined.length > 0) {
      console.log(`  Quarantined ${quarantined.length} fragile propert${quarantined.length === 1 ? "y" : "ies"} after edge-case validation:`);
      for (const { prop, reason } of quarantined) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason.length > 80 ? reason.slice(0, 77) + "..." : reason}]`);
      }
    }
    finalProperties = [...canaryValidated, ...quarantined.map(({ prop }) => prop)];
    if (finalProperties.length === 0) {
      console.log("  No properties survived validation.\n");
      return;
    }
    const activeProperties = finalProperties.filter((property) => property.status !== "quarantined");
    if (options.refine && activeProperties.length > 0) {
      console.log(`
  Refinement Round 2: analyzing ${activeProperties.length} properties...`);
      const fullConfig = { mode: "quick", iterations: 100, timeout: 15e3, verbose: false };
      const execResult = await executeTrialRun(
        activeProperties,
        targetPath,
        testsDir,
        fullConfig,
        language
      );
      const classifications = (0, import_llm3.classifyProperties)(activeProperties, execResult);
      const functionNames = inferContext.functions.map((f) => f.qualifiedName);
      const feedback = (0, import_llm3.buildFeedbackSummary)(classifications, functionNames);
      const strong = classifications.filter((c) => c.kind === "strong");
      const weak = classifications.filter((c) => c.kind === "weak");
      const bugs = classifications.filter((c) => c.kind === "bug_found");
      console.log(`    Strong: ${strong.length} | Weak: ${weak.length} | Bugs: ${bugs.length}`);
      if (weak.length > 0 || bugs.length > 0) {
        let improvedProperties;
        if (config.mock) {
          improvedProperties = applyRiskMetadata((0, import_llm3.mockRefineProperties)(classifications), inferContext);
        } else if (llmClient) {
          const refineResult = await (0, import_llm3.refineProperties)(config.apiKey, config.model, inferContext, feedback, {
            maxProperties,
            minScore,
            mock: false,
            provider: config.provider,
            baseURL: config.baseURL
          });
          improvedProperties = applyRiskMetadata(refineResult.properties, inferContext);
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
            config.mock,
            language
          );
          const { validated: improvedCanaryValidated, quarantined: improvedQuarantined } = await canaryValidateProperties(
            improvedValidated,
            targetPath,
            storeDir,
            language
          );
          const strongProps = classifications.filter((c) => c.kind === "strong" || c.kind === "bug_found").map((c) => c.property);
          const quarantinedProps = finalProperties.filter((property) => property.status === "quarantined");
          const existingAssertions = new Set(strongProps.map((p) => p.assertion));
          const improvedCombined = [...improvedCanaryValidated, ...improvedQuarantined.map(({ prop }) => prop)];
          const newUnique = improvedCombined.filter((p) => !existingAssertions.has(p.assertion));
          finalProperties = [...strongProps, ...newUnique, ...quarantinedProps];
          console.log(`    Final: ${finalProperties.length} properties after refinement`);
        }
      } else {
        console.log(`    All properties are strong \u2014 no refinement needed`);
      }
    }
  }
  const moduleKey = (0, import_common2.toForwardSlash)(path3.relative(projectRoot, targetPath));
  const propertySet = {
    schemaVersion: 2,
    module: moduleKey,
    filePath: moduleKey,
    properties: finalProperties,
    sourceHash: (0, import_common2.hashContent)(source),
    inferredAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await (0, import_store2.setProperties)(storeDir, moduleKey, propertySet);
  const finalResult = { ...result, properties: finalProperties };
  (0, import_reporter.reportInferResult)(finalResult, moduleKey);
}

// src/commands/run.ts
var fs3 = __toESM(require("fs/promises"));
var path4 = __toESM(require("path"));
var import_config2 = __toESM(require_dist2());
var import_store3 = __toESM(require_dist());
var import_engines2 = __toESM(require_dist7());
var import_reporter2 = __toESM(require_dist6());
var import_common3 = __toESM(require_dist4());
function parseIdList(input) {
  return new Set(
    (input ?? "").split(",").map((part) => part.trim()).filter(Boolean)
  );
}
async function runCommand(target, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config2.loadConfig)(projectRoot);
  const storeDir = path4.join(projectRoot, config.storeDir);
  const mode = options.quick ? "quick" : options.thorough ? "thorough" : "default";
  const runConfig = {
    mode,
    iterations: import_common3.RUN_MODE_ITERATIONS[mode],
    timeout: config.timeout,
    seed: options.seed ? Number.isNaN(parseInt(options.seed, 10)) ? void 0 : parseInt(options.seed, 10) : void 0,
    verbose: false
  };
  let propertySets;
  if (options.changed) {
    const changedResult = (0, import_common3.getChangedFiles)(projectRoot);
    if (changedResult.status === "git_error") {
      console.error(`
  Error: git is not available or this is not a git repository.`);
      console.error("  --changed mode requires a git repository.\n");
      process.exit(2);
    }
    const changedPaths = new Set(
      changedResult.files.map((f) => (0, import_common3.toForwardSlash)(f.filePath)).filter(
        (p) => (
          // Exclude internal files, build artifacts, and non-source files
          !p.startsWith(".propcheck/") && !p.startsWith("node_modules/") && !p.includes("/dist/") && !p.includes("/dist-bundle/") && /\.(ts|tsx|js|jsx|py)$/.test(p)
        )
      )
    );
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
    const targetPath = path4.resolve(projectRoot, target);
    let stat3;
    try {
      stat3 = await fs3.stat(targetPath);
    } catch {
      console.error(`
  Error: File not found: ${target}
`);
      process.exit(2);
    }
    if (stat3.isDirectory()) {
      const allSets = await (0, import_store3.getAllProperties)(storeDir);
      const sourceFiles = (0, import_common3.findSourceFiles)(targetPath);
      const sourceKeys = new Set(sourceFiles.map((f) => (0, import_common3.toForwardSlash)(path4.relative(projectRoot, f))));
      propertySets = allSets.filter((ps) => sourceKeys.has(ps.filePath));
      if (propertySets.length === 0) {
        console.error(`
  No properties found for files in ${target}/`);
        console.error(`  Run: propcheck infer <file> on source files first.
`);
        process.exit(2);
      }
      console.log(`
  Running properties for ${propertySets.length} file(s) in ${target}/...
`);
    } else {
      const moduleKey = (0, import_common3.toForwardSlash)(path4.relative(projectRoot, targetPath));
      const ps = await (0, import_store3.getProperties)(storeDir, moduleKey);
      if (!ps) {
        console.error(`
  No properties found for ${target}`);
        console.error("  Run: propcheck infer " + target + "\n");
        process.exit(2);
      }
      propertySets = [ps];
    }
  } else {
    propertySets = await (0, import_store3.getAllProperties)(storeDir);
    if (propertySets.length === 0) {
      console.error("\n  No properties found. Run: propcheck infer <file>\n");
      process.exit(2);
    }
  }
  const skipIds = parseIdList(options.skip);
  const onlyIds = parseIdList(options.only);
  const hasOnlyFilter = onlyIds.size > 0;
  let exitCode = 0;
  let ranAnyProperties = false;
  for (const ps of propertySets) {
    const filePath = path4.resolve(projectRoot, ps.filePath);
    try {
      const currentSource = await fs3.readFile(filePath, "utf8");
      const currentHash = (0, import_common3.hashContent)(currentSource);
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
    const explicitSkipped = ps.properties.filter((prop) => {
      if (skipIds.has(prop.id)) return true;
      return hasOnlyFilter && !onlyIds.has(prop.id);
    });
    const droppedSkipped = ps.properties.filter((prop) => !explicitSkipped.includes(prop) && prop.status === "dropped");
    const quarantinedSkipped = ps.properties.filter((prop) => !explicitSkipped.includes(prop) && !droppedSkipped.includes(prop) && prop.status === "quarantined" && !options.includeQuarantined);
    const skipped = [
      ...explicitSkipped.map((prop) => ({ propertyId: prop.id, reason: "filter", propertyStatus: prop.status })),
      ...droppedSkipped.map((prop) => ({ propertyId: prop.id, reason: "dropped", propertyStatus: prop.status })),
      ...quarantinedSkipped.map((prop) => ({ propertyId: prop.id, reason: "quarantined", propertyStatus: prop.status }))
    ];
    const runnableProperties = ps.properties.filter((prop) => !explicitSkipped.includes(prop) && !droppedSkipped.includes(prop) && !(prop.status === "quarantined" && !options.includeQuarantined));
    if (!options.json && !hasOnlyFilter && quarantinedSkipped.length > 0) {
      console.log(`  Skipping ${quarantinedSkipped.length} quarantined propert${quarantinedSkipped.length === 1 ? "y" : "ies"} in ${ps.filePath}. Use --include-quarantined to run them.`);
    }
    if (!options.json && !hasOnlyFilter && droppedSkipped.length > 0) {
      console.log(`  Skipping ${droppedSkipped.length} dropped propert${droppedSkipped.length === 1 ? "y" : "ies"} in ${ps.filePath}.`);
    }
    if (!options.json && !hasOnlyFilter && explicitSkipped.length > 0) {
      console.log(`  Skipping ${explicitSkipped.length} propert${explicitSkipped.length === 1 ? "y" : "ies"} in ${ps.filePath} due to --skip/--only filters.`);
    }
    if (runnableProperties.length === 0) {
      if (options.json) {
        console.log((0, import_reporter2.reportAsJson)({
          passed: [],
          failed: [],
          errors: [],
          skipped,
          duration: 0,
          totalIterations: 0,
          properties: []
        }));
      }
      continue;
    }
    ranAnyProperties = true;
    const testsDir = path4.join(storeDir, "tests");
    await fs3.mkdir(testsDir, { recursive: true });
    const isPython = ps.filePath.endsWith(".py");
    const generated = isPython ? (0, import_engines2.generateHypothesisTest)(runnableProperties, filePath, testsDir, runConfig) : (0, import_engines2.generateFastCheckTest)(runnableProperties, filePath, testsDir, runConfig);
    const testFilePath = path4.join(testsDir, generated.fileName);
    await fs3.writeFile(testFilePath, generated.content, "utf8");
    const fcGenerated = !isPython ? generated : null;
    const result = isPython ? await (0, import_engines2.runHypothesisTest)(testFilePath, runnableProperties, runConfig) : await (0, import_engines2.runFastCheckTest)(testFilePath, runnableProperties, runConfig, {
      targetFile: filePath,
      needsMtsCopy: fcGenerated?.needsMtsCopy
    });
    const enrichedResult = {
      ...result,
      skipped
    };
    if (options.json) {
      console.log((0, import_reporter2.reportAsJson)(enrichedResult, ps.filePath));
    } else {
      (0, import_reporter2.reportRunSummary)(enrichedResult, ps.filePath);
    }
    if (result.failed.length > 0 || result.errors.length > 0) {
      exitCode = 1;
    }
  }
  if (!ranAnyProperties) {
    if (hasOnlyFilter) {
      const requested = [...onlyIds].join(", ");
      if (!options.json) {
        console.error(`
  No properties matched --only filter: ${requested}`);
        console.error("  Check property IDs with: propcheck props\n");
      }
      process.exit(2);
    }
    if (!options.json) {
      console.log("\n  No runnable properties remain after applying status and CLI filters.\n");
    }
  }
  process.exit(exitCode);
}

// src/commands/badge.ts
var path5 = __toESM(require("path"));
var import_config3 = __toESM(require_dist2());
var import_store4 = __toESM(require_dist());
async function badgeCommand() {
  const projectRoot = process.cwd();
  const config = (0, import_config3.loadConfig)(projectRoot);
  const storeDir = path5.join(projectRoot, config.storeDir);
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
var fs4 = __toESM(require("fs/promises"));
var path6 = __toESM(require("path"));
var import_config4 = __toESM(require_dist2());
var import_store5 = __toESM(require_dist());
var import_engines3 = __toESM(require_dist7());
var import_common4 = __toESM(require_dist4());
var import_chalk = __toESM(require("chalk"));
async function qualityCommand(target) {
  const projectRoot = process.cwd();
  const config = (0, import_config4.loadConfig)(projectRoot);
  const storeDir = path6.join(projectRoot, config.storeDir);
  const targetPath = path6.resolve(projectRoot, target);
  try {
    await fs4.access(targetPath);
  } catch {
    console.error(`
  Error: File not found: ${target}
`);
    process.exit(2);
  }
  const moduleKey = (0, import_common4.toForwardSlash)(path6.relative(projectRoot, targetPath));
  const ps = await (0, import_store5.getProperties)(storeDir, moduleKey);
  if (!ps || ps.properties.length === 0) {
    console.error(`
  No properties found for ${target}`);
    console.error("  Run: propcheck infer " + target + " first\n");
    process.exit(2);
  }
  const source = await fs4.readFile(targetPath, "utf8");
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

// src/commands/props.ts
var path7 = __toESM(require("path"));
var import_config5 = __toESM(require_dist2());
var import_store6 = __toESM(require_dist());
var import_reporter3 = __toESM(require_dist6());
var import_common5 = __toESM(require_dist4());
var VALID_STATUSES = /* @__PURE__ */ new Set([
  "accepted",
  "risky",
  "refined",
  "quarantined",
  "dropped"
]);
async function propsCommand(target, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config5.loadConfig)(projectRoot);
  const storeDir = path7.join(projectRoot, config.storeDir);
  let statusFilter;
  if (options.status) {
    if (!VALID_STATUSES.has(options.status)) {
      console.error(
        `
  Invalid status: "${options.status}". Must be one of: ${[...VALID_STATUSES].join(", ")}
`
      );
      process.exit(2);
    }
    statusFilter = options.status;
  }
  if (target) {
    const targetPath = path7.resolve(projectRoot, target);
    const moduleKey = (0, import_common5.toForwardSlash)(path7.relative(projectRoot, targetPath));
    const ps = await (0, import_store6.getProperties)(storeDir, moduleKey);
    if (!ps) {
      console.error(`
  No properties found for ${target}`);
      console.error("  Run: propcheck infer " + target + "\n");
      process.exit(2);
    }
    if (options.json) {
      console.log((0, import_reporter3.reportPropertiesOverviewAsJson)([ps], statusFilter));
    } else {
      (0, import_reporter3.reportPropertiesOverview)([ps], statusFilter);
    }
  } else {
    const allSets = await (0, import_store6.getAllProperties)(storeDir);
    if (allSets.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ modules: [] }, null, 2));
      } else {
        console.log("\n  No properties found. Run: propcheck infer <file>\n");
      }
      process.exit(0);
    }
    if (options.json) {
      console.log((0, import_reporter3.reportPropertiesOverviewAsJson)(allSets, statusFilter));
    } else {
      (0, import_reporter3.reportPropertiesOverview)(allSets, statusFilter);
    }
  }
}

// src/commands/property.ts
var path8 = __toESM(require("path"));
var import_config6 = __toESM(require_dist2());
var import_store7 = __toESM(require_dist());
var import_reporter4 = __toESM(require_dist6());
var import_common6 = __toESM(require_dist4());
var VALID_STATUSES2 = /* @__PURE__ */ new Set([
  "accepted",
  "risky",
  "refined",
  "quarantined",
  "dropped"
]);
async function propertyCommand(target, propertyId, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config6.loadConfig)(projectRoot);
  const storeDir = path8.join(projectRoot, config.storeDir);
  const targetPath = path8.resolve(projectRoot, target);
  const moduleKey = (0, import_common6.toForwardSlash)(path8.relative(projectRoot, targetPath));
  const ps = await (0, import_store7.getProperties)(storeDir, moduleKey);
  if (!ps) {
    console.error(`
  No properties found for ${target}`);
    console.error("  Run: propcheck infer " + target + "\n");
    process.exit(2);
  }
  const property = ps.properties.find((p) => p.id === propertyId);
  if (!property) {
    console.error(`
  Property "${propertyId}" not found in ${target}`);
    console.error("  Available IDs: " + ps.properties.map((p) => p.id).join(", ") + "\n");
    process.exit(2);
  }
  if (options.status) {
    if (!VALID_STATUSES2.has(options.status)) {
      console.error(
        `
  Invalid status: "${options.status}". Must be one of: ${[...VALID_STATUSES2].join(", ")}
`
      );
      process.exit(2);
    }
    const newStatus = options.status;
    const oldStatus = property.status;
    const updatedProperty = {
      ...property,
      status: newStatus,
      humanVerified: true
    };
    const updatedProperties = ps.properties.map(
      (p) => p.id === propertyId ? updatedProperty : p
    );
    const updatedPs = {
      ...ps,
      properties: updatedProperties
    };
    await (0, import_store7.setProperties)(storeDir, moduleKey, updatedPs);
    if (options.json) {
      console.log((0, import_reporter4.reportPropertyDetailAsJson)(updatedProperty, ps.filePath));
    } else {
      (0, import_reporter4.reportStatusUpdate)(propertyId, ps.filePath, oldStatus, newStatus);
    }
    return;
  }
  if (options.json) {
    console.log((0, import_reporter4.reportPropertyDetailAsJson)(property, ps.filePath));
  } else {
    (0, import_reporter4.reportPropertyDetail)(property, ps.filePath);
  }
}

// src/commands/fix.ts
var fs5 = __toESM(require("fs"));
var fsPromises = __toESM(require("fs/promises"));
var crypto = __toESM(require("crypto"));
var path9 = __toESM(require("path"));
var import_config7 = __toESM(require_dist2());
var import_store8 = __toESM(require_dist());
var import_engines4 = __toESM(require_dist7());
var import_common7 = __toESM(require_dist4());
var import_llm4 = __toESM(require_dist5());
function computeDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result = [];
  const m = oldLines.length;
  const n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i2 = 1; i2 <= m; i2++) {
    for (let j2 = 1; j2 <= n; j2++) {
      if (oldLines[i2 - 1] === newLines[j2 - 1]) {
        dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
      } else {
        dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
      }
    }
  }
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: "equal", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "insert", newIdx: j - 1 });
      j--;
    } else {
      ops.unshift({ type: "delete", oldIdx: i - 1 });
      i--;
    }
  }
  let oldLineNum = 1;
  let newLineNum = 1;
  for (const op of ops) {
    switch (op.type) {
      case "equal":
        result.push({ type: "context", content: oldLines[op.oldIdx], oldLine: oldLineNum, newLine: newLineNum });
        oldLineNum++;
        newLineNum++;
        break;
      case "delete":
        result.push({ type: "remove", content: oldLines[op.oldIdx], oldLine: oldLineNum });
        oldLineNum++;
        break;
      case "insert":
        result.push({ type: "add", content: newLines[op.newIdx], newLine: newLineNum });
        newLineNum++;
        break;
    }
  }
  return result;
}
function formatDiff(diff, filePath) {
  const CONTEXT = 3;
  const lines = [];
  const changed = diff.map((d, i) => d.type !== "context" ? i : -1).filter((i) => i >= 0);
  if (changed.length === 0) return "  No changes.\n";
  lines.push(`  --- a/${filePath}`);
  lines.push(`  +++ b/${filePath}`);
  let lastEnd = -1;
  for (const idx of changed) {
    const start = Math.max(0, idx - CONTEXT);
    const end = Math.min(diff.length - 1, idx + CONTEXT);
    if (start <= lastEnd) continue;
    let hunkStart = start;
    let hunkEnd = end;
    for (const other of changed) {
      if (other >= start && other <= end + CONTEXT) {
        hunkEnd = Math.min(diff.length - 1, other + CONTEXT);
      }
    }
    if (hunkStart > lastEnd + 1 && lastEnd >= 0) {
      lines.push("  ...");
    }
    for (let k = hunkStart; k <= hunkEnd; k++) {
      const d = diff[k];
      switch (d.type) {
        case "add":
          lines.push(`  + ${d.content}`);
          break;
        case "remove":
          lines.push(`  - ${d.content}`);
          break;
        case "context":
          lines.push(`    ${d.content}`);
          break;
      }
    }
    lastEnd = hunkEnd;
  }
  return lines.join("\n");
}
async function fixCommand(target, options) {
  const projectRoot = process.cwd();
  const config = (0, import_config7.loadConfig)(projectRoot, {
    mock: options.mock ?? false,
    model: options.model,
    provider: options.provider,
    baseURL: options.baseUrl
  });
  const targetPath = path9.resolve(projectRoot, target);
  if (!fs5.existsSync(targetPath)) {
    console.error(`
  Error: File not found: ${target}
`);
    process.exit(2);
  }
  const errors = (0, import_config7.validateConfig)(config, "fix");
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`
  ${err}`);
    }
    process.exit(2);
  }
  const moduleKey = (0, import_common7.toForwardSlash)(path9.relative(projectRoot, targetPath));
  const storeDir = path9.join(projectRoot, config.storeDir);
  const propertySet = await (0, import_store8.getProperties)(storeDir, moduleKey);
  if (!propertySet || propertySet.properties.length === 0) {
    console.error(`
  No properties found for ${target}`);
    console.error(`  Run: propcheck infer ${target}
`);
    process.exit(2);
  }
  const sourceCode = await fsPromises.readFile(targetPath, "utf8");
  const language = targetPath.endsWith(".py") ? "python" : "typescript";
  const activeProperties = propertySet.properties.filter(
    (p) => p.status !== "dropped" && p.status !== "quarantined"
  );
  if (activeProperties.length === 0) {
    console.error(`
  No active properties for ${target} (all quarantined/dropped)
`);
    process.exit(2);
  }
  console.log(`
  Running ${activeProperties.length} properties for ${target}...`);
  const runConfig = {
    mode: "default",
    iterations: import_common7.RUN_MODE_ITERATIONS.default,
    timeout: config.timeout,
    verbose: false
  };
  const testsDir = path9.join(storeDir, "tests");
  await fsPromises.mkdir(testsDir, { recursive: true });
  const generated = (0, import_engines4.generateFastCheckTest)(activeProperties, targetPath, testsDir, runConfig);
  const testFilePath = path9.join(testsDir, generated.fileName);
  await fsPromises.writeFile(testFilePath, generated.content, "utf8");
  const execResult = await (0, import_engines4.runFastCheckTest)(testFilePath, activeProperties, runConfig, {
    targetFile: targetPath,
    needsMtsCopy: generated.needsMtsCopy
  });
  let failures = execResult.failed;
  if (options.property) {
    const propertyExists = activeProperties.some((p) => p.id === options.property);
    if (!propertyExists) {
      console.error(`
  Property ${options.property} not found in ${target}`);
      console.error(`  Available properties: ${activeProperties.map((p) => p.id).join(", ")}
`);
      process.exit(2);
    }
    failures = failures.filter((f) => f.propertyId === options.property);
    if (failures.length === 0) {
      console.log(`
  Property ${options.property} is passing \u2014 nothing to fix.
`);
      process.exit(0);
    }
  }
  if (failures.length === 0) {
    console.log(`
  All ${activeProperties.length} properties pass \u2014 nothing to fix.
`);
    process.exit(0);
  }
  console.log(`  Found ${failures.length} violation(s).
`);
  const llmClient = config.mock ? null : (0, import_llm4.createClient)(config.apiKey, config.model, config.provider, config.baseURL);
  console.log("  Diagnosing violations...");
  const diagnoses = [];
  for (const failure of failures) {
    const property = activeProperties.find((p) => p.id === failure.propertyId);
    if (!property) continue;
    let diagnosis;
    if (config.mock || !llmClient) {
      diagnosis = (0, import_llm4.mockDiagnoseViolation)(property, failure);
    } else {
      diagnosis = await (0, import_llm4.diagnoseViolation)(llmClient, sourceCode, property, failure, language);
    }
    if (diagnosis) {
      diagnoses.push(diagnosis);
      const icon = diagnosis.isBug ? "BUG" : "OK";
      console.log(`    [${icon}] ${failure.propertyId}: ${diagnosis.explanation.slice(0, 80)}`);
    } else {
      console.log(`    [???] ${failure.propertyId}: diagnosis failed`);
    }
  }
  const confirmedBugs = diagnoses.filter((d) => d.isBug);
  if (confirmedBugs.length === 0) {
    console.log(`
  No real bugs found \u2014 all violations appear to be false positives.`);
    console.log("  Consider reviewing the property definitions.\n");
    if (options.json) {
      console.log(JSON.stringify({
        status: "no_bugs",
        diagnoses,
        failureCount: failures.length
      }, null, 2));
    }
    process.exit(0);
  }
  console.log(`
  ${confirmedBugs.length} confirmed bug(s). Generating fix...`);
  const maxAttemptsRaw = parseInt(options.maxAttempts ?? "3", 10);
  if (options.maxAttempts !== void 0 && isNaN(maxAttemptsRaw)) {
    console.error(`
  Error: --max-attempts must be a number, got "${options.maxAttempts}"
`);
    process.exit(2);
  }
  const maxAttempts = Math.min(Math.max(1, maxAttemptsRaw || 3), 5);
  let bestFix = null;
  let verificationResult = null;
  let retryFeedback;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      console.log(`  Retry attempt ${attempt}/${maxAttempts}...`);
    }
    let fix;
    if (config.mock || !llmClient) {
      fix = (0, import_llm4.mockGenerateFix)(sourceCode, confirmedBugs);
    } else {
      fix = await (0, import_llm4.generateFix)(
        llmClient,
        sourceCode,
        confirmedBugs,
        activeProperties,
        failures,
        language,
        retryFeedback
      );
    }
    if (!fix) {
      console.log(`  Fix generation failed (attempt ${attempt}/${maxAttempts})`);
      continue;
    }
    bestFix = fix;
    const ext = path9.extname(targetPath);
    const base = path9.basename(targetPath, ext);
    const dir = path9.dirname(targetPath);
    const tmpPath = path9.join(dir, `${base}.fix.tmp.${crypto.randomBytes(4).toString("hex")}${ext}`);
    try {
      await fsPromises.writeFile(tmpPath, fix.fixedSource, "utf8");
      const verifyGenerated = (0, import_engines4.generateFastCheckTest)(
        activeProperties,
        tmpPath,
        testsDir,
        runConfig
      );
      const verifyTestPath = path9.join(testsDir, verifyGenerated.fileName);
      await fsPromises.writeFile(verifyTestPath, verifyGenerated.content, "utf8");
      verificationResult = await (0, import_engines4.runFastCheckTest)(
        verifyTestPath,
        activeProperties,
        runConfig,
        { targetFile: tmpPath, needsMtsCopy: verifyGenerated.needsMtsCopy }
      );
      try {
        await fsPromises.unlink(verifyTestPath);
      } catch (e) {
        if (e instanceof Error && e.code !== "ENOENT") {
          console.warn(`  Warning: Failed to clean up ${verifyTestPath}: ${e.message}`);
        }
      }
    } finally {
      try {
        await fsPromises.unlink(tmpPath);
      } catch (e) {
        if (e instanceof Error && e.code !== "ENOENT") {
          console.warn(`  Warning: Failed to clean up ${tmpPath}: ${e.message}`);
        }
      }
    }
    if (verificationResult && verificationResult.failed.length === 0 && verificationResult.errors.length === 0) {
      console.log(`  Fix verified \u2014 all ${activeProperties.length} properties pass.
`);
      break;
    }
    const newFailures = verificationResult.failed.map((f) => {
      const p = activeProperties.find((prop) => prop.id === f.propertyId);
      return `- ${f.propertyId} (${p?.targetFunction ?? "?"}): ${f.errorMessage.slice(0, 200)}`;
    }).join("\n");
    const newErrors = verificationResult.errors.map((e) => `- ${e.propertyId}: ${e.errorMessage.slice(0, 200)}`).join("\n");
    retryFeedback = `Your fix broke ${verificationResult.failed.length} property/properties and caused ${verificationResult.errors.length} error(s):

`;
    if (newFailures) retryFeedback += `Failures:
${newFailures}

`;
    if (newErrors) retryFeedback += `Errors:
${newErrors}
`;
    console.log(`  Verification failed: ${verificationResult.failed.length} failure(s), ${verificationResult.errors.length} error(s)`);
  }
  if (!bestFix) {
    console.error(`
  Failed to generate a fix after ${maxAttempts} attempt(s).
`);
    process.exit(1);
  }
  const diff = computeDiff(sourceCode, bestFix.fixedSource);
  const hasChanges = diff.some((d) => d.type !== "context");
  if (!hasChanges) {
    console.log("  Generated fix is identical to the original \u2014 no changes needed.\n");
    process.exit(0);
  }
  const allPassed = verificationResult ? verificationResult.failed.length === 0 && verificationResult.errors.length === 0 : false;
  if (options.json) {
    console.log(JSON.stringify({
      status: allPassed ? "fixed" : "partial",
      explanation: bestFix.explanation,
      changedFunctions: bestFix.changedFunctions,
      confidence: bestFix.confidence,
      diagnoses,
      verification: verificationResult ? {
        passed: verificationResult.passed.length,
        failed: verificationResult.failed.length,
        errors: verificationResult.errors.length
      } : null,
      diff: formatDiff(diff, moduleKey)
    }, null, 2));
  } else {
    console.log("  Diagnoses:");
    for (const d of confirmedBugs) {
      const prop = activeProperties.find((p) => p.id === d.propertyId);
      console.log(`    [BUG] ${prop?.targetFunction ?? "?"}: ${d.explanation}`);
      if (d.suggestedFix) {
        console.log(`          Fix: ${d.suggestedFix}`);
      }
    }
    console.log(`
  Fix (${bestFix.changedFunctions.join(", ") || "source"}):
`);
    console.log(formatDiff(diff, moduleKey));
    console.log(`
  Explanation: ${bestFix.explanation}`);
    console.log(`  Confidence: ${(bestFix.confidence * 100).toFixed(0)}%`);
    if (verificationResult) {
      const total = activeProperties.length;
      const passed = verificationResult.passed.length;
      if (allPassed) {
        console.log(`  Verification: ${passed}/${total} properties PASS`);
      } else {
        console.log(`  Verification: ${passed}/${total} pass, ${verificationResult.failed.length} fail, ${verificationResult.errors.length} error(s)`);
        console.log("  Warning: fix is partial \u2014 not all properties pass.");
      }
    }
    console.log();
  }
  if (options.apply && allPassed) {
    await fsPromises.writeFile(targetPath, bestFix.fixedSource, "utf8");
    if (!options.json) {
      console.log(`  Applied fix to ${target}
`);
    }
  } else if (!options.apply && allPassed && !options.json) {
    console.log(`  Run: propcheck fix ${target} --apply  to apply this fix
`);
  }
  process.exit(allPassed ? 0 : 1);
}

// src/index.ts
var import_chalk2 = __toESM(require("chalk"));
try {
  require.resolve("typescript");
} catch {
  console.error(`
  Error: propcheck requires TypeScript to be installed.

  Run: npm install typescript
  Or:  npm install -D typescript

  (TypeScript is used to analyze your code \u2014 even .js files benefit from it.)
`);
  process.exit(2);
}
var program = new import_commander.Command();
program.name("propcheck").description("AI-powered property-based testing \u2014 find bugs your tests miss").version("0.3.0").option("--no-color", "Disable colored output").hook("preAction", () => {
  if (program.opts().color === false) {
    import_chalk2.default.level = 0;
  }
});
program.command("init").description("Set up propcheck in your project (creates .propcheck/ directory)").action(initCommand);
program.command("infer <target>").description("Discover rules about your code using AI (one-time, ~$0.05/file)").option("--mock", "Use built-in demo mode (no API key needed)").option("--model <model>", "AI model to use").option("--provider <provider>", "AI provider: anthropic or openai-compatible").option("--base-url <url>", "Custom API endpoint (for proxies / OpenRouter)").option("--max-properties <n>", "Max rules per function", "5").option("--min-score <n>", "Minimum quality score to keep (0-13)", "10").option("--function <names>", "Only analyze specific functions (comma-separated)").option("--skip-validation", "Skip trial-run validation of discovered rules").option("--refine", "Run a second AI pass to strengthen weak rules").action(inferCommand);
program.command("run [target]").description("Test your code with random inputs (run after infer)").option("--quick", "Fast mode: 100 random inputs per rule").option("--thorough", "Deep mode: 10,000 random inputs per rule").option("--seed <n>", "Fixed random seed (for reproducible results)").option("--json", "Output results as JSON (for CI/CD)").option("--changed", "Only test files changed in git diff").option("--skip <ids>", "Skip specific rules by ID (comma-separated)").option("--only <ids>", "Only run specific rules by ID (comma-separated)").option("--include-quarantined", "Also test quarantined (fragile) rules").action(runCommand);
program.command("badge").description("Generate a README badge showing how many rules are verified").action(badgeCommand);
program.command("quality <target>").description("Check how good your rules are at catching bugs (mutation testing)").action(qualityCommand);
program.command("props [target]").description("List all discovered rules and their status").option("--status <status>", "Filter: accepted, risky, refined, quarantined, dropped").option("--json", "Output as JSON").action(propsCommand);
program.command("property <target> <propertyId>").description("View or update a specific rule (e.g., mark as quarantined)").option("--status <status>", "Set new status (marks as human-reviewed)").option("--json", "Output as JSON").action(propertyCommand);
program.command("fix <target>").description("Auto-fix bugs found by propcheck run (uses AI to generate a patch)").option("--mock", "Use built-in demo mode (no API key needed)").option("--model <model>", "AI model to use").option("--provider <provider>", "AI provider: anthropic or openai-compatible").option("--base-url <url>", "Custom API endpoint").option("--apply", "Apply the fix directly (skip review)").option("--property <id>", "Fix only a specific rule violation").option("--max-attempts <n>", "Maximum fix attempts (default: 3)", "3").option("--json", "Output fix result as JSON").action(fixCommand);
program.parse();
//# sourceMappingURL=index.js.map