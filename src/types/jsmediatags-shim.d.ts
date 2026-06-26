// why: jsmediatags' bare specifier fails Vite resolution (its package.json
//      browser field points to a non-existent dist/jsmediatags.js). We import
//      the UMD bundle by explicit path; this shim re-exports the bare-package
//      types so the deep path stays typed.
declare module 'jsmediatags/dist/jsmediatags.min.js' {
  import jsmediatags from 'jsmediatags';
  export default jsmediatags;
}
