"""A smaller FP32 image encoder baseline, using the same frozen development probes."""
import json
import platform
import time
from datetime import datetime, timezone

import numpy as np
import onnx
import onnxruntime as ort
from onnx import numpy_helper

from prepare import CACHE, HERE, ROOT, code_fingerprints, digest, fetch
from run import prepare, unit

REVISION='c5cae0f1942c8d7727372c7b1f6b485aa39e4421'
URL=f'https://media.githubusercontent.com/media/onnx/models/{REVISION}/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx'
CONFIG={'size':{'shortest_edge':256},'crop_size':{'width':224,'height':224},'resample':'bilinear','round_resize':True,
        'rescale_factor':1/255,'image_mean':[0.485,0.456,0.406],'image_std':[0.229,0.224,0.225]}


def main():
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))
    for entry in manifest['images']:
        if digest(ROOT/entry['file']) != entry['sha256']:
            raise ValueError('Input changed: '+entry['file'])
    original=fetch(URL,CACHE/'model/mobilenetv2-12.onnx')
    expected_hash='c0c3f76d93fa3fd6580652a45618618a220fced18babf65774ed169de0432ad5'
    if digest(original)!=expected_hash:
        raise ValueError('MobileNet source hash changed')
    derived=CACHE/'model/mobilenetv2-12-features.onnx'
    # Source graph leaves dynamic reshape output dimensions unspecified; restore
    # the known classifier-input width before checking the derived feature graph.
    onnx.utils.extract_model(str(original),str(derived),['input'],['472'],check_model=False)
    derived_graph=onnx.load(str(derived))
    del derived_graph.graph.output[:]
    derived_graph.graph.output.append(onnx.helper.make_tensor_value_info('472',onnx.TensorProto.FLOAT,['batch_size',1280]))
    onnx.checker.check_model(derived_graph)
    onnx.save(derived_graph,str(derived))
    options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
    start=time.perf_counter()
    session=ort.InferenceSession(str(derived),sess_options=options,providers=['CPUExecutionProvider'])
    load_ms=(time.perf_counter()-start)*1000
    entries=manifest['images'];features=[];timings=[]
    # Check the extracted feature actually feeds the source classifier.
    tensor,_=prepare(ROOT/entries[0]['file'],CONFIG)
    feature=session.run(None,{'input':tensor})[0]
    graph=onnx.load(str(original));weights={i.name:numpy_helper.to_array(i) for i in graph.graph.initializer}
    reconstructed=feature@weights['classifier.1.weight'].T+weights['classifier.1.bias']
    original_session=ort.InferenceSession(str(original),sess_options=options,providers=['CPUExecutionProvider'])
    logits=original_session.run(None,{'input':tensor})[0]
    error=float(np.max(np.abs(reconstructed-logits)))
    if not np.allclose(reconstructed,logits,atol=1e-4,rtol=1e-4):
        raise ValueError(f'Feature extraction parity failure {error}')
    del original_session,graph,weights
    for item in entries:
        start=time.perf_counter();tensor,_=prepare(ROOT/item['file'],CONFIG);prepared=time.perf_counter()
        value=session.run(None,{'input':tensor})[0].reshape(-1);end=time.perf_counter()
        if value.shape!=(1280,):
            raise ValueError(f'Unexpected feature shape {value.shape}')
        features.append(unit(value));timings.append({'id':item['id'],'preprocessing_ms':(prepared-start)*1000,'inference_ms':(end-prepared)*1000})
    features=np.array(features)
    refs=[i for i,e in enumerate(entries) if e['role']=='reference']
    scores=features@features[refs].T
    if not all(np.argmax(scores[ri])==j for j,ri in enumerate(refs)):
        raise ValueError('Reference self-match failed')
    rows=[]
    for i,item in enumerate(entries):
        if i in refs:
            continue
        order=np.argsort(-scores[i]);ranking=[{'label':entries[refs[j]]['label'],'similarity':float(scores[i,j])} for j in order]
        rows.append({'id':item['id'],'truth':item['label'],'role':item['role'],'lighting':item['lighting'],
                     'top1_correct':ranking[0]['label']==item['label'] if item['label'] else None,
                     'top3_correct':item['label'] in [r['label'] for r in ranking[:3]] if item['label'] else None,'ranking':ranking})
    subsets={'all':[r for r in rows if r['role']=='probe']}
    subsets.update({k:[r for r in subsets['all'] if r['lighting']==k] for k in ['day','night','ambiguous']})
    summary={k:{'n':len(v),'top1_hits':sum(r['top1_correct'] for r in v),'top3_hits':sum(r['top3_correct'] for r in v)} for k,v in subsets.items()}
    tensor,_=prepare(ROOT/entries[refs[0]]['file'],CONFIG);session.run(None,{'input':tensor})
    repeats=[]
    for _ in range(10):
        start=time.perf_counter();session.run(None,{'input':tensor});repeats.append((time.perf_counter()-start)*1000)
    result={'protocol_version':'1.2 exploratory follow-up','run_at_utc':datetime.now(timezone.utc).isoformat(),'manifest_sha256':digest(HERE/'manifest.json'),
            'code_sha256':code_fingerprints('compare_mobilenet.py','run.py','prepare.py'),
            'environment':{'python':platform.python_version(),'platform':platform.system(),'machine':platform.machine(),'processor':platform.processor(),
                           'onnxruntime':ort.__version__,'numpy':np.__version__,'providers':session.get_providers(),'intra_op_threads':2,'inter_op_threads':1},
            'model':{'repository':'onnx/models','revision':REVISION,'url':URL,'source_sha256':digest(original),'source_bytes':original.stat().st_size,
                     'derived_sha256':digest(derived),'derived_bytes':derived.stat().st_size,'feature_output':'472','feature_dimensions':1280,
                     'onnx':onnx.__version__,'license':'Apache-2.0 per pinned Model Zoo README'},
            'preprocessing':{**CONFIG,'interpolation':'Pillow BILINEAR','crop':'center; pinned Model Zoo imagenet_preprocess.py geometry/mean/std'},
            'classifier_reconstruction_max_abs_error':error,'summary':summary,'predictions':rows,
            'session_load_ms':load_ms,'warm_inference_10_ms':repeats,'warm_median_ms':float(np.median(repeats)),'timings':timings,
            'limitations':['Development photos; same collection and references as prior CLIP run, not a holdout.',
                           'Only a fixed pretrained feature retrieval baseline; no training or calibrated rejection.',
                           'Python CPU only; not browser/Android performance.']}
    (HERE/'mobilenet-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:result[k] for k in ['summary','model','classifier_reconstruction_max_abs_error','warm_median_ms']},indent=2))


if __name__=='__main__':
    main()
