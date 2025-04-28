import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import inquirer from "inquirer";
import { promises as fsPromises } from "fs";
import path from "path";
import degit from "degit"; // Import the actual degit

// Import functions to test and mocks
import * as utils from "./index.js"; // Import all exports
import {
  TEMPLATES,
  BLOCKCHAIN_TOOLING_CHOICES,
  PACAKGE_MANAGER_CHOICES,
  GitTemplate, // Import type for clarity
  DegitTemplate, // Import type for clarity
} from "../constants/index.js";

// --- Mocks ---
vi.mock("inquirer");

// Mock fs promises
vi.mock("fs", async (importOriginal) => {
  const originalFs = await importOriginal<typeof import("fs")>();
  return {
    ...originalFs,
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      rm: vi.fn(),
    },
  };
});

// Mock execAsync
vi.mock("./index", async (importOriginal) => {
  const originalModule = await importOriginal<typeof utils>();
  return {
    ...originalModule,
    execAsync: vi.fn(),
  };
});

// --- Refined Degit Mock ---
// 1. Define the structure the mock factory will return
const singleDegitInstance = { clone: vi.fn() };
// 2. Mock the factory to *always* return this single instance
vi.mock("degit", () => ({
    default: vi.fn().mockImplementation(() => singleDegitInstance)
}));

// --- Access Mocks via Modules ---
const mockedFsMkdir = vi.mocked(fsPromises.mkdir);
const mockedFsWriteFile = vi.mocked(fsPromises.writeFile);
const mockedFsReadFile = vi.mocked(fsPromises.readFile);
const mockedFsRm = vi.mocked(fsPromises.rm);
const mockedExecAsync = vi.mocked(utils.execAsync);
// 3. Get a reference to the mocked factory
const mockedDegitFactory = vi.mocked(degit);
// 4. Get a direct reference to the clone method on our single instance
const mockedDegitClone = vi.mocked(singleDegitInstance.clone);


// Mock console logging
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

