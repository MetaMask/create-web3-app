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
import ora from "ora";
import chalk from "chalk";

export const execAsync = util.promisify(exec);

const promptForFramework = async (): Promise<string> => {
  const templateChoices = TEMPLATES.map((template) => {
    if (template.id === "next-sdk-quickstart") {
      return {
        name: `${template.name} ${chalk.hex("#FFA500")("(Recommended)")}`,
        value: template.name,
      };
    }
    return template.name;
  });
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

  if (tooling === "Foundry") {
    console.log(
      chalk.yellow(
        "\nNote: Foundry's 'forge' CLI must be installed and in your PATH to use this option."
      )
    );
  }

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
        validate: (input) => {
          if (!input) {
            return "Project name cannot be empty";
          }
          const kebabCaseRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
          if (!kebabCaseRegex.test(input)) {
            return "Project name must be in kebab-case (e.g., my-awesome-project)";
          }
          return true;
        },
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
  dynamicEnvId?: string;
}

export const promptForOptions = async (
  args: string
): Promise<ProjectOptions> => {
  const projectName = await promptForProjectDetails(args);
  const templateId = await promptForFramework();
  const tooling = await promptForTooling();
  const packageManager = await promptForPackageManager();

  let dynamicEnvId: string | undefined = undefined;

  if (templateId === "metamask-dynamic") {
    const { addDynamicIdNow } = await inquirer.prompt([
      {
        type: "confirm",
        name: "addDynamicIdNow",
        message: `The selected template uses Dynamic.xyz. You'll need a Dynamic Environment ID added to a .env file. Would you like to add it now? You can get one from https://app.dynamic.xyz/dashboard/developer/api`,
        default: true,
      },
    ]);

    if (addDynamicIdNow) {
      const { providedDynamicId } = await inquirer.prompt([
        {
          type: "password",
          name: "providedDynamicId",
          message: "Please paste your Dynamic Environment ID:",
          mask: "*",
          validate: (input) =>
            input ? true : "Dynamic Environment ID cannot be empty",
        },
      ]);
      dynamicEnvId = providedDynamicId;
      console.log("Dynamic Environment ID received.");
    } else {
      console.log(
        chalk.yellow(
          "Okay, please remember to add NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=<your_id> to the .env file in your site's directory later."
        )
      );
    }
  }

  const options: ProjectOptions = {
    projectName: projectName,
    templateId: templateId,
    blockchain_tooling: BLOCKCHAIN_TOOLING_CHOICES.find(
      (choice) => choice.name === tooling
    )?.value as ProjectOptions["blockchain_tooling"],
    packageManager: PACAKGE_MANAGER_CHOICES.find(
      (choice) => choice.name === packageManager
    )?.value as ProjectOptions["packageManager"],
    dynamicEnvId: dynamicEnvId,
  };

  if (!TEMPLATES.some((t) => t.id === options.templateId)) {
    throw new Error(`Invalid template ID resolved: ${options.templateId}`);
  }

  return options;
};

