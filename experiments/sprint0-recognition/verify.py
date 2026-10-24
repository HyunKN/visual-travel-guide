"""Validate experiment provenance and recompute summaries without rerunning models."""
import json
import math
from collections import Counter

from prepare import CACHE, HERE, ROOT, digest


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load(name):
    return json.loads((HERE/name).read_text(encoding='utf-8'))


def check_ranked(rows, entries, summary):
    expected={e['id']:e for e in entries if e['role']!='reference'}
    require(len(rows)==len(expected),'Prediction count mismatch')
    require(set(expected)=={r['id'] for r in rows},'Prediction identity mismatch')
    labels={e['label'] for e in entries if e['role']=='reference'}
    for row in rows:
        require(row['truth']==expected[row['id']]['label'],'Truth changed')
        ranking=row['ranking']
        require(len(ranking)==6 and {v['label'] for v in ranking}==labels,'Bad candidate set')
        require(all(math.isfinite(v['similarity']) for v in ranking),'Non-finite similarity')
        require(all(a['similarity']>=b['similarity'] for a,b in zip(ranking,ranking[1:])),'Unsorted ranking')
        if row['truth']:
            require(row['top1_correct']==(ranking[0]['label']==row['truth']),'Top-1 mismatch')
            require(row['top3_correct']==(row['truth'] in [v['label'] for v in ranking[:3]]),'Top-3 mismatch')
    for group,metrics in summary.items():
        chosen=[r for r in rows if r['role']=='probe' and (group=='all' or r['lighting']==group)]
        require(metrics=={'n':len(chosen),'top1_hits':sum(r['top1_correct'] for r in chosen),'top3_hits':sum(r['top3_correct'] for r in chosen)},'Aggregate mismatch')


def main():
    manifest=load('manifest.json');entries=manifest['images']
    require(Counter(e['role'] for e in entries)=={'reference':6,'probe':17,'out_of_scope':3},'Wrong split')
    require(len({e['id'] for e in entries})==26,'Duplicate ID')
    require(len({e['sha256'] for e in entries})==26,'Exact image duplicates')
    for item in entries+list(manifest['model']['files'].values()):
        require(digest(ROOT/item['file'])==item['sha256'],'Changed artifact '+item['file'])
    source_paths={CACHE/'sources'/f'{e["label"]}.html' for e in entries if e['label']}
    require(len(source_paths)==6 and all(p.exists() for p in source_paths),'Missing source snapshots')
    source_hashes={digest(p) for p in source_paths}
    for e in entries:
        require(all(e.get(k) for k in ['caption','credit','license','source_url','download_url','source_snapshot_sha256']),'Missing attribution')
        require(e['source_snapshot_sha256'] in source_hashes,'Changed source snapshot')
    baseline=load('results.json');precision=load('precision-comparison.json');mobile=load('mobilenet-results.json')
    manifest_hash=digest(HERE/'manifest.json')
    for result in [baseline,precision,mobile]:
        require(result['manifest_sha256']==manifest_hash,'Result belongs to another manifest')
        for filename,expected_hash in result['code_sha256'].items():
            require(digest(HERE/filename)==expected_hash,'Result belongs to another code version: '+filename)
    for method,rows in baseline['predictions'].items():
        check_ranked(rows,entries,baseline['summary'][method])
    check_ranked(mobile['predictions'],entries,mobile['summary'])
    require(digest(CACHE/'model/vision_model.onnx')==precision['model_fp32']['sha256'],'FP32 changed')
    require(digest(CACHE/'model/mobilenetv2-12.onnx')==mobile['model']['source_sha256'],'MobileNet source changed')
    require(digest(CACHE/'model/mobilenetv2-12-features.onnx')==mobile['model']['derived_sha256'],'MobileNet derived changed')
    require(mobile['classifier_reconstruction_max_abs_error']<1e-4,'Feature derivation failed')
    for kind,rows in precision['predictions'].items():
        require(len(rows)==17,'Precision probe count')
        require(precision['summary'][kind]=={'n':17,'top1_hits':sum(r['truth']==r['ranking'][0] for r in rows),'top3_hits':sum(r['truth'] in r['ranking'][:3] for r in rows)},'Precision aggregate mismatch')
    require(baseline['summary']['clip_int8']['all']==precision['summary']['int8'],'INT8 diagnostic drift')
    for result in [baseline,mobile]:
        repeats=result['warm_inference_10_ms']
        require(len(repeats)==10 and all(math.isfinite(v) and v>0 for v in repeats),'Invalid timing measurements')
    print('PASS: 26 image hashes and attribution, 6/17/3 split, model hashes, result provenance, all reported hit counts, feature extraction parity, timing counts')


if __name__=='__main__':
    main()
