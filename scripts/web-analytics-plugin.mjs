// Install the shared analytics loader in every Vite HTML entry point.
export function webAnalyticsPlugin() {
  return {
    name: 'linkedin-beats-web-analytics',
    apply: 'build',
    transformIndexHtml() {
      return [{tag:'script', attrs:{defer:true, src:'/analytics.js?v=2'}, injectTo:'body'}];
    },
  };
}
