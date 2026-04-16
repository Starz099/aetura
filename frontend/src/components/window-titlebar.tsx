import { Link, useLocation } from "react-router-dom";
import {
  ArrowsOutSimpleIcon,
  ArrowClockwiseIcon,
  GearIcon,
  HouseIcon,
  MinusIcon,
  VideoCameraIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import ThemeToggle from "@/components/theme-toggle";
import { getCurrentWindow } from "@tauri-apps/api/window";

const WindowTitlebar = () => {
  const location = useLocation();

  const showRefreshRecordings = location.pathname.startsWith("/recordings");

  const startWindowDrag = async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error("Window drag start failed", error);
    }
  };

  const handleTitlebarMouseDown = (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-no-window-drag='true']")) {
      return;
    }

    event.preventDefault();
    startWindowDrag();
  };

  const runWindowAction = async (
    action: "minimize" | "toggleMaximize" | "close",
  ) => {
    try {
      const appWindow = getCurrentWindow();

      if (action === "minimize") {
        await appWindow.minimize();
        return;
      }

      if (action === "toggleMaximize") {
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
        return;
      }

      await appWindow.close();
    } catch (error) {
      console.error(`Window action failed: ${action}`, error);
    }
  };

  const refreshRecordings = () => {
    window.dispatchEvent(new CustomEvent("aetura:refresh-recordings"));
  };

  return (
    <header
      className="border-b border-border bg-card/90"
      onMouseDown={handleTitlebarMouseDown}
    >
      <div className="flex h-11 w-full items-center justify-between px-2 sm:px-3">
        <div className="min-w-0 px-2 text-sm font-semibold text-muted-foreground">
          Aetura
        </div>

        <div className="h-full flex-1" />

        <div className="flex items-center gap-1" data-no-window-drag="true">
          {showRefreshRecordings ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={refreshRecordings}
                title="Refresh recordings"
              >
                <ArrowClockwiseIcon size={15} weight="bold" />
                <span className="sr-only">Refresh recordings</span>
              </Button>
            </>
          ) : null}

          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Home"
          >
            <Link to="/">
              <HouseIcon size={15} weight="bold" />
              <span className="sr-only">Home</span>
            </Link>
          </Button>

          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Recordings"
          >
            <Link to="/recordings">
              <VideoCameraIcon size={15} weight="bold" />
              <span className="sr-only">Recordings</span>
            </Link>
          </Button>

          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Settings"
          >
            <Link to="/settings">
              <GearIcon size={15} weight="bold" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>

          <ThemeToggle className="h-8 w-8 p-0" variant="ghost" />

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => runWindowAction("minimize")}
            title="Minimize"
          >
            <MinusIcon size={14} weight="bold" />
            <span className="sr-only">Minimize</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => runWindowAction("toggleMaximize")}
            title="Maximize"
          >
            <ArrowsOutSimpleIcon size={14} weight="bold" />
            <span className="sr-only">Maximize</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
            onClick={() => runWindowAction("close")}
            title="Close"
          >
            <XIcon size={14} weight="bold" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default WindowTitlebar;
