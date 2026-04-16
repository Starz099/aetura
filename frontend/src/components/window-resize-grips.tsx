import { getCurrentWindow } from "@tauri-apps/api/window";

type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const grips: Array<{ direction: ResizeDirection; className: string }> = [
  {
    direction: "North",
    className: "fixed left-2 right-2 top-0 h-1 cursor-n-resize",
  },
  {
    direction: "South",
    className: "fixed bottom-0 left-2 right-2 h-1 cursor-s-resize",
  },
  {
    direction: "West",
    className: "fixed bottom-2 left-0 top-2 w-1 cursor-w-resize",
  },
  {
    direction: "East",
    className: "fixed bottom-2 right-0 top-2 w-1 cursor-e-resize",
  },
  {
    direction: "NorthWest",
    className: "fixed left-0 top-0 h-2 w-2 cursor-nw-resize",
  },
  {
    direction: "NorthEast",
    className: "fixed right-0 top-0 h-2 w-2 cursor-ne-resize",
  },
  {
    direction: "SouthWest",
    className: "fixed bottom-0 left-0 h-2 w-2 cursor-sw-resize",
  },
  {
    direction: "SouthEast",
    className: "fixed bottom-0 right-0 h-2 w-2 cursor-se-resize",
  },
];

const WindowResizeGrips = () => {
  if (!isTauriRuntime) {
    return null;
  }

  const startResize = async (direction: ResizeDirection) => {
    try {
      await getCurrentWindow().startResizeDragging(direction);
    } catch (error) {
      console.error(`Resize start failed: ${direction}`, error);
    }
  };

  return (
    <>
      {grips.map((grip) => (
        <div
          key={grip.direction}
          className={`z-70 select-none ${grip.className}`}
          onMouseDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            startResize(grip.direction);
          }}
        />
      ))}
    </>
  );
};

export default WindowResizeGrips;
