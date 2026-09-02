/*
 * tailwind.config.js — IN TAILWIND v4 THIS FILE IS USUALLY NOT NEEDED.
 *
 * v4 configuration lives in CSS: tokens are defined via @theme (see theme.css),
 * custom utilities via @utility, and variants via @custom-variant.
 * Most projects don't need a JS config at all.
 *
 * A JS config is needed ONLY for dynamics that can't be expressed in static CSS:
 *   - token values computed in JS at build time;
 *   - ecosystem plugins shipped as JS functions;
 *   - programmatic generation of themes/safelists.
 *
 * If you really do need it — it is NOT picked up automatically. Reference it
 * from CSS with an explicit directive (for example, in entry.css):
 *   @config "./tailwind.config.js";
 *
 * Do NOT create or reference this file without need: an extra @config
 * pulls in the v3 compatibility layer and complicates the configuration. First try
 * @theme / @utility / @custom-variant in CSS.
 */

export default {};
