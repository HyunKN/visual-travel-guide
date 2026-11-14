import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Action } from './Action';
import { Text } from './Text';

/** Apply once to the continuous content surface; keep its lens rim exposed. */
export const photoReadingSurface = 'rgba(255,255,255,.64)';
export function PhotoReadingText(props:ComponentProps<typeof Text>) {
  return <Text {...props}/>;
}
export function PhotoReadingAction({style,textStyle,variant,selected,...props}:ComponentProps<typeof Action>) {
  const disabledPrimary=variant==='primary'&&(props.disabled||props.busy);
  return <Action {...props} variant={variant} selected={selected}
    style={[variant==='danger'&&s.danger,disabledPrimary&&s.disabledPrimary,style]}
    textStyle={[disabledPrimary&&s.disabledLabel,textStyle]}/>;
}
const s=StyleSheet.create({
  disabledPrimary:{backgroundColor:'#EAEAE7',opacity:1},
  disabledLabel:{color:'#555555'},danger:{backgroundColor:'#FFFFFF'},
});
