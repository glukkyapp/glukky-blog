import { sep } from "node:path";

export function isPathWithinRoot(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}