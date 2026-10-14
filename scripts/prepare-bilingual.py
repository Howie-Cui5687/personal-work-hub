"""Prepare local English-Chinese paragraph translations and IPA annotations."""
import pathlib, sys, urllib.request, json, zipfile, time, re, hashlib, os, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'work/python'))
from bs4 import BeautifulSoup
import sentencepiece as spm
import ctranslate2
WORK=ROOT/'work/bilingual';WORK.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'public/reading'
def write_json(path,data):
    temporary=path.with_name(path.name+'.tmp')
    temporary.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
    temporary.replace(path)
def download(url,path):
    if path.exists() and path.stat().st_size>0:return
    print('Downloading',path.name,flush=True)
    try:
        urllib.request.urlretrieve(url,path)
    except Exception:
        if path.name!='en-zh.argosmodel':raise
        urllib.request.urlretrieve('https://huggingface.co/shethjenil/argostranslate/resolve/main/translate-en_zh.argosmodel?download=true',path)

download('https://argos-net.com/v1/translate-en_zh-1_9.argosmodel',WORK/'en-zh.argosmodel')
model_hash=hashlib.sha256((WORK/'en-zh.argosmodel').read_bytes()).hexdigest()
if model_hash!='433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab':
    raise RuntimeError('Translation model checksum mismatch; retain the downloaded file for inspection.')
model_directory=pathlib.Path(tempfile.gettempdir())/'codex-economics-translation-model'
if not model_directory.exists():
    with zipfile.ZipFile(WORK/'en-zh.argosmodel') as z:z.extractall(model_directory)
model_root=next(model_directory.iterdir())
print('Model files:',[p.name for p in model_root.iterdir()],flush=True)
tokenizer=spm.SentencePieceProcessor(model_proto=(model_root/'sentencepiece.model').read_bytes())
translator=ctranslate2.Translator(str(model_root/'model'),device='cpu',compute_type='int8',inter_threads=1,intra_threads=max(2,min(8,os.cpu_count() or 4)))
download('https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt',WORK/'en_US.txt')
download('https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt',WORK/'frequency.txt')
download('https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/LICENSE',OUT/'IPA-LICENSE.txt')
common=set((WORK/'frequency.txt').read_text(encoding='utf-8').splitlines()[:3000])
dictionary={}
for line in (WORK/'en_US.txt').read_text(encoding='utf-8').splitlines():
    if '\t' in line:
        word,ipa=line.split('\t',1);dictionary[word.lower()]=ipa.split(',')[0].strip()
books={name:json.loads((OUT/(name+'.json')).read_text(encoding='utf-8')) for name in ('wealth','economics')}
def blocks(source):
    soup=BeautifulSoup(source,'html.parser')
    return [el for el in soup.find_all(['p','li','td','h2','h3']) if not el.find_parent(['p','li','td','h2','h3'])]
def captions(source):
    soup=BeautifulSoup(source,'html.parser')
    return soup.find_all('figcaption')
words=set()
for name,book in books.items():
    for chapter in book['chapters']:
        source=chapter.get('html') or json.loads((OUT/chapter['file']).read_text(encoding='utf-8'))['html']
        for el in [*blocks(source),*captions(source)]:words.update(w.lower() for w in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?",el.get_text()))
ipa={word:dictionary[word] for word in sorted(words) if word not in common and word in dictionary}
(OUT/'pronunciations.json').write_text(json.dumps({'accent':'美式音标','frequencyThreshold':3000,'source':'https://github.com/open-dict-data/ipa-dict','words':ipa},ensure_ascii=False),encoding='utf-8')
print('IPA ready:',len(ipa),'less-common words',flush=True)
cache_file=WORK/'translation-cache.json'
cache=json.loads(cache_file.read_text(encoding='utf-8')) if cache_file.exists() else {}
def digest(text):return hashlib.sha256(text.encode()).hexdigest()
def sentences(text):
    # SentencePiece input fits the model context; split long paragraphs at sentence boundaries.
    pieces=re.split(r'(?<=[.!?])\s+(?=[A-Z0-9“"(])',text)
    result=[]
    for piece in pieces:
        tokens=tokenizer.encode(piece,out_type=str)
        if len(tokens)<=220:result.append(tokens)
        else:
            # Split at clauses where possible, then at word boundaries as a final fallback.
            clauses=re.split(r'(?<=[,;:])\s+',piece);current=[]
            for clause in clauses:
                t=tokenizer.encode(clause,out_type=str)
                if len(current)+len(t)>220 and current:result.append(current);current=[]
                if len(t)>220:
                    if current:result.append(current);current=[]
                    result.extend(t[i:i+200] for i in range(0,len(t),200))
                else:current.extend(t)
            if current:result.append(current)
    return [tokens for tokens in result if tokens]
def translate_texts(texts):
    pending=[];owners=[];outputs=[[] for _ in texts]
    for i,t in enumerate(texts):
        for tokens in sentences(t):pending.append(tokens);owners.append(i)
    for start in range(0,len(pending),32):
        result=translator.translate_batch(pending[start:start+32],beam_size=2,max_decoding_length=384,max_input_length=256)
        for owner,res in zip(owners[start:start+32],result):outputs[owner].append(tokenizer.decode(res.hypotheses[0]))
    return [''.join(parts).replace('▁',' ').strip() for parts in outputs]
start=time.time();count=0
# Current preview chapter comes first, so the user can inspect it while processing the rest.
jobs=[('economics',2)]+[('economics',i) for i in range(len(books['economics']['chapters'])) if i!=2]+[('wealth',i) for i in range(len(books['wealth']['chapters']))]
for name,index in jobs:
    chapter=books[name]['chapters'][index]
    source=chapter.get('html') or json.loads((OUT/chapter['file']).read_text(encoding='utf-8'))['html']
    base=blocks(source)
    paragraph_keys=[f'p{i}' for i in range(len(base))]+[f'c{i}' for i in range(len(captions(source)))]
    paragraphs=[el.get_text() for el in [*base,*captions(source)]]
    unknown=list(dict.fromkeys(t for t in paragraphs if t.strip() and digest(t) not in cache))
    for batch_start in range(0,len(unknown),24):
        subset=unknown[batch_start:batch_start+24]
        translated=translate_texts(subset)
        for original,result in zip(subset,translated):cache[digest(original)]=result
        write_json(cache_file,cache)
        print(name,index+1,'paragraphs',min(batch_start+24,len(unknown)),'/',len(unknown),'elapsed',round(time.time()-start),'s',flush=True)
    data={'version':1,'engine':'Argos Translate en-zh 1.9 · 本地机器翻译','source':'https://github.com/argosopentech/argos-translate','chapter':index,'paragraphs':{key:{'sourceHash':digest(t),'original':t,'zh':cache.get(digest(t),'').replace('▁',' ').strip()} for key,t in zip(paragraph_keys,paragraphs)}}
    write_json(OUT/(name+'-zh-'+str(index)+'.json'),data)
    count+=1
    write_json(OUT/'bilingual-status.json',{'completed':count,'total':len(jobs),'lastBook':name,'lastChapter':index,'elapsedSeconds':round(time.time()-start)})
    print('CHAPTER COMPLETE',name,index+1,count,'/',len(jobs),flush=True)
print('ALL TRANSLATIONS COMPLETE',flush=True)
