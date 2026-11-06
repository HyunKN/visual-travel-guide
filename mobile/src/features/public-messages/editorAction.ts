import type {Draft} from '../local-notes/store';
import {validateBody} from '../place-messages/contract';
import type {PublicationJob} from './publication';
/** Resolving an earlier request never depends on edits made after its consent. */
export function editorAction(draft:Draft,job:PublicationJob|null,configured:boolean,loaded:boolean) {
  const pending=job?.state==='pending'||job?.state==='uncertain';
  const conflict=job?.state==='conflict';
  const operation=conflict?'inspect':pending?'reconcile':draft.visibility==='public'?'publish':'private';
  const canDiscard=!job || job.state==='withdrawn'||(job.state==='rejected'&&job.serverVersion===null);
  return {
    operation,
    label:conflict?'서버 상태 확인':pending?(job.payload.p_withdraw?'철회 결과 확인':'공개 결과 확인'):
      draft.visibility==='public'?(job?.serverVersion?'공개 글에 반영':'공개하기'):'저장',
    disabled:!loaded || (conflict||pending?!configured:!!validateBody(draft.body)||draft.visibility===null||
      (draft.visibility==='public'&&!configured)||(draft.visibility==='private'&&!canDiscard)),
    canWithdraw:loaded && configured && !!job?.serverVersion && (job.state==='published'||job.state==='rejected'),
    canDiscard:loaded && canDiscard,
  };
}
