import type { CSSProperties } from "react";

const paths = {
  search: "M11 4a7 7 0 1 0 4.42 12.43l3.58 3.57 1.4-1.4-3.57-3.58A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
  menu: "M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z",
  chevronRight: "m10 7 5 5-5 5-1.4-1.4 3.6-3.6-3.6-3.6L10 7Z",
  chevronDown: "m7 10 5 5 5-5-1.4-1.4-3.6 3.6-3.6-3.6L7 10Z",
  home: "M5 11.5 12 6l7 5.5V20h-5v-5H10v5H5v-8.5Z",
  settings: "m12 8.5 3.5-2 1 1.7-2 3.5 2 3.5-1 1.8-3.5-2-3.5 2-1-1.8 2-3.5-2-3.5 1-1.7 3.5 2 3.5-2Z M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  document: "M7 4h7l4 4v12H7V4Zm7 1.5V9h3.5L14 5.5Z",
  collection: "M4 6h7v5H4V6Zm9 0h7v5h-7V6ZM4 13h7v5H4v-5Zm9 0h7v5h-7v-5Z",
  lock: "M8 10V8a4 4 0 0 1 8 0v2h1a1 1 0 0 1 1 1v7H6v-7a1 1 0 0 1 1-1h1Zm2 0h4V8a2 2 0 1 0-4 0v2Z",
  globe: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm5.74 7h-3.1a13 13 0 0 0-1.12-4A6.02 6.02 0 0 1 17.74 11Zm-5.74 7c-.77 0-1.83-1.53-2.2-5h4.4c-.37 3.47-1.43 5-2.2 5Zm-2.2-7c.37-3.47 1.43-5 2.2-5s1.83 1.53 2.2 5H9.8Zm-3.32 0h-3.1a6.02 6.02 0 0 1 4.22-4 13 13 0 0 0-1.12 4Zm-3.1 2h3.1a13 13 0 0 0 1.12 4 6.02 6.02 0 0 1-4.22-4Zm10.14 4a13 13 0 0 0 1.12-4h3.1a6.02 6.02 0 0 1-4.22 4Z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z",
  copy: "M9 9h10v11H9V9Zm-4-5h10v3H7v9H5V4Z",
  external: "M14 5h5v5h-2V8.4l-6.3 6.3-1.4-1.4L15.6 7H14V5Z M6 7h5v2H8v7h7v-3h2v5H6V7Z",
  spark: "m12 4 1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4Z"
} as const;

export function Icon({
  name,
  className,
  style
}: {
  name: keyof typeof paths;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
    >
      <path d={paths[name]} />
    </svg>
  );
}

