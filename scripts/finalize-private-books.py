"""Clean known offline-model artifacts and familiar-word IPA inflections."""
import json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'work/private-reading'
corrections_path=OUT/'corrections.json'
corrections=json.loads(corrections_path.read_text(encoding='utf-8')) if corrections_path.exists() else {}
def write(path,data):
    temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');temporary.replace(path)
for path in OUT.glob('*-zh-*.json'):
    data=json.loads(path.read_text(encoding='utf-8'))
    for entry in data['paragraphs'].values():
        source=entry['original'];text=corrections.get(source,entry['en'])
        if not re.search(r'对不起|抱歉|不好意思|遗憾',source):
            text=re.sub(r"\s*I(?:'|’)m sorry\.?\s*",' ',text,flags=re.I)
        if '♪' not in source:text=text.replace('♪','')
        text=re.sub(r"\s+([,.;:!?])",r'\1',text)
        text=re.sub(r"\s*['’]\s+s\b","'s",text)
        text=re.sub(r'non[- ]violent communication','Nonviolent Communication',text,flags=re.I)
        text=re.sub(r'\s{2,}',' ',text).strip()
        entry['en']=text
    write(path,data)
common=set((ROOT/'work/bilingual/frequency.txt').read_text(encoding='utf-8').splitlines()[:3000])
def familiar(word):
    roots=[word,word.removesuffix("'s")]
    for ending in ('s','es','ed','ing','er','est'):
        if word.endswith(ending):
            base=word[:-len(ending)];roots.extend([base,base+'e'])
            if len(base)>2 and base[-1]==base[-2]:roots.append(base[:-1])
    if word.endswith('ies'):roots.append(word[:-3]+'y')
    return any(root in common for root in roots)
path=OUT/'private-pronunciations.json';data=json.loads(path.read_text(encoding='utf-8'))
data['words']={w:p for w,p in data['words'].items() if not familiar(w)}
write(path,data)
print('Private translations normalized;',len(data['words']),'IPA entries retained')
