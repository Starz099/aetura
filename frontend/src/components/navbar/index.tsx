import { Button } from "@/components/ui";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const { pathname } = useLocation();

  const isActive = (route: "/" | "/recordings" | "/editor") => {
    if (route === "/") {
      return pathname === "/";
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  };

  return (
    <header className="border-b border-border bg-card/85 backdrop-blur-sm">
      <div className="mx-auto flex h-12 w-full max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6">
        <nav aria-label="Global" className="ml-auto flex items-center gap-1">
          <Button
            asChild
            size="sm"
            variant={isActive("/") ? "secondary" : "ghost"}
            className="h-6"
          >
            <Link to="/">Home</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={isActive("/recordings") ? "secondary" : "ghost"}
            className="h-6"
          >
            <Link to="/recordings">Recordings</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={isActive("/editor") ? "secondary" : "ghost"}
            className="h-6"
          >
            <Link to="/editor">Editor</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
