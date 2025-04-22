import { TEMPLATES } from "./templates.js";

export { TEMPLATES } from "./templates.js";

export const FRAMEWORK_CHOICES = [
  {
    name: "Next.js",
    value: "next-web3-starter",
  },
] as const;

export const BLOCKCHAIN_TOOLING_CHOICES = [
  {
    name: "HardHat",
    value: "hardhat",
  },
  {
    name: "Foundry",
    value: "foundry",
  },
  {
    name: "None",
    value: "none",
  },
] as const;

export const PACAKGE_MANAGER_CHOICES = [
  {
    name: "Yarn",
    value: "yarn",
  },
  {
    name: "NPM",
    value: "npm",
  },
  {
    name: "pnpm",
    value: "pnpm",
  },
] as const;

// Add a type helper to make working with templates easier
type Template = (typeof TEMPLATES)[number];

export type GitTemplate = Extract<Template, { repo_url: string }>;
export type DegitTemplate = Extract<Template, { degitSource: string }>;

export function isDegitTemplate(template: Template): template is DegitTemplate {
  return "degitSource" in template;
}

export function isGitTemplate(template: Template): template is GitTemplate {
  return "repo_url" in template;
}
