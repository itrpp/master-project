type FontToken = {
  style: { fontFamily: string };
  variable: string;
};

export const fontSans: FontToken = {
  style: {
    fontFamily:
      '"Inter", "Prompt", "Noto Sans Thai", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  variable: "",
};

export const fontMono: FontToken = {
  style: {
    fontFamily:
      '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
  },
  variable: "",
};

export const fontThai: FontToken = {
  style: {
    fontFamily:
      '"Prompt", "Noto Sans Thai", "Sarabun", "Thonburi", "Segoe UI", Arial, sans-serif',
  },
  variable: "",
};
