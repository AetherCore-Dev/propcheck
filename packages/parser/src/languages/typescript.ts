/**
 * TypeScript/JavaScript parser using the TypeScript Compiler API.
 *
 * Uses the TypeScript compiler (already installed as a workspace devDep) to
 * extract function signatures, type definitions, and JSDoc from source code.
 * This avoids all WASM/native dependency issues.
 *
 * For Python/Rust, we'll add tree-sitter in a later phase.
 */

import * as ts from "typescript";
import type {
  FunctionSignature,
  ParameterInfo,
  TypeDefinition,
  TypeProperty,
  ImportInfo,
  SourceLocation,
  DocSignal,
  TypeSignal,
  AstSignal,
  AnalysisContext,
  SupportedLanguage,
} from "@propcheck/common";

function getLocation(node: ts.Node, sourceFile: ts.SourceFile): SourceLocation {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    startLine: start.line + 1,
    endLine: end.line + 1,
    startColumn: start.character,
    endColumn: end.character,
  };
}

function getJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string | null {
  const jsDocs = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;
  if (!jsDocs || jsDocs.length === 0) return null;
  return jsDocs.map((doc) => doc.getText(sourceFile)).join("\n");
}

function getJsDocComment(node: ts.Node): string | null {
  const jsDocs = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;
  if (!jsDocs || jsDocs.length === 0) return null;
  const doc = jsDocs[0];
  return doc.comment ? String(doc.comment) : null;
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  if (!modifiers) return false;
  return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function extractParamInfo(
  param: ts.ParameterDeclaration,
  checker: ts.TypeChecker | null,
  sourceFile: ts.SourceFile,
): ParameterInfo {
  const name = param.name.getText(sourceFile);
  let type: string | null = null;

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
    isRest: !!param.dotDotDotToken,
  };
}

function extractFunction(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker | null,
  className?: string,
): FunctionSignature | null {
  let name: string;

  if (ts.isFunctionDeclaration(node)) {
    if (!node.name) return null;
    name = node.name.getText(sourceFile);
  } else if (ts.isMethodDeclaration(node)) {
    name = node.name.getText(sourceFile);
  } else {
    // Arrow function — get name from parent variable declaration
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      name = parent.name.getText(sourceFile);
    } else {
      return null; // Anonymous arrow function
    }
  }

  const qualifiedName = className ? `${className}.${name}` : name;
  const parameters = node.parameters.map((p) => extractParamInfo(p, checker, sourceFile));

  let returnType: string | null = null;
  if (node.type) {
    returnType = node.type.getText(sourceFile);
  }

  const docstring = getJsDocComment(
    ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent)
      ? node.parent.parent?.parent ?? node
      : node,
  );

  // Determine export status
  let exported = false;
  if (ts.isFunctionDeclaration(node)) {
    exported = isExported(node);
  } else if (ts.isArrowFunction(node)) {
    const varStmt = node.parent?.parent?.parent;
    if (varStmt && ts.isVariableStatement(varStmt)) {
      exported = isExported(varStmt);
    }
  } else if (ts.isMethodDeclaration(node) && className) {
    exported = true; // Class methods are "public" if class is exported
  }

  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const isAsync = modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  const isGenerator = !!(node as ts.FunctionDeclaration).asteriskToken;

  return {
    name,
    qualifiedName,
    parameters,
    returnType,
    docstring,
    visibility: exported ? "public" : "private",
    isAsync,
    isGenerator,
    loc: getLocation(node, sourceFile),
  };
}

function extractTypeDefinitions(
  sourceFile: ts.SourceFile,
): readonly TypeDefinition[] {
  const types: TypeDefinition[] = [];

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node)) {
      const properties: TypeProperty[] = node.members
        .filter(ts.isPropertySignature)
        .map((member) => ({
          name: member.name.getText(sourceFile),
          type: member.type ? member.type.getText(sourceFile) : "unknown",
          isOptional: !!member.questionToken,
          isReadonly: member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
          ) ?? false,
        }));

      types.push({
        name: node.name.getText(sourceFile),
        kind: "interface",
        properties,
        loc: getLocation(node, sourceFile),
      });
    }

    if (ts.isTypeAliasDeclaration(node)) {
      types.push({
        name: node.name.getText(sourceFile),
        kind: "type",
        properties: [],
        loc: getLocation(node, sourceFile),
      });
    }

    if (ts.isEnumDeclaration(node)) {
      const properties: TypeProperty[] = node.members.map((member) => ({
        name: member.name.getText(sourceFile),
        type: member.initializer ? member.initializer.getText(sourceFile) : "number",
        isOptional: false,
        isReadonly: true,
      }));

      types.push({
        name: node.name.getText(sourceFile),
        kind: "enum",
        properties,
        loc: getLocation(node, sourceFile),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return types;
}

function extractImports(sourceFile: ts.SourceFile): readonly ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;

    const source = (stmt.moduleSpecifier as ts.StringLiteral).text;
    const clause = stmt.importClause;

    if (!clause) {
      imports.push({ source, specifiers: [], isDefault: false, isNamespace: false });
      continue;
    }

    const specifiers: string[] = [];
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

/**
 * Analyze a TypeScript/JavaScript source file.
 *
 * Returns an AnalysisContext with all extracted functions, types, imports, and signals.
 */
export function analyzeFile(
  filePath: string,
  source: string,
  language: SupportedLanguage,
): AnalysisContext {
  const isTS = language === "typescript";
  const scriptKind = isTS ? ts.ScriptKind.TS : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);

  // Extract functions
  const functions: FunctionSignature[] = [];

  function visitFunctions(node: ts.Node, className?: string) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const fn = extractFunction(node, sourceFile, null, className);
      if (fn) functions.push(fn);
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
          const fn = extractFunction(decl.initializer, sourceFile, null);
          if (fn) {
            // Inherit export from variable statement
            const exported = isExported(node);
            functions.push({ ...fn, visibility: exported ? "public" : "private" });
          }
        }
      }
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const cn = node.name.getText(sourceFile);
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) {
          const fn = extractFunction(member, sourceFile, null, cn);
          if (fn) functions.push(fn);
        }
      }
    }

    ts.forEachChild(node, (child) => visitFunctions(child, className));
  }

  visitFunctions(sourceFile);

  // Extract types
  const types = extractTypeDefinitions(sourceFile);

  // Extract imports
  const imports = extractImports(sourceFile);

  // Build signals
  const typeSignals: TypeSignal[] = functions.map((fn) => ({
    functionName: fn.qualifiedName,
    paramTypes: fn.parameters.map((p) => p.type ?? "unknown"),
    returnType: fn.returnType,
  }));

  const docSignals: DocSignal[] = functions
    .filter((fn) => fn.docstring)
    .map((fn) => ({
      functionName: fn.qualifiedName,
      description: fn.docstring ?? "",
      paramDocs: {},
      returnDoc: null,
      throws: [],
      examples: [],
    }));

  const astSignals: AstSignal[] = functions.map((fn) => ({
    kind: fn.isAsync ? "async_function" : "function",
    detail: fn.qualifiedName,
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
      doc: docSignals,
    },
  };
}

/** Detect language from file extension. */
export function detectLanguage(filePath: string): SupportedLanguage | null {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".mjs")) return "javascript";
  if (filePath.endsWith(".py")) return "python";
  if (filePath.endsWith(".rs")) return "rust";
  return null;
}
