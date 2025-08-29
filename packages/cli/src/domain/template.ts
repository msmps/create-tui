export const templates = ["core", "react", "solid", "vue"] as const;

export type Template = (typeof templates)[number];
