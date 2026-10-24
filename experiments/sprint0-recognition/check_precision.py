"""Post-result diagnosis: same inputs, FP32 versus INT8, no threshold tuning."""
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort

from prepare import CACHE, HERE, MODEL_REPO, REVISION, ROOT, code_fingerprints, digest, fetch
from run import prepare, unit


def main():
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))
    config=json.loads((CACHE/'model/preprocessor_config.json').read_text())
    for entry in manifest['images'] + list(manifest['model']['files'].values()):
        if digest(ROOT/entry['file']) != entry['sha256']:
            raise ValueError('Input changed: '+entry['file'])
    url=f'https://huggingface.co/{MODEL_REPO}/resolve/{REVISION}/onnx/vision_model.onnx'
    path=fetch(url,CACHE/'model/vision_model.onnx')
    options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
    sets={};load={}
    for kind,filename in [('fp32',path),('int8',CACHE/'model/vision_model_quantized.onnx')]:
        t=time.perf_counter()
        session=ort.InferenceSession(str(filename),sess_options=options,providers=['CPUExecutionProvider'])
        load[kind]=(time.perf_counter()-t)*1000
        vectors=[]
        for entry in manifest['images']:
            tensor,_=prepare(ROOT/entry['file'],config)
            vectors.append(unit(session.run(['image_embeds'],{'pixel_values':tensor})[0].reshape(-1)))
        sets[kind]=np.array(vectors)
        del session
    refs=[i for i,e in enumerate(manifest['images']) if e['role']=='reference']
    probes=[i for i,e in enumerate(manifest['images']) if e['role']=='probe']
    predictions={};summary={}
    for kind,features in sets.items():
        scores=features@features[refs].T
        predictions[kind]=[]
        for i in probes:
            labels=[manifest['images'][refs[j]]['label'] for j in np.argsort(-scores[i])]
            predictions[kind].append({'id':manifest['images'][i]['id'],'truth':manifest['images'][i]['label'],'ranking':labels})
        summary[kind]={'n':len(probes),'top1_hits':sum(r['truth']==r['ranking'][0] for r in predictions[kind]),'top3_hits':sum(r['truth'] in r['ranking'][:3] for r in predictions[kind])}
    similarities=np.sum(sets['fp32']*sets['int8'],axis=1)
    tensor,_=prepare(ROOT/manifest['images'][refs[0]]['file'],config)
    tensor.astype('<f4').tofile(CACHE/'browser-input.f32')
    (CACHE/'browser-expected.json').write_text(json.dumps({'id':manifest['images'][refs[0]]['id'],'embedding':sets['int8'][refs[0]].tolist()}))
    result={'diagnostic':'post-INT8-result precision comparison, not a new held-out evaluation',
            'code_sha256':code_fingerprints('check_precision.py','run.py','prepare.py'),
            'model_fp32':{'url':url,'sha256':digest(path),'bytes':path.stat().st_size},
            'manifest_sha256':digest(HERE/'manifest.json'),
            'summary':summary,'paired_feature_cosine_min':float(similarities.min()),
            'paired_feature_cosine_mean':float(similarities.mean()),
            'top1_agreement_count':sum(a['ranking'][0]==b['ranking'][0] for a,b in zip(predictions['fp32'],predictions['int8'])),
            'session_load_ms':load,'predictions':predictions}
    (HERE/'precision-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='predictions'},indent=2))


if __name__=='__main__':
    main()
