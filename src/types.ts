import * as Y from "yjs";

export interface SelectionRange {
  id: string;
  anchor: Y.RelativePosition;
  focus: Y.RelativePosition; // only show anchor for now.
}

export interface UserInfo {
  id: number;
  color: string;
  cursor?: SelectionRange;
  current: boolean;
}
