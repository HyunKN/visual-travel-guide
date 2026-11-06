import { Text as NativeText, type TextProps } from 'react-native';
export function Text({style,...props}:TextProps) {
  return <NativeText {...props} style={[{fontFamily:'SpoqaHanSans'},style]} />;
}
