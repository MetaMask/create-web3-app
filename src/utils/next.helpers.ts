import path from "path";
import { promises as fs } from "fs";
import {
  addShadcnButton,
  addShadcnCard,
  createWagmiConfigFile,
  execAsync,
  pathOrProjectName,
  updatePackageJsonDependencies,
  usePackageManager,
  addShadcnDropdownMenu,
  addShadcnSeparator,
  createNoise,
  createArrow,
  createMetamaskLogo,
  updateTailwindConfig,
  createComponentsFolder,
  createUtils,
} from "./index.js";

export const createNextApp = async (
  options: ProjectOptions,
  projectPath?: string
) => {
  console.log("Creating Next.js project...");
  try {
    const { projectName, packageManager } = options;
    const projectPathOrName = pathOrProjectName(projectName, projectPath);

    const command = `npx create-next-app ${projectPathOrName} --ts --tailwind --eslint --app --src-dir --skip-install --import-alias "@/*" ${usePackageManager(
      packageManager
    )} --turbopack`;

    await execAsync(command);

    await updatePackageJsonDependencies(
      {
        "@tanstack/react-query": "^5.51.23",
        "@radix-ui/react-slot": "^1.1.1",
        "@radix-ui/react-dropdown-menu": "^2.1.3",
        "@radix-ui/react-separator": "^1.1.1",
        "lucide-react": "^0.468.0",
        "class-variance-authority": "^0.7.1",
        "tailwind-merge": "^2.5.5",
        "tailwindcss-animate": "^1.0.7",
        clsx: "^2.1.1",
        viem: "2.x",
        wagmi: "^2.14.8",
      },
      projectPathOrName
    );
    await updateTsConfig(projectPathOrName);

    await createComponentsFolder(projectPathOrName);
    await updateLayoutFile(projectPathOrName);
    await createProvider(projectPathOrName);
    await createWagmiConfigFile(projectPathOrName, true);
    await createUtils(projectPathOrName);
    await updateGlobalStyles(projectPathOrName);
    await updateTailwindConfig(projectPathOrName);
    await addShadcnButton(projectPathOrName);
    await addShadcnCard(projectPathOrName);
    await addShadcnDropdownMenu(projectPathOrName);
    await addShadcnSeparator(projectPathOrName);
    await createNoise(projectPathOrName);
    await createArrow(projectPathOrName);
    await createMetamaskLogo(projectPathOrName);
    await createHero(projectPathOrName);
    await createNavbar(projectPathOrName);
    await updatePageFile(projectPathOrName);

    console.log("Next.js project created successfully!");
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
};

const updateTsConfig = async (projectPath: string) => {
  const tsConfigPath = path.join(projectPath, "tsconfig.json");
  const tsConfigContent = await fs.readFile(tsConfigPath, "utf-8");
  const tsConfig = JSON.parse(tsConfigContent);

  tsConfig.compilerOptions.paths = {
    "@/*": ["./*"],
  };

  const newTsConfigContent = JSON.stringify(tsConfig, null, 2);
  await fs.writeFile(tsConfigPath, newTsConfigContent, "utf-8");
};

const updateLayoutFile = async (projectPath: string) => {
  const layoutFilePath = path.join(projectPath, "src", "app", "layout.tsx");
  await fs.writeFile(
    layoutFilePath,
    `
    import type { Metadata } from "next";
    import { Geist, Geist_Mono } from "next/font/google";
    import { headers } from "next/headers";
    import { cookieToInitialState } from "wagmi";
    import "./globals.css";
    import { getConfig } from "@/wagmi.config";
    import { Providers } from "@/src/providers/WagmiProvider";
    import { Navbar } from "@/src/components/navbar";
    
    const geistSans = Geist({
      variable: "--font-geist-sans",
      subsets: ["latin"],
    });
    
    const geistMono = Geist_Mono({
      variable: "--font-geist-mono",
      subsets: ["latin"],
    });
    
    export const metadata: Metadata = {
      title: "MetaMask SDK Quickstart",
      description: "MetaMask SDK Quickstart app",
    };
    
    export default async function RootLayout({
      children,
    }: Readonly<{
      children: React.ReactNode;
    }>) {
      const initialState = cookieToInitialState(
        getConfig(),
        (await headers()).get("cookie") ?? ""
      );
      return (
        <html lang="en">
          <body
            className={
              geistSans.variable +
              " " +
              geistMono.variable +
              " " +
              "bg-black bg-opacity-90 text-foreground antialiased"
            }
          >
            <div className="fixed inset-0 w-full h-full bg-repeat bg-noise opacity-25 bg-[length:350px] z-[-20] before:content-[''] before:absolute before:w-[2500px] before:h-[2500px] before:rounded-full before:blur-[100px] before:-left-[1000px] before:-top-[2000px] before:bg-white before:opacity-50 before:z-[-100]"></div>
            <main className="flex flex-col max-w-screen-lg mx-auto pb-20">
              <Providers initialState={initialState}>
                <Navbar />
                {children}
              </Providers>
            </main>
          </body>
        </html>
      );
    }    
`
  );
};

const createProvider = async (projectPath: string) => {
  await fs.mkdir(path.join(projectPath, "src", "providers"));
  const providerFilePath = path.join(
    projectPath,
    "src",
    "providers",
    "WagmiProvider.tsx"
  );
  await fs.writeFile(
    providerFilePath,
    `
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { type State, WagmiProvider } from "wagmi";

import { getConfig } from "@/wagmi.config";

type Props = {
  children: ReactNode;
  initialState: State | undefined;
};

export function Providers({ children, initialState }: Props) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
    `
  );
};

const updatePageFile = async (projectPath: string) => {
  const pageFilePath = path.join(projectPath, "src", "app", "page.tsx");

  await fs.writeFile(
    pageFilePath,
    `
import { Separator } from "@/src/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/src/components/Hero";

export default function Home() {
  return (
    <main className="">
      <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
        <Hero />

        <Separator className="w-full my-14 opacity-15" />

        <section className="flex flex-col items-center md:flex-row gap-10 w-full justify-center max-w-5xl">
          <div className="flex flex-col gap-10">
            {/* Docs Card */}
            <a
              href="https://docs.metamask.io/sdk/"
              target="_blank"
              className="relative bg-indigo-500 rounded-tr-sm rounded-bl-sm rounded-tl-xl rounded-br-xl bg-opacity-40 max-w-md text-white border-none transition-colors h-full"
            >
              <div className="bg-indigo-500 bg-opacity-20 h-[107%] w-[104%] rounded-xl -z-20 absolute right-0 bottom-0"></div>
              <div className="bg-indigo-500 bg-opacity-20 h-[107%] w-[104%] rounded-xl -z-20 absolute top-0 left-0"></div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  Docs
                  <ArrowRight className="h-5 w-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg text-indigo-100">
                  Find in-depth information about the SDK features
                </p>
              </CardContent>
            </a>

            {/* Get ETH Card */}
            <a
              href="https://docs.metamask.io/developer-tools/faucet/"
              target="_blank"
              className="bg-teal-300 bg-opacity-60 rounded-tr-sm rounded-bl-sm rounded-tl-xl rounded-br-xl relative max-w-md h-full text-white border-none transition-colors"
            >
              <div className="bg-teal-300 bg-opacity-20 h-[107%] w-[104%] rounded-xl -z-20 absolute right-0 bottom-0"></div>
              <div className="bg-teal-300 bg-opacity-20 h-[107%] w-[104%] rounded-xl -z-20 absolute top-0 left-0"></div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  Get ETH on testnet
                  <ArrowRight className="h-5 w-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg text-emerald-100">
                  Get testnet tokens to use when testing your smart contracts.
                </p>
              </CardContent>
            </a>
          </div>

          <Card className="relative bg-pink-500 bg-opacity-35 rounded-tr-sm rounded-bl-sm text-white border-none h-full w-full max-w-xl self-start h-[360px]">
            <div className="bg-pink-500 bg-opacity-20 h-[104%] w-[103%] md:h-[103%] md:w-[102%] rounded-xl -z-20 absolute right-0 bottom-0"></div>
            <div className="bg-pink-500 bg-opacity-20 h-[104%] w-[103%] md:h-[103%] md:w-[102%] rounded-xl -z-20 absolute top-0 left-0"></div>
            <CardHeader>
              <CardTitle className="text-2xl">
                Add your own functionality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-7">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Guides</h3>
                <div className="space-y-2">
                  {[
                    {url: "https://docs.metamask.io/sdk/guides/network-management/", text: "Manage Networks"},
                    {url: "https://docs.metamask.io/sdk/guides/transaction-handling/", text: "Handle Transactions"},
                    {url: "https://docs.metamask.io/sdk/guides/interact-with-contracts/", text: "Interact with Smart Contracts"},
                  ].map((item) => (
                    <a
                      href={item.url}
                      key={item.text}
                      target="_blank"
                      className="flex items-center gap-2 w-fit text-white text-opacity-80 cursor-pointer transition-colors"
                    >
                      <span className="hover:mr-1 duration-300">{item.text}</span>
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Examples</h3>
                <div className="space-y-1">
                  {[
                    {url: "https://github.com/MetaMask/metamask-sdk-examples/tree/main/examples/quickstart", text: "Next.js + Wagmi"},
                  ].map((item) => (
                    <a
                      href={item.url}
                      key={item.text}
                      target="_blank"
                      className="flex items-center gap-2 w-fit text-white text-opacity-80 cursor-pointer transition-colors"
                    >
                      <span className="hover:mr-1 duration-300">{item.text}</span>
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
    `
  );
};

const createNavbar = async (projectPath: string) => {
  const navbarFilePath = path.join(
    projectPath,
    "src",
    "components",
    "navbar.tsx"
  );
  await fs.writeFile(
    navbarFilePath,
    `
"use client";

import Image from "next/image";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { formatAddress } from "@/src/lib/utils";
import { ChevronDown } from "lucide-react";

export function Navbar() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, chains } = useSwitchChain();

  const connector = connectors[0];

  return (
    <nav className="flex w-full px-3 md:px-0 h-fit py-10 justify-between items-center">
      <Image
        src="/metamask-logo.svg"
        alt="Metamask Logo"
        width={180}
        height={180}
      />

      {isConnected ? (
        <div className="flex-col md:flex-row flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="bg-white h-fit md:px-3 py-2 rounded-2xl font-semibold flex justify-center  items-center gap-1">
              {chain?.name.split(" ").slice(0, 2).join(" ")} <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full justify-center rounded-2xl">
              {chains.map(
                (c) =>
                  c.id !== chain?.id && (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => switchChain({ chainId: c.id })}
                      className="cursor-pointer w-full flex justify-center rounded-2xl font-semibold"
                    >
                      {c.name}
                    </DropdownMenuItem>
                  )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="bg-white h-fit px-7 py-2 rounded-2xl font-semibold flex items-center gap-1">
              {formatAddress(address)} <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full flex justify-center rounded-2xl">
              <DropdownMenuItem
                onClick={() => disconnect()}
                className="text-red-400 cursor-pointer w-full flex justify-center rounded-2xl font-semibold"
              >
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button
          className="bg-blue-500 rounded-xl hover:bg-blue-600 shadow-xl md:px-10 font-semibold"
          onClick={() => connect({ connector })}
        >
          Connect Wallet
        </Button>
      )}
    </nav>
  );
}
  `
  );
};

const createHero = async (projectPath: string) => {
  const heroFilePath = path.join(projectPath, "src", "components", "Hero.tsx");
  await fs.writeFile(
    heroFilePath,
    `
    "use client";

    import Image from "next/image";
    import { useAccount } from "wagmi";

    export const Hero = () => {
      const { isConnected } = useAccount();

      if (isConnected) {
        return (
          <section className="relative mx-auto mt-28">
            <h1 className="text-7xl text-zinc-100 font-bold">Welcome</h1>
            <p className="text-white opacity-70 text-center text-lg">
              to the <strong>MetaMask SDK</strong> quick start app!
              <br /> Add your functionality.
            </p>
            <Image
              src="/arrow.svg"
              alt="Arrow pointing to the connect wallet button"
              className="absolute scale-y-[-1] hidden md:block md:bottom-[-65px] md:right-[-95px]"
              width={130}
              height={130}
            />
          </section>
        );
      }

      return (
        <section className="relative mx-auto mt-28">
          <h1 className="text-7xl text-zinc-100 font-bold">Welcome</h1>
          <p className="text-white opacity-70 text-center text-lg">
            to the <strong>MetaMask SDK</strong> quick start app!
            <br /> Connect your wallet to get started.
          </p>
          <Image
            src="/arrow.svg"
            alt="Arrow pointing to the connect wallet button"
            className="absolute hidden md:block md:bottom-5 md:-right-48"
            width={150}
            height={150}
          />
        </section>
      );
    };
  `
  );
};

const updateGlobalStyles = async (projectPath: string) => {
  const globalStylesFilePath = path.join(
    projectPath,
    "src",
    "app",
    "globals.css"
  );
  await fs.writeFile(
    globalStylesFilePath,
    `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  @font-face {
    font-family: "Cedarville Cursive";
    src: url("/fonts/cedarville-cursive-regular.woff2") format("woff2");
  }
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

body {
  font-family: Arial, Helvetica, sans-serif;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
  `
  );
};
