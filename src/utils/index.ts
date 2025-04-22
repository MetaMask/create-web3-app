import { exec } from "child_process";
import { promises as fs } from "fs";
import {
  BLOCKCHAIN_TOOLING_CHOICES,
  PACAKGE_MANAGER_CHOICES,
  TEMPLATES,
  isDegitTemplate,
  isGitTemplate,
} from "../constants/index.js";
import path from "path";
import util from "util";
import inquirer from "inquirer";
import degit from "degit";

export const execAsync = util.promisify(exec);

const promptForFramework = async (): Promise<string> => {
  const templateChoices = TEMPLATES.map((template) => template.name);
  const { frameworkName }: { frameworkName: string } = await inquirer.prompt([
    {
      type: "list",
      name: "frameworkName",
      message: "Please select the template you want to use:",
      choices: templateChoices,
    },
  ]);
  console.log(`Selected template: ${frameworkName}`);

  const selectedTemplate = TEMPLATES.find(
    (template) => template.name === frameworkName
  );
  if (!selectedTemplate) {
    throw new Error(
      `Internal error: Could not find template data for selected name "${frameworkName}"`
    );
  }
  return selectedTemplate.id;
};

const promptForTooling = async (): Promise<string> => {
  const toolingChoice = BLOCKCHAIN_TOOLING_CHOICES.map((choice) => choice.name);
  const { tooling }: { tooling: string } = await inquirer.prompt([
    {
      type: "list",
      name: "tooling",
      message: "Would you like to include blockchain tooling?",
      choices: toolingChoice,
    },
  ]);
  console.log(`Selected tooling: ${tooling}`);

  return tooling;
};

const promptForPackageManager = async (): Promise<string> => {
  const packageManagerChoice = PACAKGE_MANAGER_CHOICES.map(
    (choice) => choice.name
  );
  const { packageManager }: { packageManager: string } = await inquirer.prompt([
    {
      type: "list",
      name: "packageManager",
      message: "Please select the package manager you want to use:",
      choices: packageManagerChoice,
    },
  ]);
  console.log(`Selected package manager: ${packageManager}`);

  return packageManager;
};

const promptForProjectDetails = async (args: string): Promise<string> => {
  if (!args) {
    const { projectName } = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Please specify a name for your project: ",
        validate: (input) => (input ? true : "Project name cannot be empty"),
      },
    ]);
    console.log("Creating project with name:", projectName);
    return projectName;
  }
  return args;
};

export interface ProjectOptions {
  projectName: string;
  templateId: string;
  blockchain_tooling: "hardhat" | "foundry" | "none";
  packageManager: "npm" | "yarn" | "pnpm";
}

export const promptForOptions = async (
  args: string
): Promise<ProjectOptions> => {
  const projectName = await promptForProjectDetails(args);
  const templateId = await promptForFramework();
  const tooling = await promptForTooling();
  const packageManager = await promptForPackageManager();

  const options: ProjectOptions = {
    projectName: projectName,
    templateId: templateId,
    blockchain_tooling: BLOCKCHAIN_TOOLING_CHOICES.find(
      (choice) => choice.name === tooling
    )?.value as ProjectOptions["blockchain_tooling"],
    packageManager: PACAKGE_MANAGER_CHOICES.find(
      (choice) => choice.name === packageManager
    )?.value as ProjectOptions["packageManager"],
  };

  if (!TEMPLATES.some((t) => t.id === options.templateId)) {
    throw new Error(`Invalid template ID resolved: ${options.templateId}`);
  }

  return options;
};

