export const ANIMATION_CONFIG = {
  enabled: true,
  frameRate: 60, // fps
  interpolationMethod: 'route-based', // or 'linear' for fallback
  maxInterpolationTime: 30000, // ms - stop interpolating after 30s without updates
  bearingSmoothing: true,
  easingFunction: 'linear' // could add 'ease-in-out' later
};