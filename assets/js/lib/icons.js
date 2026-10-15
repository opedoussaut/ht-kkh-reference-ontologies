// Line icons for industry segments (original drawings, 32×32 grid, stroke = currentColor).

const P = {
  car: '<path d="M4 19.5v-3.2c0-.9.6-1.7 1.5-1.9l3.3-.8 3.4-3.9c.6-.6 1.4-1 2.3-1h5.8c.9 0 1.7.4 2.2 1.1l2.9 3.8 2 .6c.9.3 1.5 1.1 1.5 2v3.3c0 .6-.4 1-1 1h-1.6"/><path d="M10.6 20.5h10.7"/><path d="M4.9 20.5H6"/><circle cx="8.3" cy="20.5" r="2.4"/><circle cx="23.6" cy="20.5" r="2.4"/><path d="M11.4 13.6h14.1M17 9.6v4"/>',
  plane: '<path d="M3 17.2 13.6 15l4.8-8.6c.3-.5.9-.6 1.3-.2l.4.4c.3.3.4.7.2 1.1L18 14.4l7.6-1.6c1.8-.4 3.4.9 3.4 2.6 0 0-.3.9-1.8 1.3L18 19l2.2 6.5c.1.4 0 .8-.3 1l-.5.4c-.4.3-1 .2-1.3-.2L13.8 20 3 18.6Z"/><path d="m6 17-1.8-4.2c-.1-.3.1-.6.4-.6h.9c.2 0 .4.1.5.3L8.6 16"/>',
  ship: '<path d="M3 20.5h26l-2.6 4.6c-.4.6-1 1-1.8 1H8.5c-.8 0-1.5-.4-1.8-1Z"/><path d="M6.5 20.5 8 15.5h15.5l2 5"/><path d="M10.5 15.5 12 11h8l1.4 4.5"/><path d="M15.5 11V5.5M15.5 7.5h4"/><path d="M11.5 18h1.5M15 18h1.5M18.5 18H20"/>',
  robot: '<path d="M5 27h12"/><path d="M7.5 27v-3.5h7V27"/><circle cx="11" cy="20.5" r="2.4"/><path d="m12.4 18.6 4.6-7.4"/><circle cx="18" cy="9.5" r="2.2"/><path d="m20 10.5 5.2 3.2"/><path d="m24.7 12.3 2.6-1.6M25.8 14.6l2.7.2"/>',
  tablet: '<rect x="8" y="3.5" width="16" height="25" rx="2.4" transform="rotate(-12 16 16)"/><path d="m11.4 9.8 9.5-2M13.5 25.4l2.6-.6"/><path d="m11.7 13.4 3-.6.6 3-3 .6Zm4.8-1 3-.6.6 3-3 .6Zm-4 4.9 3-.6.6 3-3 .6Zm4.9-1 2.9-.6.6 3-2.9.6Z"/>',
  sofa: '<path d="M7 17v-4.5C7 9.5 8.8 8 11 8h10c2.2 0 4 1.5 4 4.5V17"/><path d="M4 16.5c0-1.4 1.1-2.5 2.5-2.5S9 15.1 9 16.5V19h14v-2.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5V22c0 1-.8 1.8-1.8 1.8H5.8C4.8 23.8 4 23 4 22Z"/><path d="M9 19v4.8M23 19v4.8M6.5 23.8 6 27M25.5 23.8 26 27"/>',
  bag: '<path d="M7 11h18l-1.4 15.2c-.1 1-1 1.8-2 1.8H10.4c-1 0-1.9-.8-2-1.8Z"/><path d="M12 13V9.5a4 4 0 0 1 8 0V13"/><path d="M12.5 18.5h7M13.5 22h5"/>',
  person: '<circle cx="16" cy="5.8" r="2.6"/><path d="M12.6 10.5c-1.6.4-2.6 1.9-2.6 3.5v5.5h2.2L13 28h2.5l.5-7.5.5 7.5H19l.8-8.5H22V14c0-1.6-1-3.1-2.6-3.5Z"/><path d="M10 13 5.5 17.5M22 13l4.5 4.5"/>',
  turbine: '<path d="M16 13v15M13.5 28h5"/><circle cx="16" cy="11" r="1.6"/><path d="M15.4 9.5 14.4 2.5c-.1-.6.7-.9 1-.4l2 7.2"/><path d="m17.5 11.6 6.4 3c.5.3.3 1.1-.3 1.1l-7.3-1.4"/><path d="m14.5 11.8-5.6 4.4c-.5.4-1.2-.2-.8-.8l5.1-5.4"/>',
  crane: '<path d="M8 28V6M12 28V6M8 6h4M8 10l4 4M12 10l-4 4M8 18l4 4M12 18l-4 4"/><path d="M5 6h24M12 6l4-3.5L20 6M24 6v6"/><path d="M22.5 12h3v2.5h-3z"/><path d="M15 28V18h11v10M15 22h11M18.5 18v10M22.5 18v10M4 28h24"/>',
  chart: '<rect x="4" y="4" width="24" height="24" rx="2.5"/><path d="M4 11h24M4 18h24M11 4v24M18 4v24"/><path d="m6 24 6-6 5 3 9-11"/><path d="M22.5 9.5H26V13"/>',
  city: '<path d="M4 28h24"/><path d="M6 28V15h6v13M18 28V6.5c0-.6.6-1 1.1-.8L26 8.5V28"/><path d="M12 28V10l6-3"/><path d="M8 18h2M8 22h2M14 13h2M14 17h2M14 21h2M21 11h2M21 15h2M21 19h2M21 23h2"/>',
  network: '<circle cx="16" cy="6" r="2.6"/><circle cx="6.5" cy="23" r="2.6"/><circle cx="25.5" cy="23" r="2.6"/><circle cx="16" cy="17" r="2.2"/><path d="M14.7 8.3 7.8 20.7M17.3 8.3l6.9 12.4M9.1 23h13.8M16 8.6v6.2M14.2 18.2 8.8 21.6M17.8 18.2l5.4 3.4"/>',
};

export function icon(name, cls = 'ind-icon') {
  const body = P[name] || P.network;
  return `<svg class="${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
