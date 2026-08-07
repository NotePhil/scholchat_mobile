// Standard RN/Metro asset-import shims. These were missing project-wide
// (pre-dates this change), which made `tsc --noEmit` fail on every screen
// that imports a .png/.jpg/.jpeg asset.
declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}
