"""Offline Chinese-English translation of imported EPUB reading blocks."""
import pathlib,sys,os,tempfile,zipfile,json,hashlib,re,time
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'work/python'))
from bs4 import BeautifulSoup
import sentencepiece as spm
import ctranslate2
OUT=ROOT/'work/private-reading';WORK=ROOT/'work/bilingual'
model_dir=pathlib.Path(tempfile.gettempdir())/'codex-zh-en-reading-model'
if not model_dir.exists():
    with zipfile.ZipFile(WORK/'zh-en.argosmodel') as z:z.extractall(model_dir)
model=next(model_dir.iterdir())
tokenizer=spm.SentencePieceProcessor(model_proto=(model/'sentencepiece.model').read_bytes())
translator=ctranslate2.Translator(str(model/'model'),device='cpu',compute_type='int8',inter_threads=1,intra_threads=min(8,os.cpu_count() or 4))
cache_path=WORK/'private-zh-en-cache.json'
cache=json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
def write(path,data):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');temp.replace(path)
def digest(t):return hashlib.sha256(t.encode()).hexdigest()
def translate(texts):
    inputs=[];owners=[];outputs=[[] for _ in texts]
    for i,text in enumerate(texts):
        for sentence in re.split(r'(?<=[。！？!?；;])',text):
            if not sentence.strip():continue
            tokens=tokenizer.encode(sentence,out_type=str)
            for start in range(0,len(tokens),160):inputs.append(tokens[start:start+160]);owners.append(i)
    for start in range(0,len(inputs),48):
        results=translator.translate_batch(inputs[start:start+48],beam_size=2,max_decoding_length=400,max_input_length=192)
        for owner,result in zip(owners[start:start+48],results):outputs[owner].append(tokenizer.decode(result.hypotheses[0]))
    return [' '.join(parts).replace('▁',' ').strip() for parts in outputs]
started=time.time();total=0
for name in ('nvc','psychology'):
    book=json.loads((OUT/f'{name}.json').read_text(encoding='utf-8'))
    for index,chapter in enumerate(book['chapters']):
        html=json.loads((OUT/chapter['file']).read_text(encoding='utf-8'))['html'];soup=BeautifulSoup(html,'html.parser')
        blocks=[e for e in soup.find_all(['p','li','td','h2','h3']) if not e.find_parent(['p','li','td','h2','h3'])]
        blocks+=soup.find_all('figcaption');texts=[e.get_text() for e in blocks]
        unknown=list(dict.fromkeys(t for t in texts if re.search(r'[\u4e00-\u9fff]',t) and digest(t) not in cache))
        for start in range(0,len(unknown),24):
            batch=unknown[start:start+24]
            for text,result in zip(batch,translate(batch)):
                if not result.strip():raise RuntimeError('Empty translation')
                cache[digest(text)]=result
            write(cache_path,cache)
            print(name,index+1,min(start+24,len(unknown)),'/',len(unknown),'elapsed',round(time.time()-started),flush=True)
        normal_count=len(blocks)-len(soup.find_all('figcaption'))
        paragraphs={(f'p{i}' if i<normal_count else f'c{i-normal_count}'):{'original':t,'sourceHash':digest(t),'en':cache.get(digest(t),t) if re.search(r'[\u4e00-\u9fff]',t) else t} for i,t in enumerate(texts)}
        write(OUT/f'{name}-zh-{index}.json',{'version':1,'paragraphs':paragraphs})
        total+=len(texts)
        write(OUT/'translation-progress.json',{'book':name,'chapter':index+1,'chapters':len(book['chapters']),'blocks':total,'elapsedSeconds':round(time.time()-started)})
        print('CHAPTER COMPLETE',name,index+1,'/',len(book['chapters']),flush=True)
common=set((WORK/'frequency.txt').read_text(encoding='utf-8').splitlines()[:3000]);ipa={}
for line in (WORK/'en_US.txt').read_text(encoding='utf-8').splitlines():
    if '\t' in line:
        word,pron=line.split('\t',1)
        if word.lower() not in common:ipa[word.lower()]=pron.split(',')[0].strip()
write(OUT/'private-pronunciations.json',{'words':ipa})
print('ALL COMPLETE',total,'blocks',flush=True)
