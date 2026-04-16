import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";

const ThemeToggle = ({
  className = "",
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "ghost";
}) => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") {
      return "light";
    }

    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    };

    updateTheme();
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");

    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
      return;
    }

    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
    setTheme("dark");
  };

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      onClick={toggleTheme}
      title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      {theme === "light" ? (
        <MoonIcon size={16} weight="bold" />
      ) : (
        <SunIcon size={16} weight="bold" />
      )}
      <span className="sr-only">
        Switch to {theme === "light" ? "dark" : "light"} theme
      </span>
    </Button>
  );
};

export default ThemeToggle;
