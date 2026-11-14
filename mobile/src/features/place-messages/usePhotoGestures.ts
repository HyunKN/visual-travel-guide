import { useRef } from 'react';
import type { GestureResponderEvent, ViewProps } from 'react-native';
import { pinchView, type PhotoView, type Point, type Rect, type Size } from './geometry';

function sample(e:GestureResponderEvent, origin:Point) {
  const touches=e.nativeEvent.touches;
  if(!touches.length)return null;
  const a=touches[0],b=touches[1]??a;
  return {point:{x:(a.pageX+b.pageX)/2-origin.x,y:(a.pageY+b.pageY)/2-origin.y},distance:Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY),count:touches.length};
}

/** Capture only a pinch or a drag. A normal tap still belongs to the marker/placement button. */
export function usePhotoGestures(base:Rect|null, rect:Rect|null, size:Size, origin:Point, enabled:boolean, onChange:(view:PhotoView)=>void):ViewProps {
  const first=useRef<Point|null>(null),gesture=useRef<{rect:Rect;point:Point;distance:number;count:number}|null>(null);
  return {
    onTouchStart:e=>{first.current=sample(e,origin)?.point??null;},
    onStartShouldSetResponderCapture:e=>enabled&&e.nativeEvent.touches.length>=2,
    onMoveShouldSetResponderCapture:e=>{const p=sample(e,origin),start=first.current;return !!(enabled&&p&&(p.count>=2||(start&&Math.hypot(p.point.x-start.x,p.point.y-start.y)>8)));},
    onResponderGrant:e=>{const p=sample(e,origin);gesture.current=p&&rect?{...p,rect}:null;},
    onResponderMove:e=>{
      const p=sample(e,origin),start=gesture.current;
      if(!enabled||!base||!rect||!p)return;
      if(!start||p.count!==start.count){gesture.current={...p,rect};return;}
      const ratio=start.distance>0&&p.count>=2?p.distance/start.distance:1;
      if(ratio>0)onChange(pinchView(base,size,start.rect,start.point,p.point,ratio));
    },
    onResponderRelease:()=>{gesture.current=null;first.current=null;},onResponderTerminate:()=>{gesture.current=null;first.current=null;},
  };
}