export const cloneTemplate = async (
  templateId: string,
  destinationPath: string,
  projectName: string
) => {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Template with id "${templateId}" not found.`);
  }

  try {
    if (isDegitTemplate(template)) {
      console.log(
        `Cloning template "${template.name}" from ${template.degitSource} using degit...`
      );
      const emitter = degit(template.degitSource, {
        cache: false,
        force: true,
        verbose: false,
      });

      await emitter.clone(destinationPath);
    } else if (isGitTemplate(template)) {
      console.log(
        `Cloning template "${template.name}" from ${template.repo_url} using git...`
      );
      await execAsync(`git clone ${template.repo_url} ${destinationPath}`);
      await fs.rm(path.join(destinationPath, ".git"), {
        recursive: true,
        force: true,
      });
    } else {
      throw new Error(`Template has neither repo_url nor degitSource defined.`);
    }

    const packageJsonPath = path.join(destinationPath, "package.json");
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);
      packageJson.name = path.basename(projectName);
      const newPackageJsonContent = JSON.stringify(packageJson, null, 2);
      await fs.writeFile(packageJsonPath, newPackageJsonContent, "utf-8");
    } catch (pkgError) {
      console.warn(
        `Warning: Could not update package.json name in ${destinationPath}. Manual update might be needed. Error: ${
          pkgError instanceof Error ? pkgError.message : pkgError
        }`
      );
    }

    console.log(`Template "${template.name}" prepared successfully.`);
  } catch (error) {
    console.error(`Error preparing template "${template.name}":`, error);
    throw error;
  }
};

export const initializeMonorepo = async (options: ProjectOptions) => {
  const { projectName, packageManager } = options;
  console.log("Initializing monorepo structure...");

  await fs.mkdir(path.join(projectName, "packages"), { recursive: true });

  if (packageManager === "pnpm") {
    await fs.writeFile(
      path.join(projectName, "pnpm-workspace.yaml"),
      `packages:\n  - 'packages/*'`
    );
  }

  await fs.writeFile(
    path.join(projectName, ".gitignore"),
    `node_modules\n.DS_Store\npackages/*/node_modules\npackages/*/.DS_Store\npackages/*/dist\npackages/*/.env\npackages/*/.turbo\npackages/*/coverage`
  );
  const rootPackageJson = {
    name: projectName,
    private: true,
    workspaces: ["packages/*"],
    scripts: {},
  };
  await fs.writeFile(
    path.join(projectName, "package.json"),
    JSON.stringify(rootPackageJson, null, 2)
  );

  await fs.mkdir(path.join(projectName, "packages", "blockchain"), {
    recursive: true,
  });
  await fs.mkdir(path.join(projectName, "packages", "site"), {
    recursive: true,
  });

  console.log("Monorepo structure initialized.");
};

export const createHardhatProject = async (options: ProjectOptions) => {
  const { projectName, templateId } = options;
  console.log("Setting up project with HardHat...");

  await initializeMonorepo(options);

  console.log("Cloning Hardhat template...");
  await execAsync(
    `git clone https://github.com/Consensys/hardhat-template.git ${path.join(
      projectName,
      "packages",
      "blockchain"
    )}`
  );
  await fs.rm(path.join(projectName, "packages", "blockchain", ".git"), {
    recursive: true,
    force: true,
  });

  await cloneTemplate(
    templateId,
    path.join(projectName, "packages", "site"),
    projectName
  );

  console.log("Hardhat project setup complete.");
};

export const createFoundryProject = async (options: ProjectOptions) => {
  const { projectName, templateId } = options;
  console.log("Setting up project with Foundry...");

  await initializeMonorepo(options);

  console.log("Initializing Foundry project...");
  const blockchainPath = path.join(projectName, "packages", "blockchain");
  await execAsync(`cd ${blockchainPath} && forge init . --no-commit`);

  await cloneTemplate(
    templateId,
    path.join(projectName, "packages", "site"),
    projectName
  );

  console.log("Foundry project setup complete.");
};

export const createProject = async (args: string) => {
  const options = await promptForOptions(args);
  const installCommand = `${options.packageManager} install`;

  try {
    if (options.blockchain_tooling === "hardhat") {
      await createHardhatProject(options);
    } else if (options.blockchain_tooling === "foundry") {
      await createFoundryProject(options);
    } else {
      await cloneTemplate(
        options.templateId,
        options.projectName,
        options.projectName
      );
    }

    console.log(
      `\nProject setup complete. Installing dependencies using ${options.packageManager}...`
    );
    const projectPath = options.projectName;
    await execAsync(`cd ${projectPath} && ${installCommand}`);

    console.log("\nDependencies installed successfully!");
    console.log(`\nSuccess! Created ${options.projectName}.`);
    console.log("Inside that directory, you can run several commands:");

    if (options.blockchain_tooling !== "none") {
      console.log(`\n  In the root directory (${options.projectName}):`);
      console.log(`    ${options.packageManager} run dev`);
      console.log("      Runs the frontend development server.");
      console.log(`\n  In packages/blockchain:`);
      console.log(`    ${options.packageManager} run compile`);
      console.log("      Compiles the smart contracts.");
      console.log(`    ${options.packageManager} run test`);
      console.log("      Runs the contract tests.");
    } else {
      console.log(`\n  ${options.packageManager} run dev`);
      console.log("    Starts the development server.");
    }

    console.log("\nHappy Hacking!");
  } catch (error) {
    console.error("\nAn error occurred during project creation:", error);
  }
};
