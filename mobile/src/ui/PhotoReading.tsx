import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Action } from './Action';
import { Text } from './Text';

/** Reading ink only: leave the empty space and lens rim transparent. */
export const photoReadingSurface = 'rgba(255,255,255,.64)';
export function PhotoReadingText({style,...props}:ComponentProps<typeof Text>) {
  return <Text {...props} style={[s.reading,style]}/>;
}
export function PhotoReadingAction({style,variant,selected,...props}:ComponentProps<typeof Action>) {
  const opaque=variant==='primary'||variant==='soft'||selected;
  return <Action {...props} variant={variant} selected={selected} style={[!opaque&&s.reading,variant==='danger'&&s.danger,style]}/>;
}
const s=StyleSheet.create({reading:{backgroundColor:photoReadingSurface,borderRadius:8},danger:{backgroundColor:'#FFFFFF'}});