export const cloneTemplate = async (
  options: Pick<
    ProjectOptions,
    "templateId" | "projectName" | "dynamicEnvId" | "blockchain_tooling"
  >,
  destinationPath: string
) => {
  const { templateId, projectName, dynamicEnvId, blockchain_tooling } = options;
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Template with id "${templateId}" not found.`);
  }

  const spinner = ora(
    `Preparing template "${template.name}" into ${destinationPath}...`
  ).start();

  try {
    if (isDegitTemplate(template)) {
      spinner.text = `Cloning template "${template.name}" from ${template.degitSource} using degit...`;
      const emitter = degit(template.degitSource, {
        cache: false,
        force: true,
        verbose: false,
      });

      await emitter.clone(destinationPath);
    } else if (isGitTemplate(template)) {
      spinner.text = `Cloning template "${template.name}" from ${template.repo_url} using git...`;
      await execAsync(`git clone ${template.repo_url} ${destinationPath}`);
      await fs.rm(path.join(destinationPath, ".git"), {
        recursive: true,
        force: true,
      });
    } else {
      spinner.fail(`Template preparation failed.`);
      throw new Error(`Template has neither repo_url nor degitSource defined.`);
    }

    const packageJsonPath = path.join(destinationPath, "package.json");
    try {
      spinner.text = `Updating package name to ${path.basename(
        projectName
      )}...`;
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);
      packageJson.name = path.basename(projectName);
      if (blockchain_tooling !== "none") {
        packageJson.name = `site`;
      }
      const newPackageJsonContent = JSON.stringify(packageJson, null, 2);
      await fs.writeFile(packageJsonPath, newPackageJsonContent, "utf-8");
    } catch (pkgError) {
      console.warn(
        `Warning: Could not update package.json name in ${destinationPath}. Manual update might be needed. Error: ${pkgError instanceof Error ? pkgError.message : pkgError
        }`
      );
    }

    if (dynamicEnvId) {
      spinner.text = `Creating .env file with Dynamic Environment ID...`;
      const envContent = `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=${dynamicEnvId}\n`;
      const envPath = path.join(destinationPath, ".env");
      await fs.writeFile(envPath, envContent, "utf-8");
      spinner.text = `.env file created successfully.`;
    }

    spinner.succeed(
      `Template "${template.name}" prepared successfully in ${destinationPath}.`
    );
  } catch (error) {
    spinner.fail(`Error preparing template "${template.name}".`);
    console.error(`Error details:`, error);
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
    {
      templateId,
      projectName,
      dynamicEnvId: options.dynamicEnvId,
      blockchain_tooling: "hardhat",
    },
    path.join(projectName, "packages", "site")
  );

  console.log("Hardhat project setup complete.");
};

export const createFoundryProject = async (options: ProjectOptions) => {
  const { projectName, templateId } = options;

  try {
    await execAsync("forge --version");
    console.log(
      chalk.green("Foundry (forge) installation verified. Proceeding with setup...")
    );
  } catch (error) {
    console.error(
      chalk.red(
        "\nError: Failed to verify Foundry (forge) installation."
      )
    );
    throw new Error(
      "Forge (Foundry) is not installed or not found in your PATH. Please install it to continue.\nInstallation guide: https://book.getfoundry.sh/getting-started/installation"
    );
  }

  console.log("Setting up project with Foundry...");
  await initializeMonorepo(options);

  console.log("Initializing Foundry project with 'forge init'...");
  const blockchainPath = path.join(projectName, "packages", "blockchain");
  await execAsync(`cd ${blockchainPath} && forge init . --no-commit`);

  await cloneTemplate(
    {
      templateId,
      projectName,
      dynamicEnvId: options.dynamicEnvId,
      blockchain_tooling: "foundry",
    },
    path.join(projectName, "packages", "site")
  );

  console.log("Foundry project setup complete.");
};

export const createProject = async (args: string) => {
  const options = await promptForOptions(args);
  const installCommand = `${options.packageManager} install`;
  const mainSpinner = ora("Setting up your Web3 project...").start();

  try {
    if (options.blockchain_tooling === "hardhat") {
      mainSpinner.text = "Creating Hardhat project structure...";
      await createHardhatProject(options);
    } else if (options.blockchain_tooling === "foundry") {
      mainSpinner.text = "Creating Foundry project structure...";
      await createFoundryProject(options);
    } else {
      mainSpinner.text = "Cloning base template...";
      await cloneTemplate(
        {
          templateId: options.templateId,
          projectName: options.projectName,
          dynamicEnvId: options.dynamicEnvId,
          blockchain_tooling: "none",
        },
        options.projectName
      );
    }

    mainSpinner.text = `Installing dependencies using ${options.packageManager}... (This may take a few minutes)`;
    const projectPath = options.projectName;
    await execAsync(`cd ${projectPath} && ${installCommand}`);

    mainSpinner.succeed("Project setup complete!");

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
      console.log(`\n  cd packages/site && ${options.packageManager} run dev`);
      console.log("    Starts the development server.");
    }

    console.log("\nHappy Hacking!");
  } catch (error) {
    mainSpinner.fail("An error occurred during project creation.");
    console.error("Error details:", error);
  }
};
