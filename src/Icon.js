import React from "react";

const paths = {
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  upload: "M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  download: "M12 4v12m-4-4 4 4 4-4M4 16v4h16v-4",
  image:
    "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 13 5-5 8 10m-4-5 4-4 5 5M16 7h.01",
  crop: "M6 3v15h15M3 6h15v15",
  sliders: "M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  sun: "M12 3V1m0 22v-2M3 12H1m22 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z",
  help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
  list: "M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01",
  rotate: "M3 9V3m0 0h6M3 3l4 4a8 8 0 1 1-2 9",
  flip: "M12 3v18M8 5 3 18h5Zm8 0 5 13h-5Z",
  lock: "M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4",
  unlock: "M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0",
  reset: "M3 10a9 9 0 1 1 2 8M3 10V4m0 6h6",
  chevron: "m8 10 4 4 4-4",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
  file: "M14 2H4v20h16V8Zm0 0v6h6",
  monitor: "M3 4h18v12H3ZM8 20h8m-4-4v4",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5",
};
export default function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={`${size / 16}rem`}
      height={`${size / 16}rem`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.image} />
    </svg>
  );
}
