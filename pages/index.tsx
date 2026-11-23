import Head from "next/head";

import { siteConfig } from "@/config/site";

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>{siteConfig.name}</title>
      </Head>
      <main className="min-h-screen bg-white" />
    </>
  );
}
