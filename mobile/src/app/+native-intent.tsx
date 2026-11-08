import {redirectAuthCallback} from '../features/auth/callbackRouting';
/** Keep authorization codes and tokens out of Router params/history. WebBrowser
 * receives the original OS URL independently; this route is a status surface only. */
export function redirectSystemPath({path,initial}:{path:string;initial:boolean}){
  return redirectAuthCallback(path,initial);
}
