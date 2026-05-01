import { create } from "zustand";
import { createTimelineSlice } from "./slices/timelineSlice";
import { createEffectSlice } from "./slices/effectSlice";
import { createExportSlice } from "./slices/exportSlice";
import type { EditorState } from "@/types/store";

export const useEditorStore = create<EditorState>()((...a) => ({
  ...createTimelineSlice(...a),
  ...createEffectSlice(...a),
  ...createExportSlice(...a),
}));

// Re-export constants that might be used by components if needed, 
// though they should ideally come from @/config/constants
export { DEFAULT_ZOOM_ANCHOR } from "@/config/constants";
export { buildExportRequest } from "./slices/exportSlice";
