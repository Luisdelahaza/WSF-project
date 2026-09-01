/**
 * Shared color constants used across the export pipeline (GIF/video
 * encoding) so every module that needs to match the canvas backdrop
 * imports the same value instead of redefining it locally.
 */
export const BACKDROP = "#1a1a2e";