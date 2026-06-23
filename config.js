// Public Wavelet runtime config. These values are PUBLIC by design: the Supabase
// publishable (anon) key only permits the SECURITY DEFINER RPCs, which authorise via the
// codes passed as arguments (see design_docs/PROJECT_STORAGE_V2.md §12.5/§12.6). Never put
// the service-role key, DB password, or pepper here.
//
// Single project for now ("prod for the current cohort"); a dev/prod split is P2 (§13).

const WaveletConfig = {
  supabaseUrl: 'https://rphrxfyhlgacyellhcrw.supabase.co',
  supabasePublishableKey: 'sb_publishable_5WpjivY8tRSvETZMypTFMw_uw8t12E5',

  // Project page storage mode. false keeps the existing File System Access Open/Save flow.
  // true switches the project page to code-login + server autosave (Project Storage v2).
  // ON for the cohort migration. Per-visit escape hatch back to the file flow: ?storage=file.
  serverStorage: true,

  // Migration affordance (Project Storage v2 §6, step 6): in server mode, show an
  // "Import old file" button so the current cohort can bring their existing OneDrive .py
  // into the server (parsed + saved as their first server version). Turn off once the
  // cohort has migrated, since new students start fresh.
  importFromFile: true
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WaveletConfig;
}
if (typeof window !== 'undefined') {
  window.WaveletConfig = WaveletConfig;
}
