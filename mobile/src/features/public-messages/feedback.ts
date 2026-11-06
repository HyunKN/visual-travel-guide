import type { RateLimitInfo } from './publication';

export function rateLimitText(info:RateLimitInfo,action:'공개'|'신고'):string {
  const prefix=`${action} 요청이 많아요.`;
  if(info.retryAt) {
    try {
      const when=new Date(info.retryAt).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
      if(Number.isFinite(Date.parse(info.retryAt)))return `${prefix} ${when}부터 다시 시도해주세요.`;
    } catch { /* A missing locale formatter does not block draft recovery. */ }
  }
  return `${prefix} 잠시 후 다시 시도해주세요.`;
}