describe("create-web3-app Utils", () => {
  beforeEach(() => {
    // Reset mocks using the direct references
    vi.clearAllMocks(); // Clears call history, reset spies
    mockedFsMkdir.mockReset();
    mockedFsWriteFile.mockReset();
    mockedFsReadFile.mockReset();
    mockedFsRm.mockReset();
    mockedExecAsync.mockReset();
    mockedDegitFactory.mockClear(); // Clear calls to the factory itself
    mockedDegitClone.mockReset(); // Reset the clone method on the single instance

    vi.mocked(inquirer.prompt).mockReset();
  });

  // --- Test promptForOptions ---
  describe("promptForOptions", () => {
    it("should return correct options when all prompts are answered", async () => {
      const mockArgs = "my-test-project";
      const mockTemplate = TEMPLATES[0]; // Use the first template
      const mockTooling = BLOCKCHAIN_TOOLING_CHOICES[0];
      const mockPackageManager = PACAKGE_MANAGER_CHOICES[0];
      const mockAnswers = {
        frameworkName: mockTemplate.name,
        tooling: mockTooling.name,
        packageManager: mockPackageManager.name,
      };
      // Set mock for this test only
      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      const options = await utils.promptForOptions(mockArgs);

      expect(inquirer.prompt).toHaveBeenCalledTimes(3);
      expect(options).toEqual({
        projectName: mockArgs,
        templateId: mockTemplate.id,
        blockchain_tooling: mockTooling.value,
        packageManager: mockPackageManager.value,
      });
    });

    it("should prompt for projectName if args are empty", async () => {
      const mockProjectName = "prompted-project";
      const mockTemplate = TEMPLATES[1]; // Use second template
      const mockTooling = BLOCKCHAIN_TOOLING_CHOICES[1];
      const mockPackageManager = PACAKGE_MANAGER_CHOICES[1];
       const mockAnswers = {
        projectName: mockProjectName,
        frameworkName: mockTemplate.name,
        tooling: mockTooling.name,
        packageManager: mockPackageManager.name,
      };
      // Chain mocks for this test
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ projectName: mockProjectName })
        .mockResolvedValueOnce({ frameworkName: mockAnswers.frameworkName })
        .mockResolvedValueOnce({ tooling: mockAnswers.tooling })
        .mockResolvedValueOnce({ packageManager: mockAnswers.packageManager });

      const options = await utils.promptForOptions("");

      expect(inquirer.prompt).toHaveBeenCalledTimes(4);
      expect(options).toEqual({
        projectName: mockProjectName,
        templateId: mockTemplate.id,
        blockchain_tooling: mockTooling.value,
        packageManager: mockPackageManager.value,
      });
    });

    // Updated test for invalid template name
    it("should throw error if template selection is invalid", async () => {
      const mockArgs = "my-test-project";
      const mockAnswers = {
        frameworkName: "NonExistentTemplate", // Invalid name
        tooling: "HardHat",
        packageManager: "npm",
      };
      vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);

      // Expect the error thrown by promptForFramework
      await expect(utils.promptForOptions(mockArgs)).rejects.toThrow(
        'Internal error: Could not find template data for selected name "NonExistentTemplate"'
      );
    });
  });

  // --- Test cloneTemplate ---
  describe("cloneTemplate", () => {
    const degitTemplate = TEMPLATES.find(t => t.id === 'next-sdk-quickstart') as DegitTemplate;
    const gitTemplate = TEMPLATES.find(t => t.id === 'react-web3-starter') as GitTemplate;
    const destinationPath = "/path/to/project";
    const projectName = "my-project";
    const gitPath = path.join(destinationPath, ".git");
    const packageJsonPath = path.join(destinationPath, "package.json");
    const options: utils.ProjectOptions = { projectName, templateId: degitTemplate.id, blockchain_tooling: 'none', packageManager: 'yarn' };


    beforeEach(() => {
        // Reset mocks used within cloneTemplate tests
        mockedExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
        mockedFsReadFile.mockResolvedValue(
            JSON.stringify({ name: "template-name", version: "1.0.0" })
        );
        mockedFsWriteFile.mockResolvedValue(undefined);
        mockedFsRm.mockResolvedValue(undefined);
        // Reset the clone mock specifically
        mockedDegitClone.mockReset().mockResolvedValue(undefined); // Ensure clone defaults to success
    });

    // --- Degit Path Tests ---
    it("should call degit factory and clone method for DegitTemplate", async () => {
      await utils.cloneTemplate(options, destinationPath);

      // Check the factory call
      expect(mockedDegitFactory).toHaveBeenCalledWith(degitTemplate.degitSource, expect.anything());
      // Check the clone call on the instance
      expect(mockedDegitClone).toHaveBeenCalledWith(destinationPath);

      expect(mockedExecAsync).not.toHaveBeenCalled();
      expect(mockedFsRm).not.toHaveBeenCalledWith(gitPath, expect.anything());
    });

    it("should read, update, and write package.json for DegitTemplate", async () => {
        mockedFsReadFile.mockResolvedValue(JSON.stringify({ name: "old-name", version: "1.0.0" })); // Provide specific content
        await utils.cloneTemplate(options, destinationPath);

        // Verify degit clone was called first
        expect(mockedDegitClone).toHaveBeenCalled();

        // Verify package.json handling
        expect(mockedFsReadFile).toHaveBeenCalledWith(packageJsonPath, "utf-8");
        const expectedPackageJson = { name: projectName, version: "1.0.0" };
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
            packageJsonPath,
            JSON.stringify(expectedPackageJson, null, 2),
            "utf-8"
        );
    });

     it("should handle errors during degit clone", async () => {
        const cloneError = new Error("Degit clone failed");
        mockedDegitClone.mockRejectedValueOnce(cloneError); // Make degit fail

        await expect(
            utils.cloneTemplate(options, destinationPath)
        ).rejects.toThrow(cloneError);

        // Ensure subsequent steps didn't run
        expect(mockedFsReadFile).not.toHaveBeenCalled();
        expect(mockedFsWriteFile).not.toHaveBeenCalled();
    });

     it("should warn if package.json update fails for DegitTemplate", async () => {
        const writeError = new Error("Failed to write file");
        mockedFsWriteFile.mockRejectedValueOnce(writeError); // Fail writing package.json

        await utils.cloneTemplate(options, destinationPath);

        expect(mockedDegitClone).toHaveBeenCalled(); // Ensure clone happened
        expect(mockedFsReadFile).toHaveBeenCalled(); // Read should have happened
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("Warning: Could not update package.json name"),
            expect.stringContaining(writeError.message)
        );
    });


    // --- Git Clone Path Tests ---
    it("should call git clone with correct arguments for GitTemplate", async () => {
      await utils.cloneTemplate(options, destinationPath);

      expect(mockedExecAsync).toHaveBeenCalledWith(
        `git clone ${gitTemplate.repo_url} ${destinationPath}`
      );
      expect(mockedDegitFactory).not.toHaveBeenCalled(); // Ensure degit factory wasn't called
      expect(mockedDegitClone).not.toHaveBeenCalled(); // Ensure degit clone wasn't called
    });

    it("should remove the .git directory after cloning for GitTemplate", async () => {
      await utils.cloneTemplate(options, destinationPath);

      expect(mockedExecAsync).toHaveBeenCalled(); // Ensure clone happened
      expect(mockedFsRm).toHaveBeenCalledWith(gitPath, {
        recursive: true,
        force: true,
      });
    });

     it("should read, update, and write package.json for GitTemplate", async () => {
        mockedFsReadFile.mockResolvedValue(JSON.stringify({ name: "old-name", version: "1.0.0" }));
        await utils.cloneTemplate(options, destinationPath);

        // Verify clone happened first
        expect(mockedExecAsync).toHaveBeenCalled();
        expect(mockedFsRm).toHaveBeenCalled();

        // Verify package.json handling
        expect(mockedFsReadFile).toHaveBeenCalledWith(packageJsonPath, "utf-8");
        const expectedPackageJson = { name: projectName, version: "1.0.0" };
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
            packageJsonPath,
            JSON.stringify(expectedPackageJson, null, 2),
            "utf-8"
        );
    });

     it("should handle errors during git clone for GitTemplate", async () => {
      const cloneError = new Error("Git clone failed");
      mockedExecAsync.mockRejectedValueOnce(cloneError); // Make git clone fail

      await expect(
        utils.cloneTemplate(options, destinationPath)
      ).rejects.toThrow(cloneError);

      // Ensure subsequent steps didn't run
      expect(mockedFsRm).not.toHaveBeenCalled();
      expect(mockedFsReadFile).not.toHaveBeenCalled();
    });

    // --- Common Tests ---
    it("should throw error if templateId is not found", async () => {
      await expect(
        utils.cloneTemplate(options, destinationPath)
      ).rejects.toThrow('Template with id "invalid-id" not found.');
       expect(mockedExecAsync).not.toHaveBeenCalled();
       expect(mockedDegitClone).not.toHaveBeenCalled(); // Check clone mock here
    });
  });

  // --- Test initializeMonorepo ---
  describe("initializeMonorepo", () => {
    const projectName = "my-monorepo";
    const packagesPath = path.join(projectName, "packages");
    const blockchainPath = path.join(projectName, "packages", "blockchain");
    const sitePath = path.join(projectName, "packages", "site");
    const gitignorePath = path.join(projectName, ".gitignore");
    const rootPackageJsonPath = path.join(projectName, "package.json");
    const pnpmWorkspacePath = path.join(projectName, "pnpm-workspace.yaml");


    it("should create base directories", async () => {
       const options: utils.ProjectOptions = { projectName, templateId: "t", blockchain_tooling: 'none', packageManager: 'npm' };
       await utils.initializeMonorepo(options);

      // Check that mkdir was called for all necessary paths
      expect(mockedFsMkdir).toHaveBeenCalledWith(packagesPath, { recursive: true });
      expect(mockedFsMkdir).toHaveBeenCalledWith(blockchainPath, { recursive: true });
      expect(mockedFsMkdir).toHaveBeenCalledWith(sitePath, { recursive: true });
    });

     it("should create .gitignore", async () => {
       const options: utils.ProjectOptions = { projectName, templateId: "t", blockchain_tooling: 'none', packageManager: 'npm' };
       await utils.initializeMonorepo(options);

      // Check that writeFile was called for .gitignore
      expect(mockedFsWriteFile).toHaveBeenCalledWith(
        gitignorePath,
        expect.stringContaining("node_modules")
      );
    });

    it("should create root package.json", async () => {
       const options: utils.ProjectOptions = { projectName, templateId: "t", blockchain_tooling: 'none', packageManager: 'yarn' };
       await utils.initializeMonorepo(options);

      const expectedPackageJson = {
        name: projectName,
        private: true,
        workspaces: ["packages/*"],
        scripts: {},
      };
      // Check that writeFile was called for package.json
      expect(mockedFsWriteFile).toHaveBeenCalledWith(
        rootPackageJsonPath,
        JSON.stringify(expectedPackageJson, null, 2)
      );
    });

     it("should create pnpm-workspace.yaml for pnpm", async () => {
        const options: utils.ProjectOptions = { projectName, templateId: "t", blockchain_tooling: 'none', packageManager: 'pnpm' };
        await utils.initializeMonorepo(options);

        // Check that writeFile was called for pnpm-workspace.yaml
        expect(mockedFsWriteFile).toHaveBeenCalledWith(
            pnpmWorkspacePath,
            expect.stringContaining("packages:")
        );
    });

    // This test was passing, should still pass
    it("should not create pnpm-workspace.yaml for npm/yarn", async () => {
        const npmOptions: utils.ProjectOptions = { projectName, templateId: "t", blockchain_tooling: 'none', packageManager: 'npm' };
        await utils.initializeMonorepo(npmOptions);
        expect(mockedFsWriteFile).not.toHaveBeenCalledWith(pnpmWorkspacePath, expect.anything());

        vi.clearAllMocks(); // Reset mocks for the next part of the test
        mockedFsWriteFile.mockReset(); // Specifically reset writeFile


        const yarnOptions: utils.ProjectOptions = { projectName, templateId: "t", blockchain_tooling: 'none', packageManager: 'yarn' };
        await utils.initializeMonorepo(yarnOptions);
        expect(mockedFsWriteFile).not.toHaveBeenCalledWith(pnpmWorkspacePath, expect.anything());
    });
  });


  // --- Test createProject (integration-like) ---
  describe("createProject", () => {
    const projectName = "final-project";
    const templateId = TEMPLATES[0].id; // Use the degit template for these tests
    const installCommand = "yarn install";

    const mockOptions: utils.ProjectOptions = { projectName, templateId, blockchain_tooling: 'none', packageManager: 'yarn' };
    const mockHardhatOptions: utils.ProjectOptions = { projectName, templateId, blockchain_tooling: 'hardhat', packageManager: 'yarn' };
    const mockFoundryOptions: utils.ProjectOptions = { projectName, templateId, blockchain_tooling: 'foundry', packageManager: 'pnpm' };


    // Mock promptForOptions directly for these integration tests
     const promptOptionsMock = vi.spyOn(utils, 'promptForOptions');


    // Keep stubs for lower-level functions if needed for fine-grained checks,
    // but the main goal here is to test the createProject logic flow.
     const initializeMonorepoMock = vi.spyOn(utils, 'initializeMonorepo').mockResolvedValue(undefined);
     const cloneTemplateMock = vi.spyOn(utils, 'cloneTemplate').mockResolvedValue(undefined);


    beforeEach(() => {
      // Reset spies and mocks specific to this suite
      promptOptionsMock.mockClear();
      initializeMonorepoMock.mockClear();
      cloneTemplateMock.mockClear();
      mockedExecAsync.mockReset(); // Ensure execAsync is clean for the install command check
      mockedExecAsync.mockResolvedValue({ stdout: "", stderr: "" }); // Default success for install command
    });


    it("should call cloneTemplate directly for 'none' tooling", async () => {
        promptOptionsMock.mockResolvedValue(mockOptions); // Control options returned

        await utils.createProject(projectName);

        expect(promptOptionsMock).toHaveBeenCalled(); // Verify options were prompted/retrieved
        expect(initializeMonorepoMock).not.toHaveBeenCalled(); // Should not init monorepo
        expect(cloneTemplateMock).toHaveBeenCalledWith(templateId, projectName, projectName); // Called directly
        expect(mockedExecAsync).toHaveBeenCalledWith(`cd ${projectName} && ${installCommand}`); // Install called
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Success! Created"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("yarn run dev")); // Standalone guidance
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("blockchain")); // No monorepo guidance
    });

    it("should call initializeMonorepo and cloneTemplate (via createHardhatProject) for 'hardhat' tooling", async () => {
        promptOptionsMock.mockResolvedValue(mockHardhatOptions);


        await utils.createProject(projectName);

        expect(promptOptionsMock).toHaveBeenCalled();
        expect(initializeMonorepoMock).toHaveBeenCalledWith(mockHardhatOptions);
        // Hardhat template clone uses execAsync, frontend uses cloneTemplate
        expect(mockedExecAsync).toHaveBeenCalledWith(expect.stringContaining('git clone https://github.com/Consensys/hardhat-template.git'));
        expect(cloneTemplateMock).toHaveBeenCalledWith(templateId, path.join(projectName, "packages", "site"), projectName);
        expect(mockedExecAsync).toHaveBeenCalledWith(`cd ${projectName} && ${installCommand}`); // Install command
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Success! Created"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("yarn run compile")); // Monorepo guidance
    });

    it("should call initializeMonorepo and cloneTemplate (via createFoundryProject) for 'foundry' tooling", async () => {
        const pnpmInstallCommand = "pnpm install";
        promptOptionsMock.mockResolvedValue(mockFoundryOptions);

        await utils.createProject(projectName);

        expect(promptOptionsMock).toHaveBeenCalled();
        expect(initializeMonorepoMock).toHaveBeenCalledWith(mockFoundryOptions);
        // Foundry init uses execAsync, frontend uses cloneTemplate
        expect(mockedExecAsync).toHaveBeenCalledWith(expect.stringContaining('forge init . --no-commit'));
        expect(cloneTemplateMock).toHaveBeenCalledWith(templateId, path.join(projectName, "packages", "site"), projectName);
        expect(mockedExecAsync).toHaveBeenCalledWith(`cd ${projectName} && ${pnpmInstallCommand}`); // Install command
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Success! Created"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("pnpm run compile")); // Monorepo guidance
    });


     it("should handle errors during creation and not install", async () => {
        const creationError = new Error("Setup failed");
        promptOptionsMock.mockResolvedValue(mockOptions);
        // Make cloneTemplate fail
        cloneTemplateMock.mockRejectedValueOnce(creationError);

        await utils.createProject(projectName);

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("An error occurred during project creation:"),
            creationError
        );
        // Ensure install command is NOT run if setup fails
        expect(mockedExecAsync).not.toHaveBeenCalledWith(expect.stringContaining("install"));
     });
  });
});
