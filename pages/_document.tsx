import { Html, Head, Main, NextScript } from "next/document";
import clsx from "clsx";

import { fontThai } from "@/config/fonts";

export default function Document() {
  return (
    <Html className="light" lang="th">
      <Head>
        <meta charSet="utf-8" />
        <meta content="text/html; charset=utf-8" httpEquiv="Content-Type" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body className={clsx("min-h-screen bg-slate-50 font-thai antialiased", fontThai.variable)}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
