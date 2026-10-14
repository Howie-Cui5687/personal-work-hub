"""Normalize locally generated translation text and filter familiar inflections."""
import pathlib, json, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/reading'
WORK=ROOT/'work/bilingual'
common=set((WORK/'frequency.txt').read_text(encoding='utf-8').splitlines()[:3000])
def familiar(word):
    if word in common:return True
    candidates=[]
    if word.endswith('s'):candidates.append(word[:-1])
    if word.endswith('es'):candidates.append(word[:-2])
    if word.endswith('ies'):candidates.append(word[:-3]+'y')
    if word.endswith('ed'):candidates.extend((word[:-2],word[:-1],word[:-3] if len(word)>4 and word[-3]==word[-4] else ''))
    if word.endswith('ing'):candidates.extend((word[:-3],word[:-3]+'e',word[:-4] if len(word)>5 and word[-4]==word[-5] else ''))
    return any(c in common for c in candidates if len(c)>=3)
ipa_file=OUT/'pronunciations.json'
ipa=json.loads(ipa_file.read_text(encoding='utf-8'))
ipa['words']={w:p for w,p in ipa['words'].items() if not familiar(w)}
ipa['frequencyRule']='常见 3000 词及其常规屈折变化不标注；其余词使用音标词典可查到的美式发音。'
ipa_file.write_text(json.dumps(ipa,ensure_ascii=False),encoding='utf-8')
files=list(OUT.glob('*-zh-*.json'));paragraphs=0
corrections=json.loads((OUT/'translation-corrections.json').read_text(encoding='utf-8'))
for path in files:
    data=json.loads(path.read_text(encoding='utf-8'))
    for paragraph in data['paragraphs'].values():
        original=paragraph['original']
        translation=corrections.get(original,paragraph['zh']).replace('▁',' ').strip()
        if not re.search('[A-Za-z]',original) or re.fullmatch(r'\s*[A-Za-z]\s*',original):translation=original.strip()
        translation=re.sub(r' +',' ',translation)
        translation=translation.replace('机会费用','机会成本').replace('预算制约','预算约束')
        paragraph['zh']=translation
        paragraphs+=1
    path.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
print('Normalized',len(files),'chapters,',paragraphs,'paragraphs;',len(ipa['words']),'IPA entries',flush=True)
