"""Import user-provided EPUBs into ignored, localhost-only reading storage."""
import sys, pathlib, zipfile, json, posixpath, base64, mimetypes, re
from xml.etree import ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'work/python'))
from bs4 import BeautifulSoup
OUT=ROOT/'work/private-reading';OUT.mkdir(parents=True,exist_ok=True)
SOURCES=[('nvc','非暴力沟通','非暴力沟通*.epub'),('psychology','津巴多普通心理学（第8版）','津巴多普通心理学*.epub')]
catalog=[]
def write(path,data):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');temp.replace(path)
for book_id,title,pattern in SOURCES:
    paths=list((pathlib.Path.home()/'Downloads').glob(pattern))
    if len(paths)!=1:raise RuntimeError(f'Expected one EPUB for {title}, found {len(paths)}')
    with zipfile.ZipFile(paths[0]) as z:
        container=ET.fromstring(z.read('META-INF/container.xml'))
        opf_path=next(e.attrib['full-path'] for e in container.iter() if e.tag.endswith('rootfile'))
        opf=ET.fromstring(z.read(opf_path));base=posixpath.dirname(opf_path)
        manifest={e.attrib['id']:e.attrib for e in opf.iter() if e.tag.endswith('}item')}
        ncx=next((i for i in manifest.values() if i.get('media-type')=='application/x-dtbncx+xml'),None)
        labels={}
        if ncx:
            ncx_path=posixpath.normpath(posixpath.join(base,ncx['href']))
            nav=ET.fromstring(z.read(ncx_path))
            for point in nav.iter():
                if point.tag.endswith('}navPoint'):
                    content=next((e for e in point if e.tag.endswith('}content')),None)
                    label=next((e for e in point if e.tag.endswith('}navLabel')),None)
                    if content is not None and label is not None:
                        target=posixpath.normpath(posixpath.join(posixpath.dirname(ncx_path),content.attrib['src'].split('#')[0]))
                        labels.setdefault(target,''.join(label.itertext()).strip())
        chapters=[]
        for ref in opf.iter():
            if not ref.tag.endswith('}itemref'):continue
            item=manifest[ref.attrib['idref']]
            if item.get('media-type')!='application/xhtml+xml':continue
            path=posixpath.normpath(posixpath.join(base,item['href']))
            soup=BeautifulSoup(z.read(path),'html.parser');body=soup.body or soup
            for el in list(body.find_all(['script','style','iframe','object','embed','form','input','button','link'])):el.decompose()
            for el in body.find_all(True):
                attrs={}
                if el.get('id'):attrs['id']=el['id']
                if el.name=='img':
                    src=el.get('src','');image=posixpath.normpath(posixpath.join(posixpath.dirname(path),src))
                    if image in z.namelist():attrs['src']='data:'+ (mimetypes.guess_type(image)[0] or 'image/jpeg')+';base64,'+base64.b64encode(z.read(image)).decode()
                    attrs['alt']=el.get('alt','插图')
                if el.name in ('td','th'):
                    for key in ('colspan','rowspan'):
                        if str(el.get(key,'')).isdigit():attrs[key]=el[key]
                if el.name=='a':el.name='span'
                el.attrs=attrs
            text=body.get_text(' ',strip=True)
            if len(text)<30:continue
            heading=body.find(re.compile('^h[1-6]$'))
            label=labels.get(path) or (heading.get_text(' ',strip=True) if heading else text[:45])
            # Normalize section headings to the reader's stable, markable block types.
            for h in body.find_all(['h1','h4','h5','h6']):h.name='h2' if h.name=='h1' else 'h3'
            for cell in body.find_all('th'):cell.name='td'
            # Some EPUB navigation and glossary entries are plain inline text,
            # not paragraphs. Give those text runs their own stable reading block.
            for node in list(body.find_all(string=True)):
                if re.search(r'[\u4e00-\u9fffA-Za-z]',str(node)) and not node.find_parent(['p','li','td','h2','h3','figcaption']):
                    wrapper=soup.new_tag('p');node.wrap(wrapper)
            html=''.join(str(c) for c in body.contents)
            index=len(chapters);file=f'{book_id}-chapter-{index}.json'
            write(OUT/file,{'html':html})
            chapters.append({'title':label,'file':file})
        author=' / '.join(''.join(e.itertext()).strip() for e in opf.iter() if e.tag.endswith('}creator')) or '用户导入的电子书'
        metadata={'title':title,'author':author,'subtitle':'中文原文 · 英文机器助读译文（非英文原著）','license':'个人本地阅读。英文为根据所提供中文生成的助读译文。','source':'','originalLanguage':'zh','translationLanguage':'en','pronunciationsFile':'private-pronunciations.json','chapters':chapters}
        write(OUT/f'{book_id}.json',metadata)
        catalog.append({'id':book_id,'title':title,'chapters':len(chapters)})
        print(title,len(chapters),'sections',flush=True)
write(OUT/'local-catalog.json',catalog)
