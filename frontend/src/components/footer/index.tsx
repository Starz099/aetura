import { Button } from "@/components/ui";
import { Link } from "react-router-dom";
import { Moon, Sun, GearIcon } from "@phosphor-icons/react";
import { useState } from "react";

const Footer = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const isDark = document.documentElement.classList.contains("dark");
    return isDark ? "dark" : "light";
  });

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  const openPortfolio = () => {
    window.open("https://starzz.dev/", "_blank");
  };

  return (
    <footer className="border-t border-border bg-card/85 backdrop-blur-sm">
      <div className="mx-auto flex h-12 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
        {/* Left: Branding */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/" className="font-semibold">
            Aetura
          </Link>
          <button
            onClick={openPortfolio}
            className="cursor-pointer hover:text-foreground transition-colors"
            title="Visit starz's portfolio"
          >
            Made by starz
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Settings"
          >
            <Link to="/settings">
              <GearIcon size={18} weight="bold" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>

          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer h-8 w-8 p-0"
            onClick={toggleTheme}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? (
              <Moon size={18} weight="bold" />
            ) : (
              <Sun size={18} weight="bold" />
            )}
            <span className="sr-only">
              Switch to {theme === "light" ? "dark" : "light"} theme
            </span>
          </Button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
