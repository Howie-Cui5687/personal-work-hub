"""Verify every imported paragraph is paired with the matching English translation."""
import pathlib,sys,json,hashlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'work/python'))
from bs4 import BeautifulSoup
OUT=ROOT/'work/private-reading';total=0
for name in ('nvc','psychology'):
    book=json.loads((OUT/f'{name}.json').read_text(encoding='utf-8'));count=0;images=0
    for index,chapter in enumerate(book['chapters']):
        soup=BeautifulSoup(json.loads((OUT/chapter['file']).read_text(encoding='utf-8'))['html'],'html.parser')
        blocks=[e for e in soup.find_all(['p','li','td','h2','h3']) if not e.find_parent(['p','li','td','h2','h3'])]
        expected={f'p{i}':e.get_text() for i,e in enumerate(blocks)}
        expected.update({f'c{i}':e.get_text() for i,e in enumerate(soup.find_all('figcaption'))})
        data=json.loads((OUT/f'{name}-zh-{index}.json').read_text(encoding='utf-8'))['paragraphs']
        assert set(data)==set(expected),(name,index,'paragraph keys')
        for key,text in expected.items():
            assert data[key]['original']==text,(name,index,key,'alignment')
            assert data[key]['sourceHash']==hashlib.sha256(text.encode()).hexdigest(),(name,index,key,'hash')
            if text.strip():assert data[key]['en'].strip(),(name,index,key,'missing English')
            assert '▁' not in data[key]['en'],(name,index,key,'tokenizer artifact')
        assert not soup.find(['script','iframe','form']),(name,index,'active content')
        for node in soup.find_all(string=True):
            assert not re.search(r'[\u4e00-\u9fff]',str(node)) or node.find_parent(['p','li','td','h2','h3','figcaption']),(name,index,'uncovered Chinese text')
        for img in soup.find_all('img'):
            assert img.get('src','').startswith('data:image/'),(name,index,'missing image')
            images+=1
        count+=len(expected)
    total+=count
    print(name,len(book['chapters']),'sections,',count,'aligned blocks,',images,'images',flush=True)
assert json.loads((OUT/'private-pronunciations.json').read_text(encoding='utf-8'))['words']
print('PASS',total,'aligned reading blocks',flush=True)
