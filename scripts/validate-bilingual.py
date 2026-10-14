"""Verify every reading block has an aligned, nonempty local translation."""
import pathlib, json, hashlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'work/python'))
from bs4 import BeautifulSoup
out=ROOT/'public/reading'
total=0;captions=0
for name in ('wealth','economics'):
    book=json.loads((out/(name+'.json')).read_text(encoding='utf-8'))
    count=0
    for index,chapter in enumerate(book['chapters']):
        source=chapter.get('html') or json.loads((out/chapter['file']).read_text(encoding='utf-8'))['html']
        soup=BeautifulSoup(source,'html.parser')
        blocks=[el for el in soup.find_all(['p','li','td','h2','h3']) if not el.find_parent(['p','li','td','h2','h3'])]
        figures=soup.find_all('figcaption')
        expected={**{f'p{i}':el.get_text() for i,el in enumerate(blocks)},**{f'c{i}':el.get_text() for i,el in enumerate(figures)}}
        data=json.loads((out/(name+'-zh-'+str(index)+'.json')).read_text(encoding='utf-8'))['paragraphs']
        assert set(data)==set(expected),(name,index,'paragraph keys do not match')
        for key,text in expected.items():
            assert data[key]['original']==text,(name,index,key,'source changed')
            assert data[key]['sourceHash']==hashlib.sha256(text.encode()).hexdigest(),(name,index,key,'incorrect alignment hash')
            if text.strip():assert data[key]['zh'].strip(),(name,index,key,'empty translation')
            assert '▁' not in data[key]['zh'],(name,index,key,'unprocessed tokenizer marker')
        count+=len(expected);captions+=len(figures)
    total+=count
    print(name+': '+str(len(book['chapters']))+' chapters, '+str(count)+' aligned blocks',flush=True)
ipa=json.loads((out/'pronunciations.json').read_text(encoding='utf-8'))
assert ipa['words']
print('PASS:',total,'translated reading blocks;',captions,'figure captions;',len(ipa['words']),'IPA entries',flush=True)
