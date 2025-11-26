export const templates = ["core", "react", "solid"] as const;

export type Template = (typeof templates)[number];
