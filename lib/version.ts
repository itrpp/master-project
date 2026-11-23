import packageJson from "../package.json";

export const appVersion: string = packageJson.version ?? "1.0.0";
export const appName: string = packageJson.name ?? "master-project";

export const appBuildId: string = String(
  process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "",
).trim();
