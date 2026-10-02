import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paypal: {
          blue: "#003087",
          darkblue: "#001C64",
          lightblue: "#0070BA",
          yellow: "#FFC439",
          gray: "#F5F7FA"
        }
      }
    },
  },
  plugins: [],
};
export default config;
