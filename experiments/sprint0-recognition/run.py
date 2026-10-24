"""Frozen CLIP image retrieval versus a colour-only baseline on development probes."""
import hashlib
import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import onnxruntime as ort
import PIL
from PIL import Image, ImageOps
from prepare import code_fingerprints

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def unit(value):
    length = np.linalg.norm(value)
    if not np.isfinite(value).all() or length <= 0:
        raise ValueError('Non-finite or zero feature')
    return value / length


def prepare(path, config):
    with Image.open(path) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        rgb = np.asarray(image.resize((128,128), Image.Resampling.BILINEAR))
        histogram = unit(np.concatenate([np.histogram(rgb[:,:,i], bins=8, range=(0,256))[0] for i in range(3)]).astype(np.float32))
        w, h = image.size
        edge = config['size']['shortest_edge']
        dimension = round if config.get('round_resize') else int
        resample = Image.Resampling.BILINEAR if config.get('resample') == 'bilinear' else Image.Resampling.BICUBIC
        image = image.resize((edge, dimension(edge*h/w)) if w <= h else (dimension(edge*w/h),edge), resample)
        cw, ch = config['crop_size']['width'], config['crop_size']['height']
        left, top = (image.width-cw)//2, (image.height-ch)//2
        pixels = np.asarray(image.crop((left,top,left+cw,top+ch)), dtype=np.float32) * config['rescale_factor']
        pixels = (pixels - np.array(config['image_mean'],np.float32)) / np.array(config['image_std'],np.float32)
        return np.ascontiguousarray(pixels.transpose(2,0,1)[None]), histogram


def main():
    manifest_path = HERE / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for item in manifest['images'] + list(manifest['model']['files'].values()):
        with (ROOT / item['file']).open('rb') as handle:
            actual = hashlib.file_digest(handle,'sha256').hexdigest()
        if actual != item['sha256']:
            raise ValueError(f'Input hash mismatch: {item["file"]}')
    files = manifest['model']['files']
    config = json.loads((ROOT / files['preprocessor_config.json']['file']).read_text())
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    started = time.perf_counter()
    session = ort.InferenceSession(str(ROOT / files['onnx/vision_model_quantized.onnx']['file']), sess_options=options, providers=['CPUExecutionProvider'])
    loading_ms = (time.perf_counter()-started)*1000
    print('Inputs',[(v.name,v.shape,v.type) for v in session.get_inputs()],flush=True)
    print('Outputs',[(v.name,v.shape) for v in session.get_outputs()],flush=True)
    input_name = session.get_inputs()[0].name
    output_name = 'image_embeds'
    features, histogram_features, timings = [], [], []
    for item in manifest['images']:
        started = time.perf_counter()
        tensor, histogram = prepare(ROOT/item['file'], config)
        prepared = time.perf_counter()
        feature = session.run([output_name], {input_name:tensor})[0].reshape(-1)
        ended = time.perf_counter()
        if feature.shape != (512,):
            raise ValueError(f'Unexpected embedding shape {feature.shape}')
        features.append(unit(feature))
        histogram_features.append(histogram)
        timings.append({'id':item['id'], 'preprocessing_ms':(prepared-started)*1000, 'inference_ms':(ended-prepared)*1000})
    entries = manifest['images']
    refs = [i for i,e in enumerate(entries) if e['role']=='reference']
    if len(refs) != 6 or len({entries[i]['label'] for i in refs}) != 6:
        raise ValueError('Expected six distinct reference labels')
    feature_sets = {'clip_int8':np.array(features), 'rgb_histogram':np.array(histogram_features)}
    details, summaries = {}, {}
    for method, vectors in feature_sets.items():
        similarities = vectors @ vectors[refs].T
        if not all(np.argmax(similarities[ri])==j for j,ri in enumerate(refs)):
            raise ValueError(f'Self-match failure: {method}')
        rows=[]
        for i,item in enumerate(entries):
            if i in refs:
                continue
            order=np.argsort(-similarities[i])
            ranked=[{'label':entries[refs[j]]['label'],'similarity':float(similarities[i,j])} for j in order]
            rows.append({'id':item['id'],'truth':item['label'],'role':item['role'],'lighting':item['lighting'],
                         'top1_correct':ranked[0]['label']==item['label'] if item['label'] else None,
                         'top3_correct':item['label'] in [r['label'] for r in ranked[:3]] if item['label'] else None,
                         'top1_top2_margin':ranked[0]['similarity']-ranked[1]['similarity'],'ranking':ranked})
        details[method]=rows
        groups={'all':[r for r in rows if r['role']=='probe']}
        groups.update({lighting:[r for r in groups['all'] if r['lighting']==lighting] for lighting in ['day','night','ambiguous']})
        summaries[method]={k:{'n':len(v),'top1_hits':sum(r['top1_correct'] for r in v),'top3_hits':sum(r['top3_correct'] for r in v)} for k,v in groups.items()}
    tensor,_=prepare(ROOT/entries[refs[0]]['file'],config)
    session.run([output_name],{input_name:tensor})
    repeats=[]
    for _ in range(10):
        started=time.perf_counter(); session.run([output_name],{input_name:tensor})
        repeats.append((time.perf_counter()-started)*1000)
    result={'protocol_version':1,'run_at_utc':datetime.now(timezone.utc).isoformat(),
            'code_sha256':code_fingerprints('run.py','prepare.py'),
            'status':'development smoke only; no model training or Android validation',
            'manifest_sha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            'environment':{'python':platform.python_version(),'platform':platform.system(),'machine':platform.machine(),
                           'onnxruntime':ort.__version__,'numpy':np.__version__,'pillow':PIL.__version__,
                           'providers':session.get_providers(),'intra_op_threads':2,'inter_op_threads':1},
            'model_bytes':files['onnx/vision_model_quantized.onnx']['bytes'],'session_load_ms':loading_ms,
            'warm_inference_10_ms':repeats,'warm_median_ms':float(np.median(repeats)),
            'summary':summaries,'predictions':details,'timings':timings,
            'limitations':['Same institution collection; capture groups unknown; potential near duplicates.',
                           'No independent holdout or finetuning; reference retrieval only.',
                           'No calibrated rejection: out-of-scope inputs still receive a nearest candidate.',
                           'CPU measurements are not browser or Android performance.',
                           'No product/user-value comparison.']}
    (HERE/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'summary':summaries,'model_bytes':result['model_bytes'],'warm_median_ms':result['warm_median_ms']},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
