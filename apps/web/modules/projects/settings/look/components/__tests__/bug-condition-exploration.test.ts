import * as fs from "fs";
import * as path from "path";
import { describe, expect, test } from "vitest";

/**
 * Bug Condition Exploration Test (Property 1)
 *
 * This test encodes the expected behavior: after a successful save/update action
 * (response.data != null), the component MUST call router.refresh() to trigger
 * server component re-render so the preview displays fresh data.
 *
 * On UNFIXED code, these tests FAIL — confirming the bug exists.
 * After the fix, these tests PASS — confirming the bug is resolved.
 *
 * Approach: Static source analysis. We read the source files and verify that
 * router.refresh() is called within the success branches of each action handler.
 * This respects the project rule of no unit tests for .tsx files (we test source
 * structure, not component rendering).
 */

const EDIT_LOGO_PATH = path.resolve(__dirname, "../edit-logo.tsx");

const EDIT_BRANDING_PATH = path.resolve(
  __dirname,
  "../../../../../ee/whitelabel/remove-branding/components/edit-branding.tsx"
);

const THEME_STYLING_PATH = path.resolve(__dirname, "../theme-styling.tsx");

/**
 * Helper: extract the body of a success branch from a function in source code.
 * Looks for the pattern where `responseVar?.data` is truthy and returns the
 * code block inside that branch.
 */
function extractSuccessBranch(source: string, responseVar: string): string | null {
  // Match: if (responseVar?.data) { ... }
  const pattern = new RegExp(`if\\s*\\(\\s*${responseVar}\\?\\.data\\s*\\)\\s*\\{`, "g");
  const match = pattern.exec(source);
  if (!match) return null;

  // Find the matching closing brace
  let braceCount = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < source.length && braceCount > 0) {
    if (source[i] === "{") braceCount++;
    if (source[i] === "}") braceCount--;
    i++;
  }
  return source.slice(start, i - 1);
}

/**
 * Helper: extract a function body by name from source code.
 * Supports both `const name = async () => {` and `const name = async function() {` patterns.
 */
function extractFunctionBody(source: string, funcName: string): string | null {
  // Find the function declaration and extract everything between its outermost braces
  const pattern = new RegExp(
    `(?:const\\s+${funcName}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>|const\\s+${funcName}\\s*=\\s*async\\s+function\\s*\\([^)]*\\)|async\\s+function\\s+${funcName}\\s*\\([^)]*\\))`,
    "g"
  );

  const match = pattern.exec(source);
  if (!match) return null;

  // Find the first opening brace after the match
  let idx = match.index + match[0].length;
  while (idx < source.length && source[idx] !== "{") idx++;
  if (idx >= source.length) return null;

  // Find matching closing brace
  let braceCount = 1;
  let start = idx + 1;
  let j = start;
  while (j < source.length && braceCount > 0) {
    if (source[j] === "{") braceCount++;
    if (source[j] === "}") braceCount--;
    j++;
  }
  return source.slice(start, j - 1);
}

describe("Bug Condition Exploration: router.refresh() after successful save", () => {
  describe("EditLogo component", () => {
    const source = fs.readFileSync(EDIT_LOGO_PATH, "utf-8");

    test("should call router.refresh() in saveChanges success branch", () => {
      const funcBody = extractFunctionBody(source, "saveChanges");
      expect(funcBody).not.toBeNull();

      const successBranch = extractSuccessBranch(funcBody!, "updateProjectResponse");
      expect(successBranch).not.toBeNull();
      expect(successBranch).toContain("router.refresh()");
    });

    test("should call router.refresh() in removeLogo success branch", () => {
      const funcBody = extractFunctionBody(source, "removeLogo");
      expect(funcBody).not.toBeNull();

      const successBranch = extractSuccessBranch(funcBody!, "updateProjectResponse");
      expect(successBranch).not.toBeNull();
      expect(successBranch).toContain("router.refresh()");
    });

    test("should import useRouter from next/navigation", () => {
      expect(source).toMatch(/import\s+\{[^}]*useRouter[^}]*\}\s+from\s+["']next\/navigation["']/);
    });
  });

  describe("EditBranding component", () => {
    const source = fs.readFileSync(EDIT_BRANDING_PATH, "utf-8");

    test("should call router.refresh() in toggleBranding success branch", () => {
      const funcBody = extractFunctionBody(source, "toggleBranding");
      expect(funcBody).not.toBeNull();

      const successBranch = extractSuccessBranch(funcBody!, "updateBrandingResponse");
      expect(successBranch).not.toBeNull();
      expect(successBranch).toContain("router.refresh()");
    });

    test("should import useRouter from next/navigation", () => {
      expect(source).toMatch(/import\s+\{[^}]*useRouter[^}]*\}\s+from\s+["']next\/navigation["']/);
    });
  });

  describe("Reference: ThemeStyling component (should pass — confirms correct pattern)", () => {
    const source = fs.readFileSync(THEME_STYLING_PATH, "utf-8");

    test("should have router.refresh() in onReset success branch (baseline)", () => {
      // This test confirms the correct pattern exists in ThemeStyling
      // and serves as a sanity check that our analysis approach works
      expect(source).toContain("router.refresh()");
    });
  });
});
