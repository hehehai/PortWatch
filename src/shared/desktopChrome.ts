export const PORTWATCH_HEADER_HEIGHT_PX = 46
export const MAC_TRAFFIC_LIGHT_INSET_X_PX = 22
export const MAC_TRAFFIC_LIGHT_INSET_Y_PX = 27
export const MAC_TRAFFIC_LIGHT_GUTTER_PX = 86

export function getMacTrafficLightPosition(): { x: number; y: number } {
  return {
    x: MAC_TRAFFIC_LIGHT_INSET_X_PX,
    y: MAC_TRAFFIC_LIGHT_INSET_Y_PX,
  }
}
