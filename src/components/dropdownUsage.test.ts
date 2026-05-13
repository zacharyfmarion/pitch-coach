import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.join(process.cwd(), "src");
const dropdownComponentPath = path.join(sourceRoot, "components", "Dropdown.tsx");

describe("dropdown usage", () => {
  it("keeps native select elements out of React source", () => {
    const offenders = sourceFiles().filter((filePath) =>
      /<\s*select(?:\s|>)/.test(readFileSync(filePath, "utf8"))
    );

    expect(offenders.map(relativePath)).toEqual([]);
  });

  it("keeps direct Radix Select imports inside the shared Dropdown component", () => {
    const offenders = sourceFiles().filter((filePath) => {
      if (filePath === dropdownComponentPath) {
        return false;
      }

      return readFileSync(filePath, "utf8").includes("@radix-ui/react-select");
    });

    expect(offenders.map(relativePath)).toEqual([]);
  });
});

function sourceFiles(directory = sourceRoot): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      return sourceFiles(filePath);
    }

    return /\.(ts|tsx)$/.test(filePath) && !/\.test\.(ts|tsx)$/.test(filePath) ? [filePath] : [];
  });
}

function relativePath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}
