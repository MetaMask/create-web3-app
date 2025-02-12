import { exec } from "child_process";
import { promises as fs } from "fs";
import {
  BLOCKCHAIN_TOOLING_CHOICES,
  FRAMEWORK_CHOICES,
  PACAKGE_MANAGER_CHOICES,
} from "../constants/index.js";
import { createReactApp } from "./vite.helpers.js";
import { createNextApp } from "./next.helpers.js";
import path from "path";
import util from "util";
import inquirer from "inquirer";

export const execAsync = util.promisify(exec);

const promptForFramework = async (): Promise<string> => {
  const frameworkChoice = FRAMEWORK_CHOICES.map((choice) => choice.name);
  const { framework }: { framework: string } = await inquirer.prompt([
    {
      type: "list",
      name: "framework",
      message: "Please select the framework you want to use:",
      choices: ["Next.js"],
    },
  ]);
  console.log(`Selected framework: ${framework}`);

  return framework;
};

const promptForTooling = async (): Promise<string> => {
  const toolingChoice = BLOCKCHAIN_TOOLING_CHOICES.map((choice) => choice.name);
  const { tooling }: { tooling: string } = await inquirer.prompt([
    {
      type: "list",
      name: "tooling",
      message: "Would you like to use HardHat or Foundry?",
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

const promptForOptions = async (args: string) => {
  const projectName = await promptForProjectDetails(args);
  const framework = await promptForFramework();
  // const tooling = await promptForTooling();
  const packageManager = await promptForPackageManager();

  const options = {
    projectName: projectName,
    framework: FRAMEWORK_CHOICES.find((choice) => choice.name === framework)
      ?.value,
    // blockchain_tooling: BLOCKCHAIN_TOOLING_CHOICES.find(
    //   (choice) => choice.name === tooling
    // )?.value,
    blockchain_tooling: "",
    packageManager: PACAKGE_MANAGER_CHOICES.find(
      (choice) => choice.name === packageManager
    )?.value!,
  };
  return options as any;
};

const initializeMonorepo = async (options: ProjectOptions) => {
  const { projectName, packageManager } = options;
  console.log("Initializing monorepo...");

  if (packageManager === "pnpm") {
    await fs.writeFile(
      path.join(projectName, "pnpm-workspace.yaml"),
      `packages:
        - 'packages/*'`
    );
  }

  await fs.writeFile(path.join(projectName, ".gitignore"), `node_modules`);
  await execAsync(`cd ${projectName} && npm init -y`);
  await execAsync(`cd ${projectName} && npm init -w ./packages/blockchain -y`);
  await execAsync(`cd ${projectName} && npm init -w ./packages/site -y`);

  await fs.rm(path.join(projectName, "packages", "blockchain", "package.json"));
  await fs.rm(path.join(projectName, "packages", "site", "package.json"));
  await fs.rm(path.join(projectName, "node_modules"), { recursive: true });
};

const createHardhatProject = async (options: ProjectOptions) => {
  const { projectName, framework } = options;
  await fs.mkdir(projectName);

  console.log("Creating a project with HardHat...");

  await initializeMonorepo(options);
  await execAsync(
    `git clone https://github.com/Consensys/hardhat-template.git ${path.join(
      projectName,
      "packages",
      "blockchain"
    )}`
  );

  if (framework === "nextjs") {
    await createNextApp(options, path.join(projectName, "packages", "site"));
  } else {
    await createReactApp(options, path.join(projectName, "packages", "site"));
  }
};

const createFoundryProject = async (options: ProjectOptions) => {
  const { projectName, framework } = options;
  await fs.mkdir(projectName);

  console.log("Creating a project with Foundry...");

  await initializeMonorepo(options);
  if (framework === "nextjs") {
    await createNextApp(options, path.join(projectName, "packages", "site"));
  } else {
    await createReactApp(options, path.join(projectName, "packages", "site"));
  }

  await execAsync(`
    cd ${projectName}/packages/blockchain && forge init . --no-commit
    `);
};

export const pathOrProjectName = (
  projectName: string,
  projectPath?: string
) => {
  return projectPath ? projectPath : projectName;
};

export const updatePackageJsonDependencies = async (
  dependencies: Record<string, string>,
  projectPath: string
) => {
  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(packageJsonContent);

  packageJson.dependencies = {
    ...packageJson.dependencies,
    ...dependencies,
  };

  const newPackageJsonContent = JSON.stringify(packageJson, null, 2);
  await fs.writeFile(packageJsonPath, newPackageJsonContent, "utf-8");

  console.log("Dependencies added to package.json");
};

export const createWagmiConfigFile = async (
  projectPath: string,
  ssr: boolean = false
) => {
  await fs.writeFile(
    path.join(projectPath, "wagmi.config.ts"),
    `
import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { lineaSepolia, linea, mainnet } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [lineaSepolia, linea, mainnet],
    connectors: [metaMask()],
    ssr: ${ssr},
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [lineaSepolia.id]: http(),
      [linea.id]: http(),
      [mainnet.id]: http(),
    },
  });
}

`
  );
};

export const usePackageManager = (packageManager: string) => {
  switch (packageManager) {
    case "npm":
      return "--use-npm";
    case "yarn":
      return "--use-yarn";
    case "pnpm":
      return "--use-pnpm";
    default:
      return "--use-npm";
  }
};

export const addShadcnButton = async (projectPath: string) => {
  const buttonFilePath = path.join(
    projectPath,
    "src",
    "components",
    "ui",
    "button.tsx"
  );

  try {
    console.log("Adding Shadcn button...");

    await fs.writeFile(
      buttonFilePath,
      `
      import * as React from "react"
      import { Slot } from "@radix-ui/react-slot"
      import { cva, type VariantProps } from "class-variance-authority"
  
      import { cn } from "@/src/lib/utils"
  
      const buttonVariants = cva(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        {
          variants: {
            variant: {
              default: "bg-primary text-primary-foreground hover:bg-primary/90",
              destructive:
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              outline:
                "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
              secondary:
                "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              ghost: "hover:bg-accent hover:text-accent-foreground",
              link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
              default: "h-10 px-4 py-2",
              sm: "h-9 rounded-md px-3",
              lg: "h-11 rounded-md px-8",
              icon: "h-10 w-10",
            },
          },
          defaultVariants: {
            variant: "default",
            size: "default",
          },
        }
      )
  
      export interface ButtonProps
        extends React.ButtonHTMLAttributes<HTMLButtonElement>,
          VariantProps<typeof buttonVariants> {
        asChild?: boolean
      }
  
      const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
        ({ className, variant, size, asChild = false, ...props }, ref) => {
          const Comp = asChild ? Slot : "button"
          return (
            <Comp
              className={cn(buttonVariants({ variant, size, className }))}
              ref={ref}
              {...props}
            />
          )
        }
      )
      Button.displayName = "Button"
  
      export { Button, buttonVariants }
    `
    );
  } catch (error) {
    console.error("An error occurred during button creation:", error);
  }
};

export const addShadcnCard = async (projectPath: string) => {
  const cardFilePath = path.join(
    projectPath,
    "src",
    "components",
    "ui",
    "card.tsx"
  );
  await fs.writeFile(
    cardFilePath,
    `
    import * as React from "react"
    import { cn } from "@/src/lib/utils"

    const Card = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className
        )}
        {...props}
      />
    ))
    Card.displayName = "Card"

    const CardHeader = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
      />
    ))
    CardHeader.displayName = "CardHeader"

    const CardTitle = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn(
          "text-2xl font-semibold leading-none tracking-tight",
          className
        )}
        {...props}
      />
    ))
    CardTitle.displayName = "CardTitle"

    const CardDescription = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    ))
    CardDescription.displayName = "CardDescription"

    const CardContent = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ className, ...props }, ref) => (
      <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
    ))
    CardContent.displayName = "CardContent"

    const CardFooter = React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
      />
    ))
    CardFooter.displayName = "CardFooter"

    export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

  `
  );
};

export const addShadcnDropdownMenu = async (projectPath: string) => {
  const dropdownMenuFilePath = path.join(
    projectPath,
    "src",
    "components",
    "ui",
    "dropdown-menu.tsx"
  );
  await fs.writeFile(
    dropdownMenuFilePath,
    `
    "use client"

    import * as React from "react"
    import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
    import { Check, ChevronRight, Circle } from "lucide-react"

    import { cn } from "@/src/lib/utils"

    const DropdownMenu = DropdownMenuPrimitive.Root

    const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

    const DropdownMenuGroup = DropdownMenuPrimitive.Group

    const DropdownMenuPortal = DropdownMenuPrimitive.Portal

    const DropdownMenuSub = DropdownMenuPrimitive.Sub

    const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

    const DropdownMenuSubTrigger = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
        inset?: boolean
      }
    >(({ className, inset, children, ...props }, ref) => (
      <DropdownMenuPrimitive.SubTrigger
        ref={ref}
        className={cn(
          "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          inset && "pl-8",
          className
        )}
        {...props}
      >
        {children}
        <ChevronRight className="ml-auto" />
      </DropdownMenuPrimitive.SubTrigger>
    ))
    DropdownMenuSubTrigger.displayName =
      DropdownMenuPrimitive.SubTrigger.displayName

    const DropdownMenuSubContent = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
    >(({ className, ...props }, ref) => (
      <DropdownMenuPrimitive.SubContent
        ref={ref}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    ))
    DropdownMenuSubContent.displayName =
      DropdownMenuPrimitive.SubContent.displayName

    const DropdownMenuContent = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.Content>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
    >(({ className, sideOffset = 4, ...props }, ref) => (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    ))
    DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

    const DropdownMenuItem = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.Item>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
        inset?: boolean
      }
    >(({ className, inset, ...props }, ref) => (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(
          "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          inset && "pl-8",
          className
        )}
        {...props}
      />
    ))
    DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

    const DropdownMenuCheckboxItem = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
    >(({ className, children, checked, ...props }, ref) => (
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
        checked={checked}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className="h-4 w-4" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    ))
    DropdownMenuCheckboxItem.displayName =
      DropdownMenuPrimitive.CheckboxItem.displayName

    const DropdownMenuRadioItem = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
    >(({ className, children, ...props }, ref) => (
      <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Circle className="h-2 w-2 fill-current" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    ))
    DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

    const DropdownMenuLabel = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.Label>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
        inset?: boolean
      }
    >(({ className, inset, ...props }, ref) => (
      <DropdownMenuPrimitive.Label
        ref={ref}
        className={cn(
          "px-2 py-1.5 text-sm font-semibold",
          inset && "pl-8",
          className
        )}
        {...props}
      />
    ))
    DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

    const DropdownMenuSeparator = React.forwardRef<
      React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
      React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
    >(({ className, ...props }, ref) => (
      <DropdownMenuPrimitive.Separator
        ref={ref}
        className={cn("-mx-1 my-1 h-px bg-muted", className)}
        {...props}
      />
    ))
    DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

    const DropdownMenuShortcut = ({
      className,
      ...props
    }: React.HTMLAttributes<HTMLSpanElement>) => {
      return (
        <span
          className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
          {...props}
        />
      )
    }
    DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

    export {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuCheckboxItem,
      DropdownMenuRadioItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuShortcut,
      DropdownMenuGroup,
      DropdownMenuPortal,
      DropdownMenuSub,
      DropdownMenuSubContent,
      DropdownMenuSubTrigger,
      DropdownMenuRadioGroup,
    }
  `
  );
};

export const addShadcnSeparator = async (projectPath: string) => {
  const separatorFilePath = path.join(
    projectPath,
    "src",
    "components",
    "ui",
    "separator.tsx"
  );
  await fs.writeFile(
    separatorFilePath,
    `
    "use client"

    import * as React from "react"
    import * as SeparatorPrimitive from "@radix-ui/react-separator"

    import { cn } from "@/src/lib/utils"

    const Separator = React.forwardRef<
      React.ElementRef<typeof SeparatorPrimitive.Root>,
      React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
    >(
      (
        { className, orientation = "horizontal", decorative = true, ...props },
        ref
      ) => (
        <SeparatorPrimitive.Root
          ref={ref}
          decorative={decorative}
          orientation={orientation}
          className={cn(
            "shrink-0 bg-border",
            orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
            className
          )}
          {...props}
        />
      )
    )
    Separator.displayName = SeparatorPrimitive.Root.displayName

    export { Separator }
  `
  );
};

export const createArrow = async (projectPath: string) => {
  const arrowFilePath = path.join(projectPath, "public", "arrow.svg");
  await fs.writeFile(
    arrowFilePath,
    `
    <svg width="85" height="52" viewBox="0 0 85 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.9069 48.9867C28.524 48.9685 44.9399 46.8616 62.7938 28.0353C67.127 23.4661 74.7149 16.6062 76.1499 10.1155C76.965 6.42874 80.3706 3.67474 74.6632 5.16652C69.9631 6.39503 62.9398 7.88933 58.9476 10.7791C57.5058 11.8227 74.3456 5.36654 79.3872 3.18791C85.8327 0.40257 79.5976 31.2825 78.7586 36.5193" stroke="white" stroke-opacity="0.3" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `
  );
};

export const createMetamaskLogo = async (projectPath: string) => {
  const metamaskLogoFilePath = path.join(
    projectPath,
    "public",
    "metamask-logo.svg"
  );
  await fs.writeFile(
    metamaskLogoFilePath,
    `
    <svg width="427" height="80" viewBox="0 0 427 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M376.9 40.2C374.7 38.7 372.3 37.7 369.9 36.4C368.4 35.6 366.8 34.8 365.5 33.7C363.3 31.9 363.7 28.3 366.1 26.7C369.4 24.5 374.9 25.7 375.5 30.2C375.5 30.3 375.6 30.4 375.7 30.4H380.7C380.8 30.4 380.9 30.3 380.9 30.2C380.6 27.1 379.4 24.5 377.2 22.8C375.1 21.2 372.7 20.4 370.1 20.4C356.9 20.4 355.7 34.4 362.8 38.8C363.6 39.3 370.6 42.8 373.1 44.4C375.6 45.9 376.3 48.7 375.3 50.9C374.3 52.9 371.8 54.3 369.3 54.1C366.5 53.9 364.4 52.4 363.6 50.1C363.5 49.7 363.4 48.9 363.4 48.5C363.4 48.4 363.3 48.3 363.2 48.3H357.8C357.7 48.3 357.6 48.4 357.6 48.5C357.6 52.4 358.6 54.6 361.2 56.6C363.7 58.5 366.4 59.3 369.3 59.3C376.7 59.3 380.5 55.1 381.3 50.8C381.9 46.6 380.7 42.8 376.9 40.2Z" fill="white"/>
      <path d="M141.2 21.2001H138.8H136.2C136.1 21.2001 136 21.3001 136 21.3001L131.5 36.0001C131.4 36.2001 131.2 36.2001 131.1 36.0001L126.6 21.3001C126.6 21.2001 126.5 21.2001 126.4 21.2001H123.8H121.4H118.2C118.1 21.2001 118 21.3001 118 21.4001V58.9001C118 59.0001 118.1 59.1001 118.2 59.1001H123.6C123.7 59.1001 123.8 59.0001 123.8 58.9001V30.4001C123.8 30.2001 124.1 30.1001 124.2 30.3001L128.7 45.1001L129 46.1001C129 46.2001 129.1 46.2001 129.2 46.2001H133.4C133.5 46.2001 133.6 46.1001 133.6 46.1001L133.9 45.1001L138.4 30.3001C138.5 30.1001 138.8 30.1001 138.8 30.4001V58.9001C138.8 59.0001 138.9 59.1001 139 59.1001H144.4C144.5 59.1001 144.6 59.0001 144.6 58.9001V21.4001C144.6 21.3001 144.5 21.2001 144.4 21.2001H141.2Z" fill="white"/>
      <path d="M293.8 21.2001C293.7 21.2001 293.6 21.3001 293.6 21.3001L289.1 36.0001C289 36.2001 288.8 36.2001 288.7 36.0001L284.2 21.3001C284.2 21.2001 284.1 21.2001 284 21.2001H275.7C275.6 21.2001 275.5 21.3001 275.5 21.4001V58.9001C275.5 59.0001 275.6 59.1001 275.7 59.1001H281.1C281.2 59.1001 281.3 59.0001 281.3 58.9001V30.4001C281.3 30.2001 281.6 30.1001 281.7 30.3001L286.2 45.1001L286.5 46.1001C286.5 46.2001 286.6 46.2001 286.7 46.2001H290.9C291 46.2001 291.1 46.1001 291.1 46.1001L291.4 45.1001L295.9 30.3001C296 30.1001 296.3 30.1001 296.3 30.4001V58.9001C296.3 59.0001 296.4 59.1001 296.5 59.1001H301.9C302 59.1001 302.1 59.0001 302.1 58.9001V21.4001C302.1 21.3001 302 21.2001 301.9 21.2001H293.8Z" fill="white"/>
      <path d="M223.8 21.2001H213.7H208.3H198.1C198 21.2001 197.9 21.3001 197.9 21.4001V26.1001C197.9 26.2001 198 26.3001 198.1 26.3001H208V58.9001C208 59.0001 208.1 59.1001 208.2 59.1001H213.6C213.7 59.1001 213.8 59.0001 213.8 58.9001V26.3001H223.7C223.8 26.3001 223.9 26.2001 223.9 26.1001V21.4001C224 21.3001 223.9 21.2001 223.8 21.2001Z" fill="white"/>
      <path d="M255.8 59.1H260.7C260.8 59.1 260.9 59 260.9 58.8L250.7 21.2C250.7 21.1 250.6 21.1 250.5 21.1H248.6H245.3H243.4C243.3 21.1 243.2 21.2 243.2 21.2L233 58.8C233 58.9 233.1 59.1 233.2 59.1H238.1C238.2 59.1 238.3 59 238.3 59L241.3 48C241.3 47.9 241.4 47.9 241.5 47.9H252.4C252.5 47.9 252.6 48 252.6 48L255.6 59C255.6 59 255.7 59.1 255.8 59.1ZM242.8 42.5L246.8 27.8C246.9 27.6 247.1 27.6 247.2 27.8L251.2 42.5C251.2 42.6 251.1 42.8 251 42.8H243.1C242.9 42.8 242.8 42.6 242.8 42.5Z" fill="white"/>
      <path d="M340 59.1H344.9C345 59.1 345.1 59 345.1 58.8L334.9 21.2C334.9 21.1 334.8 21.1 334.7 21.1H332.8H329.5H327.6C327.5 21.1 327.4 21.2 327.4 21.2L317.2 58.8C317.2 58.9 317.3 59.1 317.4 59.1H322.3C322.4 59.1 322.5 59 322.5 59L325.5 48C325.5 47.9 325.6 47.9 325.7 47.9H336.6C336.7 47.9 336.8 48 336.8 48L339.8 59C339.8 59 339.9 59.1 340 59.1ZM327 42.5L331 27.8C331.1 27.6 331.3 27.6 331.4 27.8L335.4 42.5C335.4 42.6 335.3 42.8 335.2 42.8H327.3C327.1 42.8 327 42.6 327 42.5Z" fill="white"/>
      <path d="M166.6 53.5001V41.9001C166.6 41.8001 166.7 41.7001 166.8 41.7001H181.3C181.4 41.7001 181.5 41.6001 181.5 41.5001V36.8001C181.5 36.7001 181.4 36.6001 181.3 36.6001H166.8C166.7 36.6001 166.6 36.5001 166.6 36.4001V26.5001C166.6 26.4001 166.7 26.3001 166.8 26.3001H183.2C183.3 26.3001 183.4 26.2001 183.4 26.1001V21.4001C183.4 21.3001 183.3 21.2001 183.2 21.2001H166.6H161C160.9 21.2001 160.8 21.3001 160.8 21.4001V26.3001V36.7001V41.8001V53.8001V58.9001C160.8 59.0001 160.9 59.1001 161 59.1001H166.6H183.9C184 59.1001 184.1 59.0001 184.1 58.9001V54.0001C184.1 53.9001 184 53.8001 183.9 53.8001H166.7C166.7 53.7001 166.6 53.6001 166.6 53.5001Z" fill="white"/>
      <path d="M426.5 58.7L407.7 39.3C407.6 39.2 407.6 39.1 407.7 39L424.6 21.4C424.7 21.3 424.6 21.1 424.5 21.1H417.6C417.5 21.1 417.5 21.1 417.5 21.2L403.1 36.2C403 36.3 402.8 36.2 402.8 36.1V21.5C402.8 21.4 402.7 21.3 402.6 21.3H397.1C397 21.3 396.9 21.4 396.9 21.5V59C396.9 59.1 397 59.2 397.1 59.2H402.5C402.6 59.2 402.7 59.1 402.7 59V42.5C402.7 42.3 402.9 42.2 403 42.4L419.2 59.2L419.3 59.3H426.2C426.5 59.1 426.6 58.8 426.5 58.7Z" fill="white"/>
      <path d="M80.9001 1L48.1001 25.4L54.2001 11L80.9001 1Z" fill="#E17726" stroke="#E17726" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.1001 1L37.7001 25.6L31.9001 11L5.1001 1Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M69.1003 57.5L60.3003 70.9L79.1003 76.1L84.4003 57.8L69.1003 57.5Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M1.7002 57.8L7.0002 76.1L25.7002 70.9L17.0002 57.5L1.7002 57.8Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24.7 34.9L19.5 42.8L38 43.6L37.4 23.6L24.7 34.9Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M61.4001 34.9L48.5001 23.4L48.1001 43.6L66.6001 42.8L61.4001 34.9Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M25.7002 70.9L36.9002 65.5L27.2002 57.9L25.7002 70.9Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M49.2002 65.5L60.3002 70.9L58.8002 57.9L49.2002 65.5Z" fill="#E27625" stroke="#E27625" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M60.3002 70.9L49.2002 65.5L50.1002 72.7L50.0002 75.8L60.3002 70.9Z" fill="#D5BFB2" stroke="#D5BFB2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M25.7002 70.9L36.1002 75.8L36.0002 72.7L36.9002 65.5L25.7002 70.9Z" fill="#D5BFB2" stroke="#D5BFB2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M36.3 53.1L27 50.4L33.5 47.4L36.3 53.1Z" fill="#233447" stroke="#233447" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M49.7998 53.1L52.4998 47.4L59.0998 50.4L49.7998 53.1Z" fill="#233447" stroke="#233447" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M25.7 70.9L27.3 57.5L17 57.8L25.7 70.9Z" fill="#CC6228" stroke="#CC6228" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M58.7998 57.5L60.2998 70.9L69.0998 57.8L58.7998 57.5Z" fill="#CC6228" stroke="#CC6228" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M66.6001 42.8L48.1001 43.6001L49.8001 53.1001L52.5001 47.4001L59.1001 50.4001L66.6001 42.8Z" fill="#CC6228" stroke="#CC6228" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 50.4001L33.5 47.4001L36.3 53.1001L38 43.6001L19.5 42.8L27 50.4001Z" fill="#CC6228" stroke="#CC6228" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19.5 42.8L27.2 57.9001L27 50.4001L19.5 42.8Z" fill="#E27525" stroke="#E27525" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M59.0998 50.4001L58.7998 57.9001L66.5998 42.8L59.0998 50.4001Z" fill="#E27525" stroke="#E27525" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M37.9998 43.6001L36.2998 53.1001L38.3998 64.4001L38.8998 49.5001L37.9998 43.6001Z" fill="#E27525" stroke="#E27525" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M48.1002 43.6001L47.2002 49.5001L47.6002 64.4001L49.8002 53.1001L48.1002 43.6001Z" fill="#E27525" stroke="#E27525" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M49.8001 53.1L47.6001 64.4L49.2001 65.5L58.8001 57.9L59.1001 50.4L49.8001 53.1Z" fill="#F5841F" stroke="#F5841F" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 50.4L27.2 57.9L36.9 65.5L38.4 64.4L36.3 53.1L27 50.4Z" fill="#F5841F" stroke="#F5841F" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50.0002 75.8L50.1002 72.7L49.2002 72H36.8002L36.0002 72.7L36.1002 75.8L25.7002 70.9L29.3002 73.9L36.7002 79H49.3002L56.7002 73.9L60.3002 70.9L50.0002 75.8Z" fill="#C0AC9D" stroke="#C0AC9D" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M49.2 65.5L47.6 64.4H38.4L36.9 65.5L36 72.7L36.8 72H49.2L50.1 72.7L49.2 65.5Z" fill="#161616" stroke="#161616" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M82.3002 27L85.1002 13.5L80.9002 1L49.2002 24.6L61.4002 34.9L78.6002 39.9L82.4002 35.5L80.8002 34.3L83.4002 31.9L81.4002 30.3L84.0002 28.3L82.3002 27Z" fill="#763E1A" stroke="#763E1A" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M1 13.5L3.8 27L2 28.3L4.6 30.3L2.6 31.9L5.3 34.3L3.6 35.5L7.4 39.9L24.7 34.9L36.9 24.6L5.1 1L1 13.5Z" fill="#763E1A" stroke="#763E1A" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M78.5998 39.9L61.3998 34.9L66.5998 42.8L58.7998 57.9L69.0998 57.8H84.3998L78.5998 39.9Z" fill="#F5841F" stroke="#F5841F" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24.7002 34.9L7.4002 39.9L1.7002 57.8H17.0002L27.2002 57.9L19.5002 42.8L24.7002 34.9Z" fill="#F5841F" stroke="#F5841F" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M48.0999 43.6L49.1999 24.6L54.1999 11H31.8999L36.8999 24.6L37.9999 43.6L38.3999 49.6V64.4H47.5999V49.6L48.0999 43.6Z" fill="#F5841F" stroke="#F5841F" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
  );
};

export const createNoise = async (projectPath: string) => {
  const noiseFilePath = path.join(projectPath, "public", "noise.svg");
  await fs.writeFile(
    noiseFilePath,
    `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><filter id='a'><feTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#a)'/></svg>
  `
  );
};

export const updateTailwindConfig = async (projectPath: string) => {
  const tailwindConfigFilePath = path.join(projectPath, "tailwind.config.ts");
  await fs.writeFile(
    tailwindConfigFilePath,
    `
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      backgroundImage: {
        noise: "url('/noise.svg')",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
  `
  );
};

export const createProject = async (args: string) => {
  const options = await promptForOptions(args);

  if (options.blockchain_tooling === "hardhat") {
    createHardhatProject(options);
    return;
  }

  if (options.blockchain_tooling === "foundry") {
    createFoundryProject(options);
    return;
  }

  switch (options.framework) {
    case "nextjs":
      await createNextApp(options);
      break;
    case "react":
      await createReactApp(options);
      break;
    default:
      break;
  }
};

export const createComponentsFolder = async (projectPath: string) => {
  await fs.mkdir(path.join(projectPath, "src", "components", "ui"), {
    recursive: true,
  });
};

export const createUtils = async (projectPath: string) => {
  await fs.mkdir(path.join(projectPath, "src", "lib"), {
    recursive: true,
  });
  const utilsPath = path.join(projectPath, "src", "lib", "utils.ts");

  await fs.writeFile(
    utilsPath,
    `
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatAddress = (addr: string | undefined) => {
  if (!addr || addr.length < 10) {
    throw new Error("Invalid wallet address");
  }
  return addr.slice(0, 6) + "..." + addr.slice(-4);
};
  `
  );
};
