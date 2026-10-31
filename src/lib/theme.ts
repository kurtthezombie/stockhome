export type ThemePreference = "system" | "light" | "dark";

export const themeStorageKey = "stockhome:theme";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Static, trusted code runs before paint; storage failures still follow the OS.
export const themeBootstrap = `(function(){var t="system";try{var v=localStorage.getItem("stockhome:theme");if(v==="light"||v==="dark")t=v}catch(e){}var d=t==="dark"||(t==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",!!d)})()`;
